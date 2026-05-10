<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRecentUsersStore } from '@/stores/recentUsers'
import { userApi } from '@/services/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import { normalizeEmail } from '@/utils/inputFormat'

const auth = useAuthStore()
const recent = useRecentUsersStore()

const isRoot = computed(() => auth.userRole === 'root')

type Tab = 'create' | 'reset'
const tab = ref<Tab>('create')

// ---- Criar usuário ----
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

function initialForm() {
  return {
    // Para root o campo é editável (o token não tem empresa vinculada).
    // Para admin/rh/colaborador, usa o id_empresa do JWT — o campo some do form.
    id_empresa: auth.empresaId != null ? String(auth.empresaId) : '',
    name: '',
    email: '',
    password: '',
    role: 'colaborador',
  }
}

const form = ref(initialForm())

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''

  const idEmpresa = isRoot.value
    ? parseInt(form.value.id_empresa, 10)
    : (auth.empresaId ?? NaN)

  if (!idEmpresa || Number.isNaN(idEmpresa)) {
    errorMsg.value = isRoot.value
      ? 'Informe o ID da empresa.'
      : 'Sua sessão não possui empresa vinculada. Faça login novamente.'
    return
  }

  saving.value = true
  try {
    const res = await userApi.create(idEmpresa, {
      name: form.value.name.trim(),
      email: normalizeEmail(form.value.email),
      password: form.value.password,
      role: form.value.role,
    })

    const created = res.data.user
    recent.add(created, idEmpresa)

    successMsg.value = `Usuário criado (id ${created.id}). Use esse ID ao associar ao colaborador.`

    form.value = {
      ...initialForm(),
      id_empresa: String(idEmpresa),
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao criar usuário'
  } finally {
    saving.value = false
  }
}

async function copyId(id: number) {
  try {
    await navigator.clipboard.writeText(String(id))
    successMsg.value = `ID ${id} copiado para a área de transferência.`
    setTimeout(() => {
      if (successMsg.value.startsWith(`ID ${id}`)) successMsg.value = ''
    }, 1800)
  } catch {
    // sem permissão de clipboard (iOS Safari em alguns contextos) — ignora.
  }
}

// ---- Redefinir senha ----
// Estado separado do form de criação para não misturar mensagens de erro/sucesso
// e poder ter loading independente.
const resetSaving = ref(false)
const resetErrorMsg = ref('')
const resetSuccessMsg = ref('')
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

function initialResetForm() {
  return {
    id_empresa: auth.empresaId != null ? String(auth.empresaId) : '',
    email: '',
    password: '',
    confirmPassword: '',
  }
}

const resetForm = ref(initialResetForm())

function pickRecentEmail(email: string) {
  resetForm.value.email = email
}

async function handleResetPassword() {
  resetErrorMsg.value = ''
  resetSuccessMsg.value = ''

  const idEmpresa = isRoot.value
    ? parseInt(resetForm.value.id_empresa, 10)
    : (auth.empresaId ?? NaN)

  if (!idEmpresa || Number.isNaN(idEmpresa)) {
    resetErrorMsg.value = isRoot.value
      ? 'Informe o ID da empresa.'
      : 'Sua sessão não possui empresa vinculada. Faça login novamente.'
    return
  }

  const email = normalizeEmail(resetForm.value.email)
  if (!email) {
    resetErrorMsg.value = 'Informe o email do usuário.'
    return
  }
  if (!resetForm.value.password || resetForm.value.password.length < 6) {
    resetErrorMsg.value = 'A nova senha deve ter pelo menos 6 caracteres.'
    return
  }
  if (resetForm.value.password !== resetForm.value.confirmPassword) {
    resetErrorMsg.value = 'A confirmação não confere com a nova senha.'
    return
  }

  resetSaving.value = true
  try {
    await userApi.updatePassword(idEmpresa, {
      email,
      password: resetForm.value.password,
    })
    resetSuccessMsg.value = `Senha de ${email} atualizada com sucesso.`
    resetForm.value = {
      ...initialResetForm(),
      id_empresa: String(idEmpresa),
    }
    showNewPassword.value = false
    showConfirmPassword.value = false
  } catch (err: any) {
    const status = err.response?.status
    if (status === 404) {
      resetErrorMsg.value =
        'Usuário não encontrado ou não pertence à sua empresa.'
    } else {
      resetErrorMsg.value =
        err.response?.data?.message ?? 'Erro ao redefinir senha.'
    }
  } finally {
    resetSaving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="usuarios-page">
      <header class="page-header">
        <div>
          <h1>Gerenciar usuários</h1>
          <p class="page-subtitle">
            Crie novos usuários para associar a colaboradores ou redefina a
            senha de um usuário já cadastrado na sua empresa.
          </p>
        </div>
      </header>

      <nav class="tabs" role="tablist" aria-label="Ações de usuários">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'create'"
          class="tab-btn"
          :class="{ active: tab === 'create' }"
          @click="tab = 'create'"
        >
          <span class="material-symbols-rounded">person_add</span>
          <span>Criar usuário</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'reset'"
          class="tab-btn"
          :class="{ active: tab === 'reset' }"
          @click="tab = 'reset'"
        >
          <span class="material-symbols-rounded">key</span>
          <span>Redefinir senha</span>
        </button>
      </nav>

      <!-- ============ Aba: Criar usuário ============ -->
      <template v-if="tab === 'create'">
        <div v-if="successMsg" class="alert success">
          <span class="material-symbols-rounded">check_circle</span>
          {{ successMsg }}
          <button class="alert-close" type="button" @click="successMsg = ''">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div v-if="errorMsg" class="alert error">
          <span class="material-symbols-rounded">error</span>
          {{ errorMsg }}
          <button class="alert-close" type="button" @click="errorMsg = ''">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <form class="user-form" @submit.prevent="handleSubmit">
          <div class="form-card">
            <div v-if="isRoot" class="field">
              <label for="id_empresa">ID da empresa</label>
              <input
                id="id_empresa"
                v-model="form.id_empresa"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Ex.: 1"
              />
              <p class="field-hint">
                Como root, você escolhe a empresa. Admin/RH usam automaticamente a
                própria empresa.
              </p>
            </div>
            <div v-else class="field field-readonly">
              <label>Empresa</label>
              <div class="readonly-value">
                <span class="material-symbols-rounded">business</span>
                <span>ID {{ auth.empresaId ?? '—' }}</span>
              </div>
              <p class="field-hint">
                Preenchido automaticamente com base no seu login.
              </p>
            </div>

            <div class="field">
              <label for="name">Nome</label>
              <input id="name" v-model="form.name" required autocomplete="name" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input
                id="email"
                v-model="form.email"
                type="email"
                required
                autocomplete="email"
                inputmode="email"
                autocapitalize="off"
                spellcheck="false"
                placeholder="nome@empresa.com"
                @blur="form.email = normalizeEmail(form.email)"
              />
            </div>
            <div class="field">
              <label for="password">Senha</label>
              <input
                id="password"
                v-model="form.password"
                type="password"
                required
                minlength="6"
                autocomplete="new-password"
              />
            </div>
            <div class="field">
              <label for="role">Papel</label>
              <select id="role" v-model="form.role" required>
                <option value="admin">admin</option>
                <option value="rh">rh</option>
                <option value="colaborador">colaborador</option>
                <option value="kiosk">kiosk</option>
              </select>
              <p class="field-hint">
                Não é permitido criar usuário com papel root pela API.
              </p>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner" />
                <span v-else>Criar usuário</span>
              </button>
            </div>
          </div>
        </form>
      </template>

      <!-- ============ Aba: Redefinir senha ============ -->
      <template v-else>
        <div v-if="resetSuccessMsg" class="alert success">
          <span class="material-symbols-rounded">check_circle</span>
          {{ resetSuccessMsg }}
          <button class="alert-close" type="button" @click="resetSuccessMsg = ''">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div v-if="resetErrorMsg" class="alert error">
          <span class="material-symbols-rounded">error</span>
          {{ resetErrorMsg }}
          <button class="alert-close" type="button" @click="resetErrorMsg = ''">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div class="info-box">
          <span class="material-symbols-rounded info-icon">info</span>
          <div>
            <p class="info-title">Sobre a redefinição de senha</p>
            <p class="info-text">
              O usuário precisa estar cadastrado na sua empresa. A senha antiga
              será substituída imediatamente — avise o colaborador. A operação
              é registrada no backend e só permite usuários da sua empresa.
            </p>
          </div>
        </div>

        <form class="user-form" @submit.prevent="handleResetPassword">
          <div class="form-card">
            <div v-if="isRoot" class="field">
              <label for="reset_id_empresa">ID da empresa</label>
              <input
                id="reset_id_empresa"
                v-model="resetForm.id_empresa"
                type="number"
                min="1"
                step="1"
                required
                placeholder="Ex.: 1"
              />
              <p class="field-hint">
                Como root, informe a empresa do usuário alvo.
              </p>
            </div>
            <div v-else class="field field-readonly">
              <label>Empresa</label>
              <div class="readonly-value">
                <span class="material-symbols-rounded">business</span>
                <span>ID {{ auth.empresaId ?? '—' }}</span>
              </div>
              <p class="field-hint">
                Só é possível redefinir senha de usuários da sua empresa.
              </p>
            </div>

            <div class="field">
              <label for="reset_email">Email do usuário</label>
              <input
                id="reset_email"
                v-model="resetForm.email"
                type="email"
                required
                autocomplete="off"
                inputmode="email"
                autocapitalize="off"
                spellcheck="false"
                placeholder="colaborador@empresa.com"
                @blur="resetForm.email = normalizeEmail(resetForm.email)"
              />
              <p class="field-hint">
                Digite o email exatamente como cadastrado. Se você criou o
                usuário nesta sessão, clique em "Últimos criados" abaixo para
                preencher automaticamente.
              </p>
            </div>

            <div class="field">
              <label for="reset_password">Nova senha</label>
              <div class="password-wrapper">
                <input
                  id="reset_password"
                  v-model="resetForm.password"
                  :type="showNewPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  tabindex="-1"
                  :aria-label="
                    showNewPassword ? 'Ocultar senha' : 'Mostrar senha'
                  "
                  @click="showNewPassword = !showNewPassword"
                >
                  <span class="material-symbols-rounded">
                    {{ showNewPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
              <p class="field-hint">Mínimo de 6 caracteres.</p>
            </div>

            <div class="field">
              <label for="reset_confirm">Confirmar nova senha</label>
              <div class="password-wrapper">
                <input
                  id="reset_confirm"
                  v-model="resetForm.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="password-toggle"
                  tabindex="-1"
                  :aria-label="
                    showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'
                  "
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <span class="material-symbols-rounded">
                    {{ showConfirmPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <div class="form-actions">
              <button
                type="submit"
                class="btn-primary"
                :disabled="resetSaving"
              >
                <span v-if="resetSaving" class="spinner" />
                <span v-else>Redefinir senha</span>
              </button>
            </div>
          </div>
        </form>
      </template>

      <section v-if="recent.items.length" class="recent-card">
        <header class="recent-header">
          <div>
            <h2>Últimos criados</h2>
            <p class="recent-subtitle">
              <template v-if="tab === 'create'">
                Os {{ recent.max }} últimos usuários criados por você nesta
                sessão. Também aparecem na tela de colaboradores para facilitar
                a associação. A lista é descartada ao fechar a aba.
              </template>
              <template v-else>
                Clique em um usuário abaixo para preencher o email na
                redefinição de senha. A lista vive apenas na aba atual.
              </template>
            </p>
          </div>
          <button
            type="button"
            class="recent-clear"
            title="Limpar lista"
            @click="recent.clear()"
          >
            <span class="material-symbols-rounded">delete_sweep</span>
            <span>Limpar</span>
          </button>
        </header>
        <ul class="recent-list">
          <li v-for="u in recent.items" :key="u.id" class="recent-item">
            <div class="recent-main">
              <div class="recent-name">{{ u.name }}</div>
              <div class="recent-email">{{ u.email }}</div>
            </div>
            <div class="recent-meta">
              <span class="recent-role" :data-role="u.role">{{ u.role }}</span>
              <button
                v-if="tab === 'create'"
                type="button"
                class="recent-id"
                :title="'Copiar ID ' + u.id"
                @click="copyId(u.id)"
              >
                <span class="material-symbols-rounded">badge</span>
                <span>ID {{ u.id }}</span>
              </button>
              <button
                v-else
                type="button"
                class="recent-id"
                :title="'Usar email ' + u.email"
                @click="pickRecentEmail(u.email)"
              >
                <span class="material-symbols-rounded">alternate_email</span>
                <span>Usar email</span>
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.usuarios-page {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.page-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.45;
}

.tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.tab-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover:not(.active) {
  color: var(--color-text);
  background: var(--color-surface);
}

.tab-btn.active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--color-border);
}

.tab-btn .material-symbols-rounded {
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

.alert .material-symbols-rounded {
  font-size: 18px;
  flex-shrink: 0;
}

.alert-close {
  margin-left: auto;
  color: inherit;
  opacity: 0.6;
}

.alert-close .material-symbols-rounded {
  font-size: 16px;
}

.info-box {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.info-icon {
  font-size: 20px;
  color: var(--color-primary);
  flex-shrink: 0;
  margin-top: 1px;
}

.info-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 2px;
}

.info-text {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.form-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 6px;
}

.field input,
.field select {
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  transition: all 0.15s;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
  background: var(--color-surface);
}

.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 44px;
}

.password-toggle {
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

.password-toggle:hover {
  background: var(--color-border-light);
}

.password-toggle .material-symbols-rounded {
  font-size: 18px;
}

.field-readonly .readonly-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.field-readonly .material-symbols-rounded {
  font-size: 18px;
  color: var(--color-text-muted);
}

.field-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: 6px;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  transition: opacity 0.15s;
  min-width: 140px;
  border: 0;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.recent-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 20px 20px 10px;
}

.recent-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.recent-header h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.recent-clear {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.recent-clear:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.recent-clear .material-symbols-rounded {
  font-size: 16px;
}

.recent-subtitle {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-top: 2px;
  line-height: 1.4;
}

.recent-list {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--color-border-light);
}

.recent-item:first-child {
  border-top: 0;
}

.recent-main {
  min-width: 0;
  flex: 1;
}

.recent-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-email {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.recent-role {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--color-border-light);
  color: var(--color-text-secondary);
}

.recent-role[data-role='admin'] {
  background: #fef3c7;
  color: #92400e;
}

.recent-role[data-role='rh'] {
  background: #dbeafe;
  color: #1e40af;
}

.recent-role[data-role='colaborador'] {
  background: #dcfce7;
  color: #166534;
}

.recent-role[data-role='kiosk'] {
  background: #f3e8ff;
  color: #7e22ce;
}

.recent-id {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.recent-id:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.recent-id .material-symbols-rounded {
  font-size: 16px;
}

@media (max-width: 480px) {
  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .recent-meta {
    width: 100%;
    justify-content: space-between;
  }

  .tab-btn span:not(.material-symbols-rounded) {
    display: none;
  }
}
</style>
