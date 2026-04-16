<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pontoApi } from '@/services/api'
import type { Ponto } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
const pontos = ref<Ponto[]>([])
const loading = ref(true)
const registering = ref(false)
const showModal = ref(false)
const selectedTipo = ref('entrada')
const fotoFile = ref<File | null>(null)
const successMsg = ref('')
const errorMsg = ref('')

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
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const dataHora = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    form.append('data_hora', dataHora)

    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
        )
        form.append('latitude', String(pos.coords.latitude))
        form.append('longitude', String(pos.coords.longitude))
      } catch {
        // geolocation unavailable
      }
    }

    if (fotoFile.value) {
      form.append('foto', fotoFile.value)
    }

    await pontoApi.create(auth.empresaId, form)
    successMsg.value = 'Ponto registrado com sucesso!'
    showModal.value = false
    fotoFile.value = null
    await fetchPontos()
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao registrar ponto'
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
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const dataInicial = start.toISOString().split('T')[0]!
  const dataFinal = now.toISOString().split('T')[0]!

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
          <button class="btn-outline" @click="exportarCsv">
            <span class="material-symbols-rounded">download</span>
            <span class="btn-text">CSV</span>
          </button>
          <button class="btn-primary" @click="showModal = true">
            <span class="material-symbols-rounded">add</span>
            <span class="btn-text">Registrar</span>
          </button>
        </div>
      </header>

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
                  <div class="file-upload" @click="($refs.fileInput as HTMLInputElement).click()">
                    <span class="material-symbols-rounded">photo_camera</span>
                    <span>{{ fotoFile?.name ?? 'Tirar foto ou escolher arquivo' }}</span>
                    <input
                      ref="fileInput"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      class="sr-only"
                      @change="handleFileChange"
                      required
                    />
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
  border-color: var(--color-accent);
  background: #fef9c3;
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
