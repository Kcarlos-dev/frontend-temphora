<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { userApi } from '@/services/api'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = ref({
  id_empresa: auth.empresaId != null ? String(auth.empresaId) : '',
  name: '',
  email: '',
  password: '',
  role: 'colaborador',
})

async function handleSubmit() {
  const idEmpresa = parseInt(form.value.id_empresa, 10)
  if (!idEmpresa || Number.isNaN(idEmpresa)) {
    errorMsg.value = 'Informe o ID da empresa.'
    return
  }
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await userApi.create(idEmpresa, {
      name: form.value.name.trim(),
      email: form.value.email.trim(),
      password: form.value.password,
      role: form.value.role,
    })
    successMsg.value = 'Usuário criado com sucesso.'
    form.value = {
      id_empresa: String(idEmpresa),
      name: '',
      email: '',
      password: '',
      role: 'colaborador',
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao criar usuário'
  } finally {
    saving.value = false
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
            Cria um usuário na API vinculado ao ID da empresa informado
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
          <div class="field">
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
            <p class="field-hint">Obrigatório na rota <code>POST /user/:id_empresa</code></p>
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
            <p class="field-hint">Não é permitido criar usuário com papel root pela API.</p>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner" />
              <span v-else>Criar usuário</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </AppLayout>
</template>

<style scoped>
.usuarios-page {
  max-width: 560px;
}

.page-header {
  margin-bottom: 20px;
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

.field-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: 6px;
  line-height: 1.4;
}

.field-hint code {
  font-size: 0.68rem;
  background: var(--color-border-light);
  padding: 2px 6px;
  border-radius: 4px;
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
</style>
