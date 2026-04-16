<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { colaboradorApi } from '@/services/api'
import type { Colaborador } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
const colaboradores = ref<Colaborador[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref('todos')
const showModal = ref(false)
const editing = ref<Colaborador | null>(null)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = ref({
  full_name: '',
  cpf: '',
  phone: '',
  position: '',
  id_empresa: auth.empresaId ?? 0,
  id_user: 0,
})

const filtered = computed(() => {
  let list = colaboradores.value
  if (filterStatus.value !== 'todos') {
    list = list.filter((c) => c.status === filterStatus.value)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.cpf?.toLowerCase().includes(q) ||
        c.position?.toLowerCase().includes(q),
    )
  }
  return list
})

const statusCounts = computed(() => {
  const counts: Record<string, number> = { todos: colaboradores.value.length }
  for (const c of colaboradores.value) {
    counts[c.status] = (counts[c.status] ?? 0) + 1
  }
  return counts
})

function openNew() {
  editing.value = null
  form.value = {
    full_name: '',
    cpf: '',
    phone: '',
    position: '',
    id_empresa: auth.empresaId ?? 0,
    id_user: 0,
  }
  showModal.value = true
}

function openEdit(colab: Colaborador) {
  editing.value = colab
  form.value = {
    full_name: colab.full_name,
    cpf: colab.cpf ?? '',
    phone: colab.phone ?? '',
    position: colab.position ?? '',
    id_empresa: colab.id_empresa,
    id_user: colab.id_user,
  }
  showModal.value = true
}

async function handleSave() {
  if (!auth.empresaId) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (editing.value) {
      await colaboradorApi.update(auth.empresaId, editing.value.id, form.value)
      successMsg.value = 'Colaborador atualizado!'
    } else {
      await colaboradorApi.create(auth.empresaId, form.value)
      successMsg.value = 'Colaborador criado!'
    }
    showModal.value = false
    await fetchColaboradores()
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function toggleStatus(colab: Colaborador) {
  if (!auth.empresaId) return
  const newStatus = colab.status === 'ativo' ? 'inativo' : 'ativo'
  try {
    await colaboradorApi.updateStatus(auth.empresaId, colab.id, newStatus)
    await fetchColaboradores()
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao atualizar status'
  }
}

async function fetchColaboradores() {
  if (!auth.empresaId) return
  try {
    const res = await colaboradorApi.list(auth.empresaId)
    colaboradores.value = res.data
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

onMounted(fetchColaboradores)
</script>

<template>
  <AppLayout>
    <div class="colab-page">
      <header class="page-header">
        <div>
          <h1>Colaboradores</h1>
          <p class="page-subtitle">Gerencie sua equipe</p>
        </div>
        <button class="btn-primary" @click="openNew">
          <span class="material-symbols-rounded">person_add</span>
          <span class="btn-text">Novo</span>
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

      <div class="search-bar">
        <span class="material-symbols-rounded search-icon">search</span>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nome, CPF ou cargo..."
        />
      </div>

      <div class="filter-tabs">
        <button
          v-for="status in ['todos', 'ativo', 'inativo', 'ferias', 'desligado']"
          :key="status"
          class="filter-tab"
          :class="{ active: filterStatus === status }"
          @click="filterStatus = status"
        >
          {{ status === 'todos' ? 'Todos' : status }}
          <span class="tab-count">{{ statusCounts[status] ?? 0 }}</span>
        </button>
      </div>

      <div v-if="loading" class="loading-state">
        <span class="spinner-lg" />
      </div>

      <template v-else>
        <div v-if="filtered.length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">group_off</span>
          <p>Nenhum colaborador encontrado</p>
        </div>

        <div v-else class="colab-list">
          <div v-for="colab in filtered" :key="colab.id" class="colab-card">
            <div class="colab-main">
              <div class="colab-avatar">
                {{ colab.full_name.charAt(0).toUpperCase() }}
              </div>
              <div class="colab-info">
                <span class="colab-name">{{ colab.full_name }}</span>
                <span class="colab-detail">{{ colab.position ?? 'Sem cargo' }}</span>
                <span v-if="colab.cpf" class="colab-detail">CPF: {{ colab.cpf }}</span>
              </div>
              <span class="status-badge" :class="colab.status">
                {{ colab.status }}
              </span>
            </div>
            <div class="colab-actions">
              <button class="action-btn" @click="openEdit(colab)" title="Editar">
                <span class="material-symbols-rounded">edit</span>
              </button>
              <button
                class="action-btn"
                :class="colab.status === 'ativo' ? 'danger' : 'success'"
                @click="toggleStatus(colab)"
                :title="colab.status === 'ativo' ? 'Desativar' : 'Ativar'"
              >
                <span class="material-symbols-rounded">
                  {{ colab.status === 'ativo' ? 'person_off' : 'person_check' }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
            <div class="modal">
              <div class="modal-header">
                <h3>{{ editing ? 'Editar' : 'Novo' }} Colaborador</h3>
                <button class="modal-close" @click="showModal = false">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>

              <form @submit.prevent="handleSave" class="modal-body">
                <div class="field">
                  <label for="fullname">Nome Completo</label>
                  <input id="fullname" v-model="form.full_name" required placeholder="Nome completo" />
                </div>

                <div class="field">
                  <label for="cpf">CPF</label>
                  <input id="cpf" v-model="form.cpf" placeholder="000.000.000-00" />
                </div>

                <div class="field-row">
                  <div class="field">
                    <label for="phone">Telefone</label>
                    <input id="phone" v-model="form.phone" placeholder="(00) 00000-0000" />
                  </div>
                  <div class="field">
                    <label for="position">Cargo</label>
                    <input id="position" v-model="form.position" placeholder="Cargo" />
                  </div>
                </div>

                <button type="submit" class="btn-primary btn-full" :disabled="saving">
                  <span v-if="saving" class="spinner" />
                  <span v-else>{{ editing ? 'Salvar' : 'Criar' }}</span>
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
.colab-page {
  max-width: 800px;
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

.btn-primary .material-symbols-rounded { font-size: 18px; }

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

.search-bar {
  position: relative;
  margin-bottom: 12px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: var(--color-text-muted);
}

.search-bar input {
  width: 100%;
  padding: 11px 14px 11px 42px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: 0.88rem;
  transition: all 0.15s;
}

.search-bar input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.06);
}

.filter-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.filter-tab {
  padding: 7px 14px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  white-space: nowrap;
  text-transform: capitalize;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-tab.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.tab-count {
  font-size: 0.7rem;
  opacity: 0.7;
}

.loading-state { display: flex; justify-content: center; padding: 60px 0; }
.spinner-lg { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; padding: 50px 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.empty-icon { font-size: 40px; color: var(--color-text-muted); margin-bottom: 8px; }
.empty-state p { color: var(--color-text-secondary); font-size: 0.88rem; }

.colab-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.colab-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
}

.colab-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.colab-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
  flex-shrink: 0;
}

.colab-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.colab-name {
  font-weight: 600;
  font-size: 0.92rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.colab-detail {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: capitalize;
  flex-shrink: 0;
}

.status-badge.ativo { background: #ecfdf5; color: #059669; }
.status-badge.inativo { background: #fef2f2; color: #dc2626; }
.status-badge.ferias { background: #eff6ff; color: #2563eb; }
.status-badge.desligado { background: #f5f5f5; color: #737373; }

.colab-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-light);
  justify-content: flex-end;
}

.action-btn {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.action-btn:hover { background: var(--color-bg); }
.action-btn.danger:hover { color: var(--color-danger); }
.action-btn.success:hover { color: var(--color-success); }

.action-btn .material-symbols-rounded { font-size: 18px; }

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

.modal-header h3 { font-size: 1.1rem; font-weight: 700; }
.modal-close { color: var(--color-text-muted); padding: 4px; }

.modal-body {
  padding: 20px;
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

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-full { width: 100%; justify-content: center; padding: 13px; }

@media (min-width: 769px) {
  .modal-overlay { align-items: center; }
  .modal { border-radius: var(--radius-xl); }
}

@media (max-width: 480px) {
  .btn-text { display: none; }
  .field-row { grid-template-columns: 1fr; }
}
</style>
