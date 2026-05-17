<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pontoApi, colaboradorApi, extractApiErrorMessage } from '@/services/api'
import type { Ponto, Colaborador } from '@/types'
import { formatDataHoraLocal, parseDataHora } from '@/utils/datetime'
import { onlyDigits } from '@/utils/inputFormat'
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

// Paginação server-side simples (default pageSize=10). Default da API também é
// 10, então sem informar esses parâmetros o backend devolve só os 10 primeiros.
const page = ref(1)
const pageSize = ref(10)
const hasMore = ref(false)

const isManagerView = computed(() =>
  ['admin', 'rh', 'root'].includes(auth.userRole),
)
const canExportCsv = computed(() =>
  ['admin', 'root'].includes(auth.userRole),
)
const canRegistrarPonto = computed(
  () => auth.colaboradorId != null && auth.empresaId != null,
)

// Busca manual de colaborador (CPF ou ID) — modo gestor.
type SearchMode = 'cpf' | 'id'
const searchMode = ref<SearchMode>('cpf')
const searchInput = ref('')
const searching = ref(false)
const selectedColaborador = ref<Colaborador | null>(null)
const selectedColaboradorId = ref<number | null>(null)

// A API já devolve os pontos ordenados do mais recente pro mais antigo,
// então aqui é só um passthrough (mantive a referência pra UI não quebrar).
const pontosOrdenados = computed(() => pontos.value)
const totalRegistros = computed(() => pontos.value.length)

function formatMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

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
const showExportConfirm = ref(false)
const exporting = ref(false)

const exportTargetColaboradorId = computed<number | null>(() =>
  isManagerView.value ? selectedColaboradorId.value : (auth.colaboradorId ?? null),
)

const exportTargetNome = computed(() => {
  if (isManagerView.value) {
    return (
      selectedColaborador.value?.full_name ??
      (selectedColaboradorId.value
        ? `Colaborador #${selectedColaboradorId.value}`
        : '')
    )
  }
  return 'seus registros'
})

const tipos = [
  { value: 'entrada', label: 'Entrada', icon: 'login' },
  { value: 'saida', label: 'Saída', icon: 'logout' },
  { value: 'inicio_intervalo', label: 'Início Intervalo', icon: 'free_breakfast' },
  { value: 'fim_intervalo', label: 'Fim Intervalo', icon: 'restaurant' },
]

const groupedByDate = computed(() => {
  const groups: Record<string, Ponto[]> = {}
  for (const p of pontosOrdenados.value) {
    const date = parseDataHora(p.data_hora).toLocaleDateString('pt-BR')
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
  return parseDataHora(dateStr).toLocaleTimeString('pt-BR', {
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
    // Volta pra primeira página pra exibir o registro recém-criado no topo.
    page.value = 1
    // Se um gestor está vendo um colaborador específico, refaz a busca desse colaborador;
    // senão, recarrega os pontos pessoais (colaborador comum).
    if (isManagerView.value && selectedColaboradorId.value) {
      await fetchPontosColaborador(selectedColaboradorId.value)
    } else {
      await fetchPontos()
    }
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

async function fetchPontosPessoais() {
  if (!auth.empresaId || !auth.colaboradorId) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await pontoApi.list(
      auth.empresaId,
      auth.colaboradorId,
      page.value,
      pageSize.value,
    )
    pontos.value = res.data.data
    hasMore.value = res.data.hasMore
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

async function fetchPontosColaborador(
  idColaborador: number,
  opts?: { resetPage?: boolean },
) {
  if (!auth.empresaId) return
  loading.value = true
  if (opts?.resetPage) page.value = 1
  try {
    const res = await pontoApi.list(
      auth.empresaId,
      idColaborador,
      page.value,
      pageSize.value,
    )
    pontos.value = res.data.data
    hasMore.value = res.data.hasMore
  } catch (err: any) {
    const status = err.response?.status
    if (status === 404) {
      pontos.value = []
      hasMore.value = false
    } else {
      errorMsg.value =
        err.response?.data?.message ?? 'Erro ao carregar pontos do colaborador'
    }
  } finally {
    loading.value = false
  }
}

async function buscarColaborador() {
  if (!auth.empresaId) return
  const raw = searchInput.value.trim()
  if (!raw) {
    errorMsg.value =
      searchMode.value === 'cpf'
        ? 'Informe o CPF do colaborador para buscar.'
        : 'Informe o ID do colaborador para buscar.'
    return
  }
  errorMsg.value = ''
  successMsg.value = ''
  searching.value = true

  try {
    let colab: Colaborador | null = null
    let idColab: number | null = null

    if (searchMode.value === 'cpf') {
      const cpf = onlyDigits(raw)
      if (cpf.length !== 11) {
        errorMsg.value = 'CPF deve conter 11 dígitos.'
        return
      }
      const res = await colaboradorApi.getByCpf(auth.empresaId, cpf)
      colab = res.data
      idColab = res.data?.id ?? null
    } else {
      const parsed = parseInt(raw, 10)
      if (!parsed || Number.isNaN(parsed) || parsed <= 0) {
        errorMsg.value = 'ID do colaborador inválido.'
        return
      }
      idColab = parsed
      // Tenta enriquecer com dados da lista (opcional — a rota direta por id não existe).
      // Uso pageSize grande para aumentar a chance de encontrar o colaborador sem
      // precisar paginar; se tiver mais de 200 colaboradores o enriquecimento falha
      // silenciosamente (a UI continua funcionando só com o ID).
      try {
        const lista = await colaboradorApi.list(auth.empresaId, 1, 200)
        colab = lista.data.data.find((c) => c.id === parsed) ?? null
      } catch {
        colab = null
      }
    }

    if (!idColab) {
      errorMsg.value = 'Colaborador não encontrado.'
      pontos.value = []
      selectedColaborador.value = null
      selectedColaboradorId.value = null
      return
    }

    selectedColaborador.value = colab
    selectedColaboradorId.value = idColab
    await fetchPontosColaborador(idColab, { resetPage: true })
  } catch (err: any) {
    const status = err.response?.status
    if (status === 404) {
      errorMsg.value = 'Colaborador não encontrado para essa empresa.'
    } else {
      errorMsg.value =
        err.response?.data?.message ?? 'Erro ao buscar colaborador.'
    }
    pontos.value = []
    selectedColaborador.value = null
    selectedColaboradorId.value = null
  } finally {
    searching.value = false
  }
}

function limparBusca() {
  searchInput.value = ''
  selectedColaborador.value = null
  selectedColaboradorId.value = null
  pontos.value = []
  page.value = 1
  hasMore.value = false
  errorMsg.value = ''
}

async function fetchPontos() {
  if (isManagerView.value) {
    // Gestor não tem lista automática — aguarda a busca manual.
    loading.value = false
    return
  }
  await fetchPontosPessoais()
}

function goToPage(next: number) {
  if (next < 1) return
  if (next > page.value && !hasMore.value) return
  if (next === page.value) return
  page.value = next
  if (isManagerView.value && selectedColaboradorId.value) {
    void fetchPontosColaborador(selectedColaboradorId.value)
  } else {
    void fetchPontosPessoais()
  }
}

function abrirConfirmacaoExport() {
  if (!auth.empresaId) return
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
  if (!exportTargetColaboradorId.value) {
    errorMsg.value = isManagerView.value
      ? 'Busque um colaborador antes de exportar a planilha.'
      : 'Colaborador não identificado.'
    return
  }
  errorMsg.value = ''
  showExportConfirm.value = true
}

async function exportarCsv() {
  if (!auth.empresaId) return
  const idColab = exportTargetColaboradorId.value
  if (!idColab) return
  const dataInicial = exportDataInicial.value.trim()
  const dataFinal = exportDataFinal.value.trim()

  exporting.value = true
  try {
    const res = await pontoApi.exportCsv(
      auth.empresaId,
      idColab,
      dataInicial,
      dataFinal,
    )
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const fileName = `ponto_${dataInicial}_${dataFinal}.csv`

    // Navegadores mobile (especialmente iOS Safari) exigem que o <a>
    // esteja anexado ao DOM para o clique programático baixar o arquivo.
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)

    showExportConfirm.value = false
  } catch (err: unknown) {
    const res = err as { response?: { data?: unknown } }
    const msg = await extractApiErrorMessage(res.response?.data)
    errorMsg.value = msg || 'Erro ao exportar planilha'
  } finally {
    exporting.value = false
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
          <button
            v-if="canRegistrarPonto"
            class="btn-primary"
            @click="showModal = true"
          >
            <span class="material-symbols-rounded">add</span>
            <span class="btn-text">Registrar</span>
          </button>
        </div>
      </header>

      <div v-if="isManagerView" class="search-toolbar">
        <span class="search-toolbar-title">Buscar pontos de um colaborador</span>
        <div class="search-mode">
          <label
            class="search-mode-option"
            :class="{ active: searchMode === 'cpf' }"
          >
            <input v-model="searchMode" type="radio" value="cpf" />
            <span>CPF</span>
          </label>
          <label
            class="search-mode-option"
            :class="{ active: searchMode === 'id' }"
          >
            <input v-model="searchMode" type="radio" value="id" />
            <span>ID</span>
          </label>
        </div>
        <form class="search-row" @submit.prevent="buscarColaborador">
          <input
            v-model="searchInput"
            :type="searchMode === 'id' ? 'number' : 'text'"
            :inputmode="searchMode === 'id' ? 'numeric' : 'numeric'"
            :placeholder="
              searchMode === 'cpf'
                ? '000.000.000-00 ou só os dígitos'
                : 'ID do colaborador'
            "
            class="search-input"
            autocomplete="off"
          />
          <button
            type="submit"
            class="btn-primary search-submit"
            :disabled="searching"
          >
            <span v-if="searching" class="spinner" />
            <template v-else>
              <span class="material-symbols-rounded">search</span>
              <span class="btn-text">Buscar</span>
            </template>
          </button>
          <button
            v-if="selectedColaboradorId"
            type="button"
            class="btn-outline search-clear"
            @click="limparBusca"
          >
            <span class="material-symbols-rounded">close</span>
            <span class="btn-text">Limpar</span>
          </button>
        </form>

        <div v-if="selectedColaboradorId" class="search-result-info">
          <span class="material-symbols-rounded">badge</span>
          <div class="search-result-text">
            <strong>
              {{ selectedColaborador?.full_name ?? `Colaborador #${selectedColaboradorId}` }}
            </strong>
            <span class="search-result-meta">
              ID {{ selectedColaboradorId }}
              <template v-if="selectedColaborador?.cpf">
                · CPF {{ selectedColaborador.cpf }}
              </template>
              · {{ totalRegistros }} nesta página
            </span>
          </div>
        </div>
      </div>

      <div v-if="canExportCsv" class="export-toolbar">
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
          <button type="button" class="btn-outline export-csv-btn" @click="abrirConfirmacaoExport">
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
        <div v-if="isManagerView && !selectedColaboradorId" class="empty-state">
          <span class="material-symbols-rounded empty-icon">person_search</span>
          <p>Informe o CPF ou o ID do colaborador para ver os pontos registrados.</p>
        </div>
        <div
          v-else-if="pontos.length === 0"
          class="empty-state"
        >
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
                  <span
                    v-if="isManagerView && ponto.colaborador_nome"
                    class="ponto-colab"
                  >
                    {{ ponto.colaborador_nome }}
                  </span>
                  <span class="ponto-tipo">{{ tipoLabel(ponto.tipo) }}</span>
                  <div
                    v-if="ponto.latitude != null && ponto.longitude != null"
                    class="ponto-geo"
                  >
                    <span class="material-symbols-rounded ponto-geo-icon">location_on</span>
                    <span class="ponto-geo-values">
                      {{ formatCoord(Number(ponto.latitude)) }},
                      {{ formatCoord(Number(ponto.longitude)) }}
                    </span>
                    <a
                      class="ponto-geo-link"
                      :href="formatMapsUrl(Number(ponto.latitude), Number(ponto.longitude))"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Google Maps"
                    >
                      <span class="material-symbols-rounded">map</span>
                      <span>Abrir no mapa</span>
                    </a>
                  </div>
                </div>
                <span class="ponto-time">{{ formatTime(ponto.data_hora) }}</span>
              </div>
            </div>
          </div>
        </div>

        <nav
          v-if="page > 1 || hasMore"
          class="pagination"
          aria-label="Paginação de pontos"
        >
          <button
            type="button"
            class="btn-outline pagination-btn"
            :disabled="page <= 1 || loading"
            @click="goToPage(page - 1)"
          >
            <span class="material-symbols-rounded">chevron_left</span>
            <span class="btn-text">Anterior</span>
          </button>
          <span class="pagination-info">
            Página <strong>{{ page }}</strong>
          </span>
          <button
            type="button"
            class="btn-outline pagination-btn"
            :disabled="!hasMore || loading"
            @click="goToPage(page + 1)"
          >
            <span class="btn-text">Próxima</span>
            <span class="material-symbols-rounded">chevron_right</span>
          </button>
        </nav>
      </template>

      <!-- Modal Confirmar Exportação CSV -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="showExportConfirm"
            class="modal-overlay"
          >
            <div class="modal confirm-modal">
              <div class="modal-header">
                <h3>Confirmar download</h3>
                <button
                  class="modal-close"
                  :disabled="exporting"
                  @click="showExportConfirm = false"
                >
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>
              <div class="modal-body">
                <p class="confirm-text">
                  Deseja baixar a planilha CSV de
                  <strong>{{ exportTargetNome }}</strong>
                  no período
                  <strong>{{ exportDataInicial }}</strong>
                  até
                  <strong>{{ exportDataFinal }}</strong>?
                </p>
                <div class="confirm-actions">
                  <button
                    type="button"
                    class="btn-outline"
                    :disabled="exporting"
                    @click="showExportConfirm = false"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn-primary"
                    :disabled="exporting"
                    @click="exportarCsv"
                  >
                    <span v-if="exporting" class="spinner" />
                    <template v-else>
                      <span class="material-symbols-rounded">download</span>
                      <span>Baixar</span>
                    </template>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Modal Registrar -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showModal" class="modal-overlay">
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

.search-toolbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.search-toolbar-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.search-mode {
  display: flex;
  gap: 8px;
}

.search-mode-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  cursor: pointer;
  background: var(--color-bg);
  transition: all 0.15s;
}

.search-mode-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.search-mode-option.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: rgba(26, 26, 46, 0.06);
}

.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-input {
  flex: 1 1 220px;
  min-width: 0;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  color: var(--color-text);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
  background: var(--color-surface);
}

.search-submit,
.search-clear {
  flex: 0 0 auto;
}

.search-result-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.search-result-info .material-symbols-rounded {
  font-size: 22px;
  color: var(--color-primary);
}

.search-result-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.88rem;
  color: var(--color-text);
}

.search-result-meta {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.ponto-colab {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.ponto-geo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--color-bg);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--color-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.ponto-geo-icon {
  font-size: 14px !important;
  color: var(--color-primary);
}

.ponto-geo-values {
  letter-spacing: 0.02em;
}

.ponto-geo-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.72rem;
  font-family: var(--font-sans, inherit);
  background: var(--color-primary);
  color: #fff;
  text-decoration: none;
  transition: opacity 0.15s;
}

.ponto-geo-link:hover {
  opacity: 0.9;
}

.ponto-geo-link .material-symbols-rounded {
  font-size: 14px !important;
  color: #fff;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.confirm-modal .confirm-text {
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text);
}

.confirm-modal .confirm-text strong {
  color: var(--color-primary);
  font-weight: 700;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-actions .btn-primary,
.confirm-actions .btn-outline {
  min-width: 110px;
  justify-content: center;
}

@media (max-width: 480px) {
  .confirm-actions {
    flex-direction: column-reverse;
  }

  .confirm-actions .btn-primary,
  .confirm-actions .btn-outline {
    width: 100%;
  }
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
