<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRecentUsersStore } from '@/stores/recentUsers'
import { colaboradorApi } from '@/services/api'
import type { Colaborador } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import { maskCpf, maskPhoneBr, onlyDigits } from '@/utils/inputFormat'

const auth = useAuthStore()
const recent = useRecentUsersStore()
const colaboradores = ref<Colaborador[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref('todos')
const showModal = ref(false)
const editing = ref<Colaborador | null>(null)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// Paginação server-side simples (default pageSize=10). A busca/filtro por status
// acontecem em cima da página carregada — por isso mantemos um pageSize baixo
// e botões de "Anterior / Próxima" para navegar entre páginas.
const page = ref(1)
const pageSize = ref(10)
const hasMore = ref(false)

/** Admin/RH: empresa vem do login. Root: escolhe o ID da empresa no formulário. */
const empresaReadonly = computed(() => auth.empresaId != null && !auth.isRoot)

const statusOptions: { value: Colaborador['status']; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'ferias', label: 'Férias' },
  { value: 'desligado', label: 'Desligado' },
]

const form = ref({
  full_name: '',
  cpf: '',
  phone: '',
  position: '',
  id_empresa: auth.empresaId != null ? String(auth.empresaId) : '',
  id_user: '',
  status: 'ativo' as Colaborador['status'],
})

function resolveEmpresaIdAlvo(): number {
  if (empresaReadonly.value && auth.empresaId != null) {
    return auth.empresaId
  }
  // input type="number" pode deixar id_empresa como number — não usar .trim() direto
  const n = parseInt(String(form.value.id_empresa ?? '').trim(), 10)
  return !Number.isNaN(n) && n > 0 ? n : 0
}

/**
 * Usuários recém-criados (persistidos em localStorage pelo store) que fazem
 * sentido para a empresa atualmente escolhida no form. Root pode ver todos
 * enquanto o campo de empresa estiver vazio — assim que ele preenche um ID,
 * filtramos para esse ID.
 */
const recentUsersForForm = computed(() => {
  const empresaAlvo = resolveEmpresaIdAlvo()
  if (!empresaAlvo) return recent.items
  return recent.items.filter((u) => u.id_empresa === empresaAlvo)
})

function pickRecentUser(id: number) {
  form.value.id_user = String(id)
}

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
    id_empresa:
      auth.empresaId != null ? String(auth.empresaId) : '',
    id_user: '',
    status: 'ativo',
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
    id_empresa: String(colab.id_empresa),
    id_user: String(colab.id_user),
    status: colab.status,
  }
  showModal.value = true
}

async function handleSave() {
  const idEmpresaAlvo = resolveEmpresaIdAlvo()
  if (!idEmpresaAlvo) {
    errorMsg.value = 'Informe o ID da empresa.'
    return
  }

  const idUser = parseInt(String(form.value.id_user).trim(), 10)
  if (!Number.isFinite(idUser) || idUser < 1) {
    errorMsg.value = 'Informe o ID do usuário (inteiro válido, tabela users).'
    return
  }

  saving.value = true
  errorMsg.value = ''
  const cpfDigits = onlyDigits(form.value.cpf)
  const phoneDigits = onlyDigits(form.value.phone)
  const payload = {
    id_empresa: idEmpresaAlvo,
    id_user: idUser,
    full_name: form.value.full_name.trim(),
    cpf: cpfDigits || undefined,
    phone: phoneDigits || undefined,
    position: form.value.position.trim() || undefined,
    status: form.value.status,
  }
  try {
    if (editing.value) {
      await colaboradorApi.update(idEmpresaAlvo, editing.value.id, payload)
      successMsg.value = 'Colaborador atualizado!'
    } else {
      await colaboradorApi.create(idEmpresaAlvo, payload)
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
  loading.value = true
  try {
    const res = await colaboradorApi.list(auth.empresaId, page.value, pageSize.value)
    colaboradores.value = res.data.data
    hasMore.value = res.data.hasMore
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

function goToPage(next: number) {
  if (next < 1) return
  if (next > page.value && !hasMore.value) return
  if (next === page.value) return
  page.value = next
  void fetchColaboradores()
}

onMounted(async () => {
  if (auth.empresaId && !auth.empresa) {
    await auth.fetchEmpresa()
  }
  await fetchColaboradores()
})
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

        <nav
          v-if="page > 1 || hasMore"
          class="pagination"
          aria-label="Paginação de colaboradores"
        >
          <button
            type="button"
            class="btn-outline pagination-btn"
            :disabled="page <= 1 || loading"
            @click="goToPage(page - 1)"
          >
            <span class="material-symbols-rounded">chevron_left</span>
            <span class="btn-text">Anterior</span>
          </button>
          <span class="pagination-info">
            Página <strong>{{ page }}</strong>
          </span>
          <button
            type="button"
            class="btn-outline pagination-btn"
            :disabled="!hasMore || loading"
            @click="goToPage(page + 1)"
          >
            <span class="btn-text">Próxima</span>
            <span class="material-symbols-rounded">chevron_right</span>
          </button>
        </nav>
      </template>

      <!-- Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showModal" class="modal-overlay">
            <div class="modal">
              <div class="modal-header">
                <h3>{{ editing ? 'Editar' : 'Novo' }} Colaborador</h3>
                <button class="modal-close" @click="showModal = false">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>

              <form @submit.prevent="handleSave" class="modal-body">
                <div v-if="empresaReadonly" class="field field-readonly">
                  <label>Empresa</label>
                  <div class="readonly-box">
                    <span class="material-symbols-rounded readonly-icon">business</span>
                    <div class="readonly-text">
                      <span class="readonly-main">{{
                        auth.empresa?.enterprise ?? 'Sua empresa'
                      }}</span>
                      <span class="readonly-sub">ID: {{ auth.empresaId }}</span>
                    </div>
                  </div>
                </div>

                <div v-else class="field">
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
                    Mesmo valor usado na URL da API (<code>/colaborador/:id_empresa</code>).
                  </p>
                </div>

                <div class="field">
                  <label for="id_user">ID do usuário</label>
                  <input
                    id="id_user"
                    v-model="form.id_user"
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="ID na tabela users"
                  />
                  <p class="field-hint">
                    Colaborador fica vinculado a um usuário já existente (campo obrigatório na API).
                  </p>

                  <div v-if="recentUsersForForm.length" class="recent-suggest">
                    <div class="recent-suggest-header">
                      <span class="material-symbols-rounded">history</span>
                      <span>Criados recentemente</span>
                    </div>
                    <ul class="recent-suggest-list">
                      <li
                        v-for="u in recentUsersForForm"
                        :key="u.id"
                        class="recent-suggest-item"
                        :class="{ active: String(u.id) === String(form.id_user) }"
                      >
                        <button
                          type="button"
                          class="recent-suggest-btn"
                          :title="'Usar ID ' + u.id"
                          @click="pickRecentUser(u.id)"
                        >
                          <span class="recent-suggest-id">#{{ u.id }}</span>
                          <span class="recent-suggest-info">
                            <span class="recent-suggest-name">{{ u.name }}</span>
                            <span class="recent-suggest-email">{{ u.email }}</span>
                          </span>
                          <span
                            class="recent-suggest-role"
                            :data-role="u.role"
                          >{{ u.role }}</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>

                <div class="field">
                  <label for="fullname">Nome completo</label>
                  <input id="fullname" v-model="form.full_name" required placeholder="Nome completo" />
                </div>

                <div class="field">
                  <label for="cpf">CPF</label>
                  <input
                    id="cpf"
                    v-model="form.cpf"
                    v-maska="{ mask: maskCpf }"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div class="field-row">
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
                  <div class="field">
                    <label for="position">Cargo</label>
                    <input id="position" v-model="form.position" placeholder="Cargo" />
                  </div>
                </div>

                <div class="field">
                  <label for="colab-status">Status</label>
                  <select id="colab-status" v-model="form.status" required>
                    <option v-for="s in statusOptions" :key="s.value" :value="s.value">
                      {{ s.label }}
                    </option>
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
.status-badge.ferias { background: var(--color-tint-brand-bg); color: var(--color-tint-brand-fg); }
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.pagination-info {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--color-bg);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn .material-symbols-rounded { font-size: 18px; }

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

.field select {
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
  color: var(--color-text);
  transition: all 0.15s;
  cursor: pointer;
}

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

.readonly-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.readonly-icon {
  font-size: 24px;
  color: var(--color-primary);
}

.readonly-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.readonly-main {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.readonly-sub {
  font-size: 0.75rem;
  color: var(--color-text-muted);
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

.recent-suggest {
  margin-top: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
  background: var(--color-bg);
}

.recent-suggest-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.recent-suggest-header .material-symbols-rounded {
  font-size: 16px;
}

.recent-suggest-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-suggest-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.recent-suggest-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-surface);
  transform: translateY(-1px);
}

.recent-suggest-item.active .recent-suggest-btn {
  border-color: var(--color-primary);
  background: #eef2ff;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.12);
}

.recent-suggest-id {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--color-primary);
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef2ff;
  flex-shrink: 0;
}

.recent-suggest-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.recent-suggest-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-suggest-email {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-suggest-role {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--color-border-light);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.recent-suggest-role[data-role='admin'] {
  background: #fef3c7;
  color: #92400e;
}

.recent-suggest-role[data-role='rh'] {
  background: #dbeafe;
  color: #1e40af;
}

.recent-suggest-role[data-role='colaborador'] {
  background: #dcfce7;
  color: #166534;
}
</style>
