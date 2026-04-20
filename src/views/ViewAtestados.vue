<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { atestadoApi, colaboradorApi } from '@/services/api'
import type { Atestado, Colaborador } from '@/types'
import {
  formatDataHoraLocal,
  fimDiaLocalFromInputDate,
  inicioDiaLocalFromInputDate,
} from '@/utils/datetime'
import { compressImageFileIfNeeded } from '@/utils/compressImage'
import AppLayout from '@/components/layout/AppLayout.vue'
import { maskCpf } from '@/utils/inputFormat'

const auth = useAuthStore()
const atestados = ref<Atestado[]>([])
const loading = ref(false)
const showModal = ref(false)
const editing = ref<Atestado | null>(null)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const cpfColaborador = ref<string | null>(null)
const cpfInput = ref('')
const arquivoNovo = ref<File | null>(null)

// Paginação server-side simples (default pageSize=10). A API devolve
// { data, page, pageSize, hasMore }.
const page = ref(1)
const pageSize = ref(10)
const hasMore = ref(false)

function apenasDigitosCpf(s: string) {
  return s.replace(/\D/g, '')
}

/** GET /colaborador/:id_empresa/:cpf — tenta só dígitos, depois o texto como digitado. */
async function buscarColaboradorPorCpfInformado(
  idEmpresa: number,
  digitos: string,
  textoBruto: string,
): Promise<Colaborador> {
  try {
    const res = await colaboradorApi.getByCpf(idEmpresa, digitos)
    return res.data
  } catch {
    if (textoBruto !== digitos) {
      try {
        const res = await colaboradorApi.getByCpf(idEmpresa, textoBruto)
        return res.data
      } catch {
        throw new Error('cpf_nao_encontrado')
      }
    }
    throw new Error('cpf_nao_encontrado')
  }
}

const precisaInformarCpf = computed(() => {
  if (!auth.empresaId || cpfColaborador.value || loading.value) return false
  if (auth.userRole === 'colaborador' && !auth.colaboradorId) return false
  return true
})

const temVinculoInvalido = computed(
  () => !auth.empresaId || (auth.userRole === 'colaborador' && !auth.colaboradorId),
)

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
  arquivoNovo.value = null
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

function onArquivoChange(e: Event) {
  const target = e.target as HTMLInputElement
  arquivoNovo.value = target.files?.[0] ?? null
}

async function handleSave() {
  if (!auth.empresaId || !auth.colaboradorId) return
  if (!editing.value && !arquivoNovo.value) {
    errorMsg.value = 'É obrigatório anexar o arquivo do atestado (imagem).'
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    if (editing.value) {
      const payload = {
        id_colaborador: form.value.id_colaborador,
        data_inicio: formatDataHoraLocal(inicioDiaLocalFromInputDate(form.value.data_inicio)),
        data_fim: formatDataHoraLocal(fimDiaLocalFromInputDate(form.value.data_fim)),
        arquivo: form.value.arquivo || null,
        status: form.value.status,
      }
      await atestadoApi.update(auth.empresaId, editing.value.id, payload)
      successMsg.value = 'Atestado atualizado!'
    } else {
      const fd = new FormData()
      fd.append('id_colaborador', String(auth.colaboradorId))
      fd.append(
        'data_inicio',
        formatDataHoraLocal(inicioDiaLocalFromInputDate(form.value.data_inicio)),
      )
      fd.append('data_fim', formatDataHoraLocal(fimDiaLocalFromInputDate(form.value.data_fim)))
      fd.append('status', form.value.status)
      const arquivo = await compressImageFileIfNeeded(arquivoNovo.value!)
      fd.append('arquivo', arquivo)
      await atestadoApi.create(auth.empresaId, auth.colaboradorId, fd)
      successMsg.value = 'Atestado criado!'
      arquivoNovo.value = null
    }
    showModal.value = false
    await loadAtestados({ resetPage: true })
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
    await loadAtestados()
    // Se a página atual ficou vazia mas ainda existe conteúdo antes, volta uma página.
    if (atestados.value.length === 0 && page.value > 1) {
      page.value -= 1
      await loadAtestados()
    }
    successMsg.value = 'Atestado excluído!'
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message ?? 'Erro ao excluir'
  }
}

async function loadAtestados(opts?: { resetPage?: boolean }) {
  if (!auth.empresaId || !cpfColaborador.value) return
  if (opts?.resetPage) page.value = 1
  loading.value = true
  try {
    const res = await atestadoApi.listByCpf(
      auth.empresaId,
      cpfColaborador.value,
      page.value,
      pageSize.value,
    )
    atestados.value = res.data.data
    hasMore.value = res.data.hasMore
  } catch (err: any) {
    // Mantido por retrocompatibilidade. Agora a API responde 200 com data:[]
    // quando não há atestados, mas se algum deploy antigo ainda devolver 404
    // a UI continua entendendo como "lista vazia".
    if (err.response?.status === 404) {
      atestados.value = []
      hasMore.value = false
    } else {
      errorMsg.value = err.response?.data?.message ?? 'Erro ao carregar atestados'
    }
  } finally {
    loading.value = false
  }
}

function goToPage(next: number) {
  if (next < 1) return
  if (next > page.value && !hasMore.value) return
  if (next === page.value) return
  page.value = next
  void loadAtestados()
}

async function confirmarCpf() {
  const bruto = cpfInput.value.trim()
  if (!bruto || !auth.empresaId) return
  if (auth.userRole === 'colaborador' && !auth.colaboradorId) return
  const digitos = apenasDigitosCpf(bruto)
  if (digitos.length !== 11) {
    errorMsg.value = 'Informe um CPF válido (11 dígitos).'
    return
  }

  loading.value = true
  errorMsg.value = ''
  try {
    const colab = await buscarColaboradorPorCpfInformado(auth.empresaId, digitos, bruto)

    if (colab.id_empresa !== auth.empresaId) {
      errorMsg.value = 'Este CPF não pertence à sua empresa.'
      return
    }

    if (auth.userRole === 'colaborador' && colab.id !== auth.colaboradorId) {
      errorMsg.value = 'Você só pode consultar atestados do seu próprio CPF.'
      return
    }

    cpfColaborador.value = colab.cpf?.trim() || digitos
    await loadAtestados({ resetPage: true })
  } catch (err: any) {
    if (err?.message === 'cpf_nao_encontrado') {
      errorMsg.value = 'CPF não encontrado no cadastro.'
    } else {
      errorMsg.value = err.response?.data?.message ?? 'Não foi possível validar o CPF.'
    }
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <AppLayout>
    <div class="atestados-page">
      <header class="page-header">
        <div>
          <h1>Atestados</h1>
          <p class="page-subtitle">Gerencie atestados e certificados médicos</p>
        </div>
        <button
          class="btn-primary"
          type="button"
          :disabled="!auth.empresaId || !auth.colaboradorId || !cpfColaborador"
          @click="openNew"
        >
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

      <div v-if="temVinculoInvalido" class="alert error">
        <span class="material-symbols-rounded">error</span>
        <span v-if="!auth.empresaId">É necessário vínculo com uma empresa.</span>
        <span v-else>Perfil colaborador precisa estar vinculado a um cadastro de colaborador.</span>
      </div>

      <div v-else-if="loading" class="loading-state">
        <span class="spinner-lg" />
      </div>

      <template v-else-if="precisaInformarCpf">
        <div class="cpf-gate">
          <p class="cpf-gate-title">CPF necessário para buscar atestados</p>
          <p class="cpf-gate-hint">
            Informe o CPF do colaborador cujos atestados deseja ver (validado em colaboradores). Admin, root e RH podem consultar qualquer CPF da empresa; colaborador só o próprio.
          </p>
          <div class="cpf-gate-row">
            <input
              v-model="cpfInput"
              v-maska="{ mask: maskCpf }"
              type="text"
              class="cpf-input"
              placeholder="000.000.000-00"
              inputmode="numeric"
              autocomplete="off"
            />
            <button type="button" class="btn-primary" @click="confirmarCpf">Carregar</button>
          </div>
        </div>
      </template>

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
                <div v-if="atestado.arquivo_url" class="atestado-preview">
                  <a
                    :href="atestado.arquivo_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="atestado-thumb-link"
                  >
                    <img :src="atestado.arquivo_url" alt="Anexo do atestado" class="atestado-thumb" />
                  </a>
                  <span class="atestado-file-label">Anexo</span>
                </div>
                <div v-else-if="atestado.arquivo" class="atestado-file">
                  <span class="material-symbols-rounded" style="font-size: 14px;">attach_file</span>
                  Documento anexado (URL indisponível)
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
                v-if="['admin', 'root'].includes(auth.userRole)"
                class="action-btn danger"
                @click="handleDelete(atestado.id)"
              >
                <span class="material-symbols-rounded">delete</span>
                Excluir
              </button>
            </div>
          </div>
        </div>

        <nav
          v-if="page > 1 || hasMore"
          class="pagination"
          aria-label="Paginação de atestados"
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

                <div v-if="!editing" class="field">
                  <label for="arquivo_atestado">Anexo do atestado (imagem, obrigatório)</label>
                  <input
                    id="arquivo_atestado"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    @change="onArquivoChange"
                  />
                  <p v-if="arquivoNovo" class="file-hint">{{ arquivoNovo.name }}</p>
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

.btn-primary:hover:not(:disabled) { opacity: 0.92; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary .material-symbols-rounded { font-size: 18px; }

.cpf-gate {
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
}

.cpf-gate-title {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 6px;
}

.cpf-gate-hint {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  margin-bottom: 14px;
  line-height: 1.4;
}

.cpf-gate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.cpf-input {
  flex: 1;
  min-width: 180px;
  padding: 11px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  font-size: 0.88rem;
}

.file-hint {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  margin-top: 6px;
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
  background: var(--color-tint-brand-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.atestado-icon .material-symbols-rounded {
  font-size: 20px;
  color: var(--color-tint-brand-fg);
}

.atestado-info {
  flex: 1;
  min-width: 0;
}

.atestado-dates {
  font-size: 0.88rem;
  font-weight: 600;
}

.atestado-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.atestado-thumb-link {
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
}

.atestado-thumb {
  display: block;
  width: 72px;
  height: 72px;
  object-fit: cover;
}

.atestado-file-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
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
