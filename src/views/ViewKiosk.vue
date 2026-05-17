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

/** Após uma captura válida, o botão "Capturar foto" fica bloqueado até reiniciar a página. */
const captureLocked = ref(false)
const flashActive = ref(false)

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

  flashActive.value = true
  window.setTimeout(() => {
    flashActive.value = false
  }, 480)
  captureLocked.value = true

  await getGeolocation()
}

function fecharModalCaptura() {
  if (matching.value || registering.value) return
  identified.value = null
  capturedFile.value = null
  clearCapturedPreview()
  captureLocked.value = false
  errorMsg.value = ''
  successMsg.value = ''
}

function restartKiosk() {
  window.location.reload()
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

      <div class="camera-box" :class="{ flash: flashActive }">
        <video ref="videoRef" autoplay playsinline muted class="camera-video" />
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn-outline btn-capture"
          :disabled="captureLocked"
          @click="capturePhoto"
        >
          <span class="material-symbols-rounded">photo_camera</span>
          {{ captureLocked ? 'Foto ja capturada' : 'Capturar foto' }}
        </button>
      </div>

      <div v-if="errorMsg && !capturedPreviewUrl" class="alert error">{{ errorMsg }}</div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="capturedPreviewUrl"
          class="modal-overlay"
          @click.self="!matching && !registering && !identified && fecharModalCaptura()"
        >
          <div
            class="modal kiosk-capture-modal"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="identified ? 'kiosk-confirm-title' : 'kiosk-capture-title'"
          >
            <div class="modal-header">
              <h3 :id="identified ? 'kiosk-confirm-title' : 'kiosk-capture-title'">
                {{ identified ? 'Confirmar colaborador' : 'Foto capturada' }}
              </h3>
              <button
                type="button"
                class="modal-close"
                :disabled="matching || registering"
                aria-label="Fechar"
                @click="identified ? confirmarNao() : fecharModalCaptura()"
              >
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <div class="modal-body">
              <template v-if="identified">
                <div class="confirm-profile">
                  <img
                    v-if="identified.foto_url || identified.foto"
                    :src="identified.foto_url ?? identified.foto ?? ''"
                    alt="Foto do colaborador"
                    class="confirm-avatar"
                  />
                  <div v-else class="confirm-avatar confirm-avatar-placeholder">
                    <span class="material-symbols-rounded">person</span>
                  </div>
                  <p class="confirm-name">{{ identified.full_name }}</p>
                  <p class="confirm-question">Este e o colaborador?</p>
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
              </template>

              <template v-else>
                <img :src="capturedPreviewUrl" alt="Foto capturada" class="captured-img" />

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

                <button
                  type="button"
                  class="btn-primary btn-identify"
                  :disabled="matching"
                  @click="identificarColaborador"
                >
                  <span v-if="matching" class="spinner" />
                  <span v-else>Identificar colaborador</span>
                </button>

                <button
                  type="button"
                  class="btn-outline btn-new-photo"
                  :disabled="matching"
                  @click="restartKiosk"
                >
                  <span class="material-symbols-rounded">refresh</span>
                  Nova foto
                </button>
              </template>

              <div v-if="successMsg" class="alert success">{{ successMsg }}</div>
              <div v-if="errorMsg" class="alert error">{{ errorMsg }}</div>

              <button
                v-if="successMsg"
                type="button"
                class="btn-primary btn-identify"
                @click="restartKiosk"
              >
                <span class="material-symbols-rounded">refresh</span>
                Nova foto
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.kiosk-page { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
.page-header h1 { font-size: 1.5rem; font-weight: 800; }
.subtitle { color: var(--color-text-secondary); font-size: 0.85rem; }
.camera-box {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: #000;
}
.camera-box.flash::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  animation: kiosk-flash 0.48s ease-out;
  pointer-events: none;
  border-radius: inherit;
}
@keyframes kiosk-flash {
  0% { opacity: 0.75; }
  100% { opacity: 0; }
}
.camera-video { width: 100%; min-height: 260px; max-height: 460px; object-fit: cover; }
.actions { display: flex; justify-content: center; }
.btn-capture .material-symbols-rounded { font-size: 20px; }
.btn-capture:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.captured-img {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  max-height: 280px;
  object-fit: cover;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
}
.modal {
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  width: 100%;
  max-width: 420px;
  max-height: 92vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}
.modal-header h3 { font-size: 1.1rem; font-weight: 700; }
.modal-close { color: var(--color-text-muted); padding: 4px; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.confirm-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.confirm-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-border);
}
.confirm-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-tint-brand-bg, #f3f4f6);
  color: var(--color-text-secondary);
}
.confirm-avatar-placeholder .material-symbols-rounded { font-size: 48px; }
.confirm-name { font-size: 1.15rem; font-weight: 800; }
.confirm-question { font-size: 0.95rem; color: var(--color-text-secondary); }
.confirm-actions { display: flex; gap: 10px; }
.confirm-actions .btn-primary,
.confirm-actions .btn-outline { flex: 1; padding: 14px 16px; font-size: 0.95rem; }
.btn-identify,
.btn-new-photo { width: 100%; padding: 14px 16px; font-size: 0.95rem; }
@media (min-width: 769px) {
  .modal-overlay { align-items: center; }
  .modal { border-radius: var(--radius-xl); }
}
@media (max-width: 480px) {
  .confirm-actions { flex-direction: column-reverse; }
}
.tipo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.tipo-option { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; border: 2px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; }
.tipo-option.selected { border-color: var(--color-primary); background: var(--color-tint-brand-bg); }
.tipo-icon { font-size: 22px; color: var(--color-text-secondary); }
.tipo-option.selected .tipo-icon { color: var(--color-primary); }
.tipo-label { font-size: 0.8rem; font-weight: 600; }
.btn-primary,.btn-outline { padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; font-size: 0.85rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-outline { background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); }
.alert { padding: 10px 12px; border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 500; }
.alert.success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; }
.alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
.sr-only { position: absolute; opacity: 0; pointer-events: none; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
