<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { empresaApi } from '@/services/api'
import type { Empresa } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import { maskCnpj, maskPhoneBr, normalizeEmail } from '@/utils/inputFormat'

const auth = useAuthStore()
const empresa = ref<Empresa | null>(null)
const loading = ref(true)
const editMode = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = ref({
  enterprise: '',
  cnpj: '',
  email: '',
  phone: '',
})

function startEdit() {
  if (!empresa.value) return
  form.value = {
    enterprise: empresa.value.enterprise,
    cnpj: empresa.value.cnpj,
    email: empresa.value.email,
    phone: empresa.value.phone ?? '',
  }
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
  errorMsg.value = ''
}

function blurEmailEmpresa() {
  form.value.email = normalizeEmail(form.value.email)
}

async function handleSave() {
  if (!auth.empresaId) return
  saving.value = true
  errorMsg.value = ''
  form.value.email = normalizeEmail(form.value.email)
  try {
    const res = await empresaApi.update(auth.empresaId, form.value)
    empresa.value = res.data
    editMode.value = false
    successMsg.value = 'Dados da empresa atualizados!'
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!auth.empresaId) {
    loading.value = false
    return
  }
  try {
    const res = await empresaApi.get(auth.empresaId)
    empresa.value = res.data
  } catch {
    // silent
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="empresa-page">
      <header class="page-header">
        <div>
          <h1>Empresa</h1>
          <p class="page-subtitle">Informações da empresa</p>
        </div>
        <button v-if="!editMode && empresa" class="btn-outline" @click="startEdit">
          <span class="material-symbols-rounded">edit</span>
          <span class="btn-text">Editar</span>
        </button>
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

      <template v-else-if="empresa">
        <div v-if="!editMode" class="info-card">
          <div class="info-header">
            <div class="company-icon">
              <span class="material-symbols-rounded">business</span>
            </div>
            <div>
              <h2 class="company-name">{{ empresa.enterprise }}</h2>
              <span class="company-cnpj">CNPJ: {{ empresa.cnpj }}</span>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="material-symbols-rounded info-item-icon">mail</span>
              <div>
                <span class="info-label">Email</span>
                <span class="info-value">{{ empresa.email }}</span>
              </div>
            </div>
            <div class="info-item">
              <span class="material-symbols-rounded info-item-icon">phone</span>
              <div>
                <span class="info-label">Telefone</span>
                <span class="info-value">{{ empresa.phone || 'Não informado' }}</span>
              </div>
            </div>
          </div>
        </div>

        <form v-else class="edit-form" @submit.prevent="handleSave">
          <div class="form-card">
            <div class="field">
              <label for="enterprise">Nome da Empresa</label>
              <input id="enterprise" v-model="form.enterprise" required />
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
                @blur="blurEmailEmpresa"
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
              <button type="button" class="btn-outline" @click="cancelEdit">Cancelar</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner" />
                <span v-else>Salvar</span>
              </button>
            </div>
          </div>
        </form>
      </template>

      <div v-else class="empty-state">
        <span class="material-symbols-rounded empty-icon">business</span>
        <p>Nenhuma empresa vinculada</p>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.empresa-page {
  max-width: 600px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
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
  margin-top: 2px;
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text);
  transition: all 0.15s;
}

.btn-outline:hover { background: var(--color-bg); }
.btn-outline .material-symbols-rounded { font-size: 18px; }

.btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  transition: opacity 0.15s;
}

.btn-primary:hover { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

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

.alert.success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #059669; }
.alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
.alert .material-symbols-rounded { font-size: 18px; flex-shrink: 0; }
.alert-close { margin-left: auto; color: inherit; opacity: 0.6; }
.alert-close .material-symbols-rounded { font-size: 16px; }

.loading-state { display: flex; justify-content: center; padding: 60px 0; }
.spinner-lg { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.info-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid var(--color-border-light);
}

.company-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-lg);
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.company-icon .material-symbols-rounded {
  font-size: 26px;
  color: var(--color-primary);
}

.company-name {
  font-size: 1.15rem;
  font-weight: 700;
}

.company-cnpj {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.info-grid {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 14px;
}

.info-item-icon {
  font-size: 20px;
  color: var(--color-text-muted);
  width: 24px;
  text-align: center;
}

.info-label {
  display: block;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.9rem;
  font-weight: 500;
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
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}

.empty-state { text-align: center; padding: 50px 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.empty-icon { font-size: 40px; color: var(--color-text-muted); margin-bottom: 8px; }
.empty-state p { color: var(--color-text-secondary); font-size: 0.88rem; }

@media (max-width: 480px) {
  .btn-text { display: none; }
  .form-actions { flex-direction: column-reverse; }
  .form-actions .btn-outline,
  .form-actions .btn-primary { width: 100%; justify-content: center; }
}
</style>
