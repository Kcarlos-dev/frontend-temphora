<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pontoApi } from '@/services/api'
import type { Ponto } from '@/types'
import { formatDataHoraLocal } from '@/utils/datetime'
import { compressImageFileIfNeeded } from '@/utils/compressImage'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
const pontos = ref<Ponto[]>([])
const loading = ref(true)
const registering = ref(false)
const showModal = ref(false)
const selectedTipo = ref('entrada')
const fotoFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const geoLat = ref<number | null>(null)
const geoLng = ref<number | null>(null)
const geoLoading = ref(false)
const geoHint = ref<string | null>(null)
const successMsg = ref('')
const errorMsg = ref('')

function formatCoord(n: number): string {
  return n.toFixed(6)
}

async function obterLocalizacao() {
  if (!navigator.geolocation) {
    geoHint.value = 'Geolocalização não disponível neste aparelho.'
    geoLat.value = null
    geoLng.value = null
    return
  }
  geoLoading.value = true
  geoHint.value = null
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }),
    )
    geoLat.value = pos.coords.latitude
    geoLng.value = pos.coords.longitude
  } catch {
    geoLat.value = null
    geoLng.value = null
    geoHint.value =
      'Não foi possível obter latitude e longitude. Verifique permissão de localização.'
  } finally {
    geoLoading.value = false
  }
}

function toInputDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const now = new Date()
const exportDataInicial = ref(toInputDateString(new Date(now.getFullYear(), now.getMonth(), 1)))
const exportDataFinal = ref(toInputDateString(now))

const tipos = [
  { value: 'entrada', label: 'Entrada', icon: 'login' },
  { value: 'saida', label: 'Saída', icon: 'logout' },
  { value: 'inicio_intervalo', label: 'Início Intervalo', icon: 'free_breakfast' },
  { value: 'fim_intervalo', label: 'Fim Intervalo', icon: 'restaurant' },
]

const groupedByDate = computed(() => {
  const groups: Record<string, Ponto[]> = {}
  for (const p of pontos.value) {
    const date = new Date(p.data_hora).toLocaleDateString('pt-BR')
    if (!groups[date]) groups[date] = []
    groups[date].push(p)
  }
  return Object.entries(groups).sort(([a], [b]) => {
    const da = a.split('/').reverse().join('')
    const db = b.split('/').reverse().join('')
    return db.localeCompare(da)
  })
})

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tipoLabel(tipo: string) {
  return tipos.find((t) => t.value === tipo)?.label ?? tipo
}

function tipoIcon(tipo: string) {
  return tipos.find((t) => t.value === tipo)?.icon ?? 'schedule'
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  fotoFile.value = target.files?.[0] ?? null
  if (fotoFile.value) {
    void obterLocalizacao()
  } else {
    geoLat.value = null
    geoLng.value = null
    geoHint.value = null
  }
}

async function registrarPonto() {
  if (!auth.empresaId || !auth.colaboradorId) return
  registering.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const form = new FormData()
    form.append('id_colaborador', String(auth.colaboradorId))
    form.append('tipo', selectedTipo.value)
    form.append('data_hora', formatDataHoraLocal(new Date()))

    if (geoLat.value != null && geoLng.value != null) {
      form.append('latitude', String(geoLat.value))
      form.append('longitude', String(geoLng.value))
    } else if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
        )
        form.append('latitude', String(pos.coords.latitude))
        form.append('longitude', String(pos.coords.longitude))
      } catch {
        // geolocation unavailable
      }
    }

    if (fotoFile.value) {
      const foto = await compressImageFileIfNeeded(fotoFile.value)
      form.append('foto', foto)
    }

    await pontoApi.create(auth.empresaId, form)
    successMsg.value = 'Ponto registrado com sucesso!'
    showModal.value = false
    fotoFile.value = null
    geoLat.value = null
    geoLng.value = null
    geoHint.value = null
    if (fileInputRef.value) fileInputRef.value.value = ''
    await fetchPontos()
  } catch (err: any) {
    const status = err.response?.status
    const apiMsg = err.response?.data?.message
    if (status === 413) {
      errorMsg.value =
        apiMsg ??
        'Arquivo grande demais. Tente outra foto ou peça para aumentarem o limite no servidor (ex.: nginx).'
    } else {
      errorMsg.value = apiMsg ?? 'Erro ao registrar ponto'
    }
  } finally {
    registering.value = false
  }
}

async function fetchPontos() {
  if (!auth.empresaId || !auth.colaboradorId) return
  try {
    const res = await pontoApi.list(auth.empresaId, auth.colaboradorId)
    pontos.value = res.data
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

async function exportarCsv() {
  if (!auth.empresaId || !auth.colaboradorId) return
  const dataInicial = exportDataInicial.value.trim()
  const dataFinal = exportDataFinal.value.trim()
  if (!dataInicial || !dataFinal) {
    errorMsg.value = 'Informe a data inicial e a data final para exportar.'
    return
  }
  if (dataInicial > dataFinal) {
    errorMsg.value = 'A data inicial não pode ser posterior à data final.'
    return
  }

  try {
    const res = await pontoApi.exportCsv(
      auth.empresaId,
      auth.colaboradorId,
      dataInicial,
      dataFinal,
    )
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `ponto_${dataInicial}_${dataFinal}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch {
    errorMsg.value = 'Erro ao exportar planilha'
  }
}

watch(showModal, (open) => {
  if (!open) {
    fotoFile.value = null
    geoLat.value = null
    geoLng.value = null
    geoHint.value = null
    geoLoading.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
})

onMounted(fetchPontos)
</script>

<template>
  <AppLayout>
    <div class="ponto-page">
      <header class="page-header">
        <div>
          <h1>Registro de Ponto</h1>
          <p class="page-subtitle">Gerencie seus registros de entrada e saída</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" @click="showModal = true">
            <span class="material-symbols-rounded">add</span>
            <span class="btn-text">Registrar</span>
          </button>
        </div>
      </header>

      <div class="export-toolbar">
        <span class="export-toolbar-title">Exportar CSV</span>
        <div class="export-toolbar-row">
          <div class="export-field">
            <label for="export-inicial">Data inicial</label>
            <input
              id="export-inicial"
              v-model="exportDataInicial"
              type="date"
              :max="exportDataFinal"
            />
          </div>
          <div class="export-field">
            <label for="export-final">Data final</label>
            <input
              id="export-final"
              v-model="exportDataFinal"
              type="date"
              :min="exportDataInicial"
            />
          </div>
          <button type="button" class="btn-outline export-csv-btn" @click="exportarCsv">
            <span class="material-symbols-rounded">download</span>
            <span class="btn-text">Baixar CSV</span>
          </button>
        </div>
      </div>

      <div v-if="successMsg" class="alert success">
        <span class="material-symbols-rounded">check_circle</span>
        {{ successMsg }}
        <button class="alert-close" @click="successMsg = ''">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div v-if="errorMsg" class="alert error">
        <span class="material-symbols-rounded">error</span>
        {{ errorMsg }}
        <button class="alert-close" @click="errorMsg = ''">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <div v-if="loading" class="loading-state">
        <span class="spinner-lg" />
      </div>

      <template v-else>
        <div v-if="pontos.length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">schedule</span>
          <p>Nenhum registro de ponto encontrado</p>
        </div>

        <div v-else class="pontos-list">
          <div v-for="[date, items] in groupedByDate" :key="date" class="date-group">
            <div class="date-header">{{ date }}</div>
            <div class="date-items">
              <div v-for="ponto in items" :key="ponto.id" class="ponto-item">
                <div class="ponto-dot">
                  <span class="material-symbols-rounded">{{ tipoIcon(ponto.tipo) }}</span>
                </div>
                <a
                  v-if="ponto.foto_url"
                  :href="ponto.foto_url"
                  class="ponto-thumb-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir foto do registro"
                >
                  <img :src="ponto.foto_url" alt="" class="ponto-thumb" />
                </a>
                <div class="ponto-info">
                  <span class="ponto-tipo">{{ tipoLabel(ponto.tipo) }}</span>
                  <span v-if="ponto.latitude" class="ponto-location">
                    <span class="material-symbols-rounded" style="font-size: 12px;">location_on</span>
                    Geolocalizado
                  </span>
                </div>
                <span class="ponto-time">{{ formatTime(ponto.data_hora) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Modal Registrar -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal">
              <div class="modal-header">
                <h3>Registrar Ponto</h3>
                <button class="modal-close" @click="showModal = false">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>

              <form @submit.prevent="registrarPonto" class="modal-body">
                <div class="tipo-grid">
                  <label
                    v-for="tipo in tipos"
                    :key="tipo.value"
                    class="tipo-option"
                    :class="{ selected: selectedTipo === tipo.value }"
                  >
                    <input
                      v-model="selectedTipo"
                      type="radio"
                      :value="tipo.value"
                      class="sr-only"
                    />
                    <span class="material-symbols-rounded tipo-icon">{{ tipo.icon }}</span>
                    <span class="tipo-label">{{ tipo.label }}</span>
                  </label>
                </div>

                <div class="field">
                  <label>Foto</label>
                  <div class="file-upload" @click="fileInputRef && fileInputRef.click()">
                    <span class="material-symbols-rounded">photo_camera</span>
                    <span>{{ fotoFile?.name ?? 'Tirar foto ou escolher arquivo' }}</span>
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      class="sr-only"
                      @change="handleFileChange"
                      required
                    />
                  </div>
                  <div v-if="fotoFile" class="geo-box">
                    <template v-if="geoLoading">
                      <span class="spinner geo-spinner" />
                      <span class="geo-text">Obtendo localização…</span>
                    </template>
                    <template v-else-if="geoLat != null && geoLng != null">
                      <span class="material-symbols-rounded geo-icon">location_on</span>
                      <div class="geo-values">
                        <span>Latitude <strong>{{ formatCoord(geoLat) }}</strong></span>
                        <span>Longitude <strong>{{ formatCoord(geoLng) }}</strong></span>
                      </div>
                      <button type="button" class="geo-refresh" @click="obterLocalizacao">
                        Atualizar
                      </button>
                    </template>
                    <template v-else-if="geoHint">
                      <p class="geo-hint-error">{{ geoHint }}</p>
                      <button type="button" class="geo-refresh" @click="obterLocalizacao">
                        Tentar novamente
                      </button>
                    </template>
                  </div>
                </div>

                <button type="submit" class="btn-primary btn-full" :disabled="registering">
                  <span v-if="registering" class="spinner" />
                  <span v-else>Confirmar Registro</span>
                </button>
              </form>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </AppLayout>
</template>

<style scoped>
.ponto-page {
  max-width: 800px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.page-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.export-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.export-toolbar-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.export-toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.export-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.export-field label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.export-field input[type='date'] {
  padding: 9px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  color: var(--color-text);
  min-width: 140px;
}

.export-field input[type='date']:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
  background: var(--color-surface);
}

.export-csv-btn {
  margin-left: auto;
}

@media (max-width: 520px) {
  .export-toolbar-row {
    flex-direction: column;
    align-items: stretch;
  }

  .export-field input[type='date'] {
    width: 100%;
    min-width: unset;
  }

  .export-csv-btn {
    margin-left: 0;
    justify-content: center;
  }
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.92; }

.btn-outline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text);
  transition: all 0.15s;
}

.btn-outline:hover {
  background: var(--color-bg);
}

.btn-outline .material-symbols-rounded,
.btn-primary .material-symbols-rounded {
  font-size: 18px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 16px;
}

.alert.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #059669;
}

.alert.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.alert .material-symbols-rounded { font-size: 18px; flex-shrink: 0; }

.alert-close {
  margin-left: auto;
  color: inherit;
  opacity: 0.6;
}

.alert-close .material-symbols-rounded { font-size: 16px; }

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.spinner-lg {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center;
  padding: 50px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-icon { font-size: 40px; color: var(--color-text-muted); margin-bottom: 8px; }
.empty-state p { color: var(--color-text-secondary); font-size: 0.88rem; }

.pontos-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.date-header {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.date-items {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.ponto-thumb-link {
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.ponto-thumb {
  display: block;
  width: 52px;
  height: 52px;
  object-fit: cover;
}

.ponto-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
}

.ponto-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

.ponto-dot {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ponto-dot .material-symbols-rounded {
  font-size: 16px;
  color: var(--color-primary);
}

.ponto-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.ponto-tipo {
  font-size: 0.88rem;
  font-weight: 600;
}

.ponto-location {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}

.ponto-time {
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}

.modal {
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
}

.modal-close {
  color: var(--color-text-muted);
  padding: 4px;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.tipo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.tipo-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.tipo-option:hover {
  border-color: var(--color-text-muted);
}

.tipo-option.selected {
  border-color: var(--color-primary);
  background: var(--color-tint-brand-bg);
}

.tipo-icon {
  font-size: 24px;
  color: var(--color-text-secondary);
}

.tipo-option.selected .tipo-icon {
  color: var(--color-primary);
}

.tipo-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.field label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 6px;
}

.file-upload {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  transition: border-color 0.15s;
}

.file-upload:hover {
  border-color: var(--color-text-muted);
}

.file-upload .material-symbols-rounded {
  font-size: 22px;
}

.geo-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 12px 14px;
  background: var(--color-tint-brand-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
}

.geo-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
}

.geo-text {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.geo-icon {
  font-size: 22px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.geo-values {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  flex: 1;
  min-width: 0;
}

.geo-values strong {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.geo-refresh {
  margin-left: auto;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.geo-refresh:hover {
  background: var(--color-bg);
}

.geo-hint-error {
  font-size: 0.8rem;
  color: var(--color-danger);
  margin: 0;
  flex: 1 1 100%;
}

.btn-full {
  width: 100%;
  justify-content: center;
  padding: 13px;
}

@media (min-width: 769px) {
  .modal-overlay {
    align-items: center;
  }

  .modal {
    border-radius: var(--radius-xl);
  }
}

@media (max-width: 480px) {
  .btn-text {
    display: none;
  }

  .btn-primary,
  .btn-outline {
    padding: 10px 12px;
  }
}
</style>
