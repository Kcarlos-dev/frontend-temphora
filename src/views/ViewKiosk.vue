<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { kioskApi, pontoApi } from '@/services/api'
import type { KioskMatchResult } from '@/types'
import { formatDataHoraLocal } from '@/utils/datetime'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()

const videoRef = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const capturedFile = ref<File | null>(null)
const capturedPreviewUrl = ref<string | null>(null)
const matching = ref(false)
const registering = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const selectedTipo = ref('entrada')
const identified = ref<KioskMatchResult | null>(null)
const geoLat = ref<number | null>(null)
const geoLng = ref<number | null>(null)

const tipos = [
  { value: 'entrada', label: 'Entrada', icon: 'login' },
  { value: 'saida', label: 'Saida', icon: 'logout' },
  { value: 'inicio_intervalo', label: 'Inicio Intervalo', icon: 'free_breakfast' },
  { value: 'fim_intervalo', label: 'Fim Intervalo', icon: 'restaurant' },
]

async function startCamera() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      await videoRef.value.play()
    }
  } catch {
    errorMsg.value = 'Nao foi possivel acessar a camera. Verifique as permissoes.'
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
}

function clearCapturedPreview() {
  if (capturedPreviewUrl.value) {
    URL.revokeObjectURL(capturedPreviewUrl.value)
  }
  capturedPreviewUrl.value = null
}

async function getGeolocation() {
  if (!navigator.geolocation) return
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
    )
    geoLat.value = pos.coords.latitude
    geoLng.value = pos.coords.longitude
  } catch {
    geoLat.value = null
    geoLng.value = null
  }
}

async function capturePhoto() {
  const video = videoRef.value
  if (!video || !video.videoWidth || !video.videoHeight) {
    errorMsg.value = 'A camera ainda nao esta pronta para captura.'
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    errorMsg.value = 'Nao foi possivel processar a imagem da camera.'
    return
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  )

  if (!blob) {
    errorMsg.value = 'Falha ao capturar foto.'
    return
  }

  clearCapturedPreview()
  capturedFile.value = new File([blob], `kiosk-${Date.now()}.jpg`, { type: 'image/jpeg' })
  capturedPreviewUrl.value = URL.createObjectURL(blob)
  identified.value = null
  successMsg.value = ''
  errorMsg.value = ''
  await getGeolocation()
}

async function identificarColaborador() {
  if (!auth.empresaId || !capturedFile.value) return
  matching.value = true
  errorMsg.value = ''
  successMsg.value = ''
  identified.value = null

  try {
    const form = new FormData()
    form.append('foto', capturedFile.value)
    const res = await kioskApi.match(auth.empresaId, form)
    identified.value = res.data
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Nao foi possivel identificar o colaborador.'
  } finally {
    matching.value = false
  }
}

function confirmarNao() {
  identified.value = null
}

async function confirmarSim() {
  if (!auth.empresaId || !capturedFile.value || !identified.value?.id) return
  registering.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const form = new FormData()
    form.append('id_colaborador', String(identified.value.id))
    form.append('tipo', selectedTipo.value)
    form.append('data_hora', formatDataHoraLocal(new Date()))
    form.append('foto', capturedFile.value)

    if (geoLat.value != null && geoLng.value != null) {
      form.append('latitude', String(geoLat.value))
      form.append('longitude', String(geoLng.value))
    }

    await pontoApi.create(auth.empresaId, form)
    successMsg.value = 'Ponto registrado com sucesso.'
    identified.value = null
    capturedFile.value = null
    clearCapturedPreview()
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao registrar ponto.'
  } finally {
    registering.value = false
  }
}

onMounted(() => {
  void startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  clearCapturedPreview()
})
</script>

<template>
  <AppLayout>
    <div class="kiosk-page">
      <header class="page-header">
        <h1>Bater Ponto (Kiosk)</h1>
        <p class="subtitle">Capture a foto, confirme o colaborador e registre o ponto.</p>
      </header>

      <div class="camera-box">
        <video ref="videoRef" autoplay playsinline muted class="camera-video" />
      </div>

      <div class="actions">
        <button type="button" class="btn-outline" @click="capturePhoto">Capturar foto</button>
      </div>

      <div class="tipo-grid">
        <label
          v-for="tipo in tipos"
          :key="tipo.value"
          class="tipo-option"
          :class="{ selected: selectedTipo === tipo.value }"
        >
          <input v-model="selectedTipo" type="radio" :value="tipo.value" class="sr-only" />
          <span class="material-symbols-rounded tipo-icon">{{ tipo.icon }}</span>
          <span class="tipo-label">{{ tipo.label }}</span>
        </label>
      </div>

      <div v-if="capturedPreviewUrl" class="captured-box">
        <img :src="capturedPreviewUrl" alt="Foto capturada" class="captured-img" />
        <button type="button" class="btn-primary" :disabled="matching" @click="identificarColaborador">
          <span v-if="matching" class="spinner" />
          <span v-else>Identificar colaborador</span>
        </button>
      </div>

      <div v-if="identified" class="confirm-card">
        <img
          v-if="identified.foto_url || identified.foto"
          :src="identified.foto_url ?? identified.foto ?? ''"
          alt="Foto do colaborador"
          class="confirm-avatar"
        />
        <div class="confirm-text">
          <strong>{{ identified.full_name }}</strong>
          <span>Este e o colaborador?</span>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-outline" :disabled="registering" @click="confirmarNao">
            Nao
          </button>
          <button type="button" class="btn-primary" :disabled="registering" @click="confirmarSim">
            <span v-if="registering" class="spinner" />
            <span v-else>Sim, bater ponto</span>
          </button>
        </div>
      </div>

      <div v-if="successMsg" class="alert success">{{ successMsg }}</div>
      <div v-if="errorMsg" class="alert error">{{ errorMsg }}</div>
    </div>
  </AppLayout>
</template>

<style scoped>
.kiosk-page { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.page-header h1 { font-size: 1.5rem; font-weight: 800; }
.subtitle { color: var(--color-text-secondary); font-size: 0.85rem; }
.camera-box { border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--color-border); background: #000; }
.camera-video { width: 100%; min-height: 260px; max-height: 460px; object-fit: cover; }
.actions { display: flex; justify-content: center; }
.captured-box { display: flex; flex-direction: column; gap: 10px; }
.captured-img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
.confirm-card { border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.confirm-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 1px solid var(--color-border); }
.confirm-text { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
.confirm-actions { display: flex; gap: 8px; margin-left: auto; }
.tipo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.tipo-option { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; }
.tipo-option.selected { border-color: var(--color-primary); background: var(--color-tint-brand-bg); }
.tipo-icon { font-size: 22px; color: var(--color-text-secondary); }
.tipo-option.selected .tipo-icon { color: var(--color-primary); }
.tipo-label { font-size: 0.8rem; font-weight: 600; }
.btn-primary,.btn-outline { padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-outline { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); }
.alert { padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 500; }
.alert.success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; }
.alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
.sr-only { position: absolute; opacity: 0; pointer-events: none; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
