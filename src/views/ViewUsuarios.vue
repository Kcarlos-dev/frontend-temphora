<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/services/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import { normalizeEmail } from '@/utils/inputFormat'
import type { User } from '@/types'

const auth = useAuthStore()

const isRoot = computed(() => auth.userRole === 'root')

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// Últimos 5 usuários criados nesta sessão. Fica só em memória: some ao
// recarregar a página ou trocar de rota. Serve de "cola" para o admin
// lembrar o id_user ao associar um colaborador logo em seguida.
const MAX_RECENT = 5
const recentUsers = ref<Array<User & { id_empresa: number }>>([])

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
    recentUsers.value = [
      { ...created, id_empresa: idEmpresa },
      ...recentUsers.value,
    ].slice(0, MAX_RECENT)

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
</script>

<template>
  <AppLayout>
    <div class="usuarios-page">
      <header class="page-header">
        <div>
          <h1>Novo usuário</h1>
          <p class="page-subtitle">
            Cria um usuário na sua empresa. Após criar, use o ID retornado para
            associar ao colaborador.
          </p>
        </div>
      </header>

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

      <section v-if="recentUsers.length" class="recent-card">
        <header class="recent-header">
          <h2>Criados nesta sessão</h2>
          <p class="recent-subtitle">
            Os {{ MAX_RECENT }} últimos usuários criados aqui. A lista some ao
            recarregar a página.
          </p>
        </header>
        <ul class="recent-list">
          <li v-for="u in recentUsers" :key="u.id" class="recent-item">
            <div class="recent-main">
              <div class="recent-name">{{ u.name }}</div>
              <div class="recent-email">{{ u.email }}</div>
            </div>
            <div class="recent-meta">
              <span class="recent-role" :data-role="u.role">{{ u.role }}</span>
              <button
                type="button"
                class="recent-id"
                :title="'Copiar ID ' + u.id"
                @click="copyId(u.id)"
              >
                <span class="material-symbols-rounded">badge</span>
                <span>ID {{ u.id }}</span>
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

.recent-header h2 {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
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
}
</style>
