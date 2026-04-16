<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { atestadoApi } from '@/services/api'
import type { Atestado } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
const atestados = ref<Atestado[]>([])
const loading = ref(true)
const showModal = ref(false)
const editing = ref<Atestado | null>(null)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = ref({
  id_colaborador: auth.colaboradorId ?? 0,
  data_inicio: '',
  data_fim: '',
  arquivo: '',
  status: 'pendente',
})

const sortedAtestados = computed(() =>
  [...atestados.value].sort(
    (a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime(),
  ),
)

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    pendente: 'warning',
    aprovado: 'success',
    rejeitado: 'danger',
  }
  return map[status] ?? ''
}

function openNew() {
  editing.value = null
  form.value = {
    id_colaborador: auth.colaboradorId ?? 0,
    data_inicio: '',
    data_fim: '',
    arquivo: '',
    status: 'pendente',
  }
  showModal.value = true
}

function openEdit(atestado: Atestado) {
  editing.value = atestado
  form.value = {
    id_colaborador: atestado.id_colaborador,
    data_inicio: atestado.data_inicio.slice(0, 10),
    data_fim: atestado.data_fim.slice(0, 10),
    arquivo: atestado.arquivo ?? '',
    status: atestado.status,
  }
  showModal.value = true
}

async function handleSave() {
  if (!auth.empresaId) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      ...form.value,
      data_inicio: new Date(form.value.data_inicio).toISOString(),
      data_fim: new Date(form.value.data_fim).toISOString(),
    }
    if (editing.value) {
      await atestadoApi.update(auth.empresaId, editing.value.id, payload)
      successMsg.value = 'Atestado atualizado!'
    } else {
      await atestadoApi.create(auth.empresaId, payload)
      successMsg.value = 'Atestado criado!'
    }
    showModal.value = false
    await fetchAtestados()
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao salvar'
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: number) {
  if (!auth.empresaId || !confirm('Tem certeza que deseja excluir?')) return
  try {
    await atestadoApi.remove(auth.empresaId, id)
    await fetchAtestados()
    successMsg.value = 'Atestado excluído!'
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao excluir'
  }
}

async function fetchAtestados() {
  if (!auth.empresaId || !auth.colaboradorId) return
  try {
    const res = await atestadoApi.list(auth.empresaId, auth.colaboradorId)
    atestados.value = res.data
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

onMounted(fetchAtestados)
</script>

<template>
  <AppLayout>
    <div class="atestados-page">
      <header class="page-header">
        <div>
          <h1>Atestados</h1>
          <p class="page-subtitle">Gerencie atestados e certificados médicos</p>
        </div>
        <button class="btn-primary" @click="openNew">
          <span class="material-symbols-rounded">add</span>
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

      <div v-if="loading" class="loading-state">
        <span class="spinner-lg" />
      </div>

      <template v-else>
        <div v-if="sortedAtestados.length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">description</span>
          <p>Nenhum atestado encontrado</p>
        </div>

        <div v-else class="atestados-list">
          <div v-for="atestado in sortedAtestados" :key="atestado.id" class="atestado-card">
            <div class="atestado-top">
              <div class="atestado-icon">
                <span class="material-symbols-rounded">clinical_notes</span>
              </div>
              <div class="atestado-info">
                <div class="atestado-dates">
                  {{ formatDate(atestado.data_inicio) }} — {{ formatDate(atestado.data_fim) }}
                </div>
                <div v-if="atestado.arquivo" class="atestado-file">
                  <span class="material-symbols-rounded" style="font-size: 14px;">attach_file</span>
                  Documento anexado
                </div>
              </div>
              <span class="status-pill" :class="statusColor(atestado.status)">
                {{ atestado.status }}
              </span>
            </div>

            <div class="atestado-actions">
              <button
                v-if="auth.isAdmin"
                class="action-btn"
                @click="openEdit(atestado)"
              >
                <span class="material-symbols-rounded">edit</span>
                Editar
              </button>
              <button
                v-if="auth.isAdmin || auth.userRole === 'admin'"
                class="action-btn danger"
                @click="handleDelete(atestado.id)"
              >
                <span class="material-symbols-rounded">delete</span>
                Excluir
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
                <h3>{{ editing ? 'Editar' : 'Novo' }} Atestado</h3>
                <button class="modal-close" @click="showModal = false">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>

              <form @submit.prevent="handleSave" class="modal-body">
                <div class="field-row">
                  <div class="field">
                    <label for="data_inicio">Data Início</label>
                    <input id="data_inicio" v-model="form.data_inicio" type="date" required />
                  </div>
                  <div class="field">
                    <label for="data_fim">Data Fim</label>
                    <input id="data_fim" v-model="form.data_fim" type="date" required />
                  </div>
                </div>

                <div v-if="auth.isAdmin" class="field">
                  <label for="status">Status</label>
                  <select id="status" v-model="form.status">
                    <option value="pendente">Pendente</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="rejeitado">Rejeitado</option>
                  </select>
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
.atestados-page {
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

.loading-state { display: flex; justify-content: center; padding: 60px 0; }
.spinner-lg { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; padding: 50px 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
.empty-icon { font-size: 40px; color: var(--color-text-muted); margin-bottom: 8px; }
.empty-state p { color: var(--color-text-secondary); font-size: 0.88rem; }

.atestados-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.atestado-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
}

.atestado-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.atestado-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.atestado-icon .material-symbols-rounded {
  font-size: 20px;
  color: #6366f1;
}

.atestado-info {
  flex: 1;
  min-width: 0;
}

.atestado-dates {
  font-size: 0.88rem;
  font-weight: 600;
}

.atestado-file {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.status-pill {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
  text-transform: capitalize;
  flex-shrink: 0;
}

.status-pill.warning { background: #fef9c3; color: #ca8a04; }
.status-pill.success { background: #ecfdf5; color: #059669; }
.status-pill.danger { background: #fef2f2; color: #dc2626; }

.atestado-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-light);
  justify-content: flex-end;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.action-btn:hover { background: var(--color-bg); }
.action-btn.danger:hover { color: var(--color-danger); }
.action-btn .material-symbols-rounded { font-size: 16px; }

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
