<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { userApi, colaboradorApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { compressImageFileIfNeeded } from '@/utils/compressImage'
import type { UserProfile } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'open-change-password'): void
}>()

const auth = useAuthStore()

const loading = ref(false)
const uploading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const profile = ref<UserProfile | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const formattedCpf = computed(() => {
  const cpf = profile.value?.cpf ?? ''
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf || '—'
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
})

const displayName = computed(
  () => profile.value?.full_name || profile.value?.name || '—',
)

const initials = computed(() => {
  const base = displayName.value || profile.value?.email || '?'
  const parts = base.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase().slice(0, 2) || '?'
})

async function loadProfile() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await userApi.me()
    profile.value = res.data
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao carregar perfil.'
  } finally {
    loading.value = false
  }
}

function close() {
  if (uploading.value) return
  emit('update:modelValue', false)
}

function openChangePassword() {
  emit('update:modelValue', false)
  emit('open-change-password')
}

function triggerFilePicker() {
  if (!profile.value?.id_colaborador || !profile.value?.id_empresa) {
    errorMsg.value = 'Sua conta não está vinculada a um colaborador.'
    return
  }
  fileInput.value?.click()
}

async function handleFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!profile.value?.id_colaborador || !profile.value?.id_empresa) {
    errorMsg.value = 'Sua conta não está vinculada a um colaborador.'
    return
  }

  uploading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const compressed = await compressImageFileIfNeeded(file)
    const fd = new FormData()
    fd.append('foto', compressed)
    const res = await colaboradorApi.uploadFoto(
      profile.value.id_empresa,
      profile.value.id_colaborador,
      fd,
    )
    profile.value = {
      ...profile.value,
      foto: res.data.foto ?? profile.value.foto,
      foto_url: res.data.foto_url ?? profile.value.foto_url,
    }
    successMsg.value = 'Foto atualizada com sucesso!'
    setTimeout(() => (successMsg.value = ''), 2000)
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao enviar a foto.'
  } finally {
    uploading.value = false
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      errorMsg.value = ''
      successMsg.value = ''
      loadProfile()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="pm-overlay" @click.self="close">
        <div
          class="pm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pm-title"
        >
          <div class="pm-header">
            <h3 id="pm-title">Meu perfil</h3>
            <button
              type="button"
              class="pm-close"
              :disabled="uploading"
              aria-label="Fechar"
              @click="close"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <div class="pm-body">
            <div v-if="successMsg" class="pm-alert success">
              <span class="material-symbols-rounded">check_circle</span>
              {{ successMsg }}
            </div>
            <div v-if="errorMsg" class="pm-alert error">
              <span class="material-symbols-rounded">error</span>
              {{ errorMsg }}
            </div>

            <div v-if="loading" class="pm-loading">
              <span class="pm-spinner" />
              <span>Carregando perfil…</span>
            </div>

            <template v-else-if="profile">
              <div class="pm-avatar-wrap">
                <div class="pm-avatar">
                  <img
                    v-if="profile.foto_url"
                    :src="profile.foto_url"
                    :alt="displayName"
                  />
                  <span v-else class="pm-avatar-initials">{{ initials }}</span>
                  <div v-if="uploading" class="pm-avatar-overlay">
                    <span class="pm-spinner" />
                  </div>
                </div>
                <button
                  type="button"
                  class="pm-avatar-edit"
                  :disabled="uploading || !profile.id_colaborador"
                  :title="
                    profile.id_colaborador
                      ? 'Trocar foto de perfil'
                      : 'Conta sem colaborador vinculado'
                  "
                  @click="triggerFilePicker"
                >
                  <span class="material-symbols-rounded">photo_camera</span>
                </button>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  capture="user"
                  hidden
                  @change="handleFileChange"
                />
              </div>

              <div class="pm-name">{{ displayName }}</div>
              <div class="pm-role">{{ profile.role }}</div>

              <dl class="pm-info">
                <div class="pm-info-row">
                  <dt>E-mail</dt>
                  <dd>{{ profile.email }}</dd>
                </div>
                <div class="pm-info-row">
                  <dt>CPF</dt>
                  <dd>{{ formattedCpf }}</dd>
                </div>
                <div class="pm-info-row">
                  <dt>ID do usuário</dt>
                  <dd>{{ profile.id_user }}</dd>
                </div>
                <div class="pm-info-row">
                  <dt>ID da empresa</dt>
                  <dd>{{ profile.id_empresa ?? '—' }}</dd>
                </div>
                <div v-if="profile.id_colaborador" class="pm-info-row">
                  <dt>ID do colaborador</dt>
                  <dd>{{ profile.id_colaborador }}</dd>
                </div>
                <div v-if="profile.status" class="pm-info-row">
                  <dt>Status</dt>
                  <dd class="pm-status" :data-status="profile.status">
                    {{ profile.status }}
                  </dd>
                </div>
              </dl>

              <div class="pm-actions">
                <button
                  type="button"
                  class="pm-btn pm-btn-outline"
                  @click="openChangePassword"
                >
                  <span class="material-symbols-rounded">key</span>
                  Alterar senha
                </button>
                <button
                  type="button"
                  class="pm-btn pm-btn-primary"
                  @click="close"
                >
                  Fechar
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 300;
  padding: 16px;
}

.pm-modal {
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
}

.pm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.pm-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.pm-close {
  color: var(--color-text-muted);
  padding: 4px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.pm-close .material-symbols-rounded {
  font-size: 20px;
}

.pm-body {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pm-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
}

.pm-alert.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #059669;
}

.pm-alert.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.pm-alert .material-symbols-rounded {
  font-size: 18px;
  flex-shrink: 0;
}

.pm-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.pm-avatar-wrap {
  position: relative;
  align-self: center;
  margin-top: 4px;
}

.pm-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--color-border-light);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.pm-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pm-avatar-initials {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text-muted);
  letter-spacing: -0.02em;
}

.pm-avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pm-avatar-edit {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  border: 3px solid var(--color-surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.pm-avatar-edit:hover:not(:disabled) {
  transform: scale(1.05);
}

.pm-avatar-edit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pm-avatar-edit .material-symbols-rounded {
  font-size: 18px;
}

.pm-name {
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

.pm-role {
  text-align: center;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
  margin-top: -8px;
}

.pm-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pm-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border-light);
}

.pm-info-row:last-child {
  border-bottom: 0;
}

.pm-info-row dt {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.pm-info-row dd {
  font-size: 0.88rem;
  color: var(--color-text);
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

.pm-status {
  text-transform: capitalize;
}

.pm-status[data-status='ativo'] {
  color: #059669;
}

.pm-status[data-status='inativo'],
.pm-status[data-status='desligado'] {
  color: #dc2626;
}

.pm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.pm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 110px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.pm-btn .material-symbols-rounded {
  font-size: 18px;
}

.pm-btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.pm-btn-primary:hover {
  opacity: 0.92;
}

.pm-btn-outline {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.pm-btn-outline:hover {
  background: var(--color-bg);
}

.pm-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: pm-spin 0.6s linear infinite;
}

.pm-loading .pm-spinner {
  border-color: rgba(0, 0, 0, 0.15);
  border-top-color: var(--color-primary);
}

@keyframes pm-spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (min-width: 769px) {
  .pm-overlay {
    align-items: center;
  }
  .pm-modal {
    border-radius: var(--radius-xl);
  }
}

@media (max-width: 480px) {
  .pm-actions {
    flex-direction: column-reverse;
  }
  .pm-btn {
    width: 100%;
  }
}
</style>
