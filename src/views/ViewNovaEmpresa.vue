<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { empresaApi } from '@/services/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import { maskCnpj, maskPhoneBr, normalizeEmail } from '@/utils/inputFormat'

const router = useRouter()

const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const createdId = ref<number | null>(null)

const form = ref({
  enterprise: '',
  cnpj: '',
  email: '',
  phone: '',
})

function blurEmail() {
  form.value.email = normalizeEmail(form.value.email)
}

async function handleSubmit() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  createdId.value = null
  form.value.email = normalizeEmail(form.value.email)
  const phone = form.value.phone.trim()
  try {
    const res = await empresaApi.create({
      enterprise: form.value.enterprise.trim(),
      cnpj: form.value.cnpj.trim(),
      email: form.value.email,
      phone: phone || null,
    })
    createdId.value = res.data.id
    successMsg.value = `Empresa "${res.data.enterprise}" criada com sucesso.`
    form.value = {
      enterprise: '',
      cnpj: '',
      email: '',
      phone: '',
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao criar empresa'
  } finally {
    saving.value = false
  }
}

function irParaUsuarios() {
  router.push('/usuarios')
}
</script>

<template>
  <AppLayout>
    <div class="nova-empresa-page">
      <header class="page-header">
        <div>
          <h1>Nova empresa</h1>
          <p class="page-subtitle">
            Cadastro exclusivo para root — corresponde a <code>POST /empresa</code>
          </p>
        </div>
      </header>

      <div v-if="successMsg" class="alert success">
        <span class="material-symbols-rounded">check_circle</span>
        <div class="alert-body">
          <span>{{ successMsg }}</span>
          <p v-if="createdId != null" class="alert-id">
            ID da empresa: <strong>{{ createdId }}</strong> — use ao criar usuários e colaboradores.
          </p>
          <button type="button" class="link-btn" @click="irParaUsuarios">
            Ir para cadastro de usuários
          </button>
        </div>
        <button class="alert-close" type="button" @click="successMsg = ''; createdId = null">
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
            <label for="enterprise">Nome da empresa</label>
            <input
              id="enterprise"
              v-model="form.enterprise"
              required
              autocomplete="organization"
              placeholder="Razão social ou nome fantasia"
            />
          </div>
          <div class="field">
            <label for="cnpj">CNPJ</label>
            <input
              id="cnpj"
              v-model="form.cnpj"
              v-maska="{ mask: maskCnpj }"
              type="text"
              inputmode="numeric"
              required
              placeholder="00.000.000/0000-00"
            />
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
              placeholder="contato@empresa.com.br"
              @blur="blurEmail"
            />
          </div>
          <div class="field">
            <label for="phone">Telefone</label>
            <input
              id="phone"
              v-model="form.phone"
              v-maska="{ mask: maskPhoneBr }"
              type="text"
              inputmode="tel"
              autocomplete="tel"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saving">
              <span v-if="saving" class="spinner" />
              <span v-else>Criar empresa</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </AppLayout>
</template>

<style scoped>
.nova-empresa-page {
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

.page-subtitle code {
  font-size: 0.72rem;
  background: var(--color-border-light);
  padding: 2px 6px;
  border-radius: 4px;
}

.alert {
  display: flex;
  align-items: flex-start;
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
  margin-top: 2px;
}

.alert-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.alert-id {
  font-size: 0.8rem;
  margin: 0;
  color: #047857;
  line-height: 1.4;
}

.link-btn {
  align-self: flex-start;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-primary);
  text-decoration: underline;
  padding: 0;
}

.link-btn:hover {
  opacity: 0.9;
}

.alert-close {
  margin-left: auto;
  color: inherit;
  opacity: 0.6;
  flex-shrink: 0;
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

.field input {
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  transition: all 0.15s;
}

.field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
  background: var(--color-surface);
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
