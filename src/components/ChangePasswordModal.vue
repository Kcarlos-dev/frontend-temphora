<script setup lang="ts">
import { ref, watch } from 'vue'
import { userApi } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const auth = useAuthStore()

const newPassword = ref('')
const confirmPassword = ref('')
const showNew = ref(false)
const showConfirm = ref(false)

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

function close() {
  if (saving.value) return
  emit('update:modelValue', false)
}

function resetForm() {
  newPassword.value = ''
  confirmPassword.value = ''
  showNew.value = false
  showConfirm.value = false
  errorMsg.value = ''
  successMsg.value = ''
  saving.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetForm()
    }
  },
)

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!newPassword.value || !confirmPassword.value) {
    errorMsg.value = 'Preencha todos os campos.'
    return
  }
  if (newPassword.value.length < 6) {
    errorMsg.value = 'A nova senha deve ter pelo menos 6 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMsg.value = 'A confirmação não confere com a nova senha.'
    return
  }

  const email = auth.userName
  const idEmpresa = auth.empresaId
  if (!email || !idEmpresa) {
    errorMsg.value = 'Sessão inválida. Faça login novamente.'
    return
  }

  saving.value = true
  try {
    await userApi.updatePassword(idEmpresa, {
      email,
      password: newPassword.value,
    })
    successMsg.value = 'Senha alterada com sucesso!'
    setTimeout(() => {
      emit('update:modelValue', false)
    }, 900)
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao alterar a senha.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="cp-overlay"
      >
        <div class="cp-modal" role="dialog" aria-modal="true" aria-labelledby="cp-title">
          <div class="cp-header">
            <h3 id="cp-title">Alterar senha</h3>
            <button
              type="button"
              class="cp-close"
              :disabled="saving"
              aria-label="Fechar"
              @click="close"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>

          <form class="cp-body" @submit.prevent="handleSubmit">
            <div v-if="successMsg" class="cp-alert success">
              <span class="material-symbols-rounded">check_circle</span>
              {{ successMsg }}
            </div>
            <div v-if="errorMsg" class="cp-alert error">
              <span class="material-symbols-rounded">error</span>
              {{ errorMsg }}
            </div>

            <div class="cp-field">
              <label for="cp-new">Nova senha</label>
              <div class="cp-input-wrapper">
                <input
                  id="cp-new"
                  v-model="newPassword"
                  :type="showNew ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="6"
                  required
                />
                <button
                  type="button"
                  class="cp-toggle"
                  tabindex="-1"
                  :aria-label="showNew ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showNew = !showNew"
                >
                  <span class="material-symbols-rounded">
                    {{ showNew ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
              <p class="cp-hint">Mínimo de 6 caracteres.</p>
            </div>

            <div class="cp-field">
              <label for="cp-confirm">Confirmar nova senha</label>
              <div class="cp-input-wrapper">
                <input
                  id="cp-confirm"
                  v-model="confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  autocomplete="new-password"
                  minlength="6"
                  required
                />
                <button
                  type="button"
                  class="cp-toggle"
                  tabindex="-1"
                  :aria-label="showConfirm ? 'Ocultar senha' : 'Mostrar senha'"
                  @click="showConfirm = !showConfirm"
                >
                  <span class="material-symbols-rounded">
                    {{ showConfirm ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <div class="cp-actions">
              <button
                type="button"
                class="cp-btn cp-btn-outline"
                :disabled="saving"
                @click="close"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="cp-btn cp-btn-primary"
                :disabled="saving"
              >
                <span v-if="saving" class="cp-spinner" />
                <span v-else>Salvar</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 300;
  padding: 16px;
}

.cp-modal {
  background: var(--color-surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  width: 100%;
  max-width: 460px;
  max-height: 90vh;
  overflow-y: auto;
}

.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 0;
}

.cp-header h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.cp-close {
  color: var(--color-text-muted);
  padding: 4px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.cp-close .material-symbols-rounded {
  font-size: 20px;
}

.cp-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cp-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
}

.cp-alert.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #059669;
}

.cp-alert.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.cp-alert .material-symbols-rounded {
  font-size: 18px;
  flex-shrink: 0;
}

.cp-field label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.cp-input-wrapper {
  position: relative;
}

.cp-field input {
  width: 100%;
  padding: 11px 44px 11px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.9rem;
  color: var(--color-text);
  transition: all 0.15s;
}

.cp-field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
  background: var(--color-surface);
}

.cp-toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  padding: 6px;
  background: transparent;
  border: 0;
  cursor: pointer;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.cp-toggle:hover {
  background: var(--color-border-light);
}

.cp-toggle .material-symbols-rounded {
  font-size: 18px;
}

.cp-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.cp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.cp-btn {
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

.cp-btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.cp-btn-primary:hover {
  opacity: 0.92;
}

.cp-btn-outline {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}

.cp-btn-outline:hover {
  background: var(--color-bg);
}

.cp-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cp-spin 0.6s linear infinite;
}

@keyframes cp-spin {
  to { transform: rotate(360deg); }
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
  .cp-overlay {
    align-items: center;
  }
  .cp-modal {
    border-radius: var(--radius-xl);
  }
}

@media (max-width: 480px) {
  .cp-actions {
    flex-direction: column-reverse;
  }
  .cp-btn {
    width: 100%;
  }
}
</style>
