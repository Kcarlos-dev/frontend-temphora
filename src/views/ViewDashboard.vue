<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { pontoApi, colaboradorApi, atestadoApi } from '@/services/api'
import type { Ponto, Colaborador } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
const pontos = ref<Ponto[]>([])
const colaboradores = ref<Colaborador[]>([])
const loading = ref(true)

const today = new Date()
const greeting = computed(() => {
  const hour = today.getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
})

const pontosHoje = computed(() =>
  pontos.value.filter((p) => {
    const d = new Date(p.data_hora)
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    )
  }),
)

const stats = computed(() => {
  const totalColab = colaboradores.value.length
  const ativos = colaboradores.value.filter((c) => c.status === 'ativo').length
  const registrosHoje = pontosHoje.value.length
  return { totalColab, ativos, registrosHoje }
})

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    entrada: 'Entrada',
    saida: 'Saída',
    inicio_intervalo: 'Início Intervalo',
    fim_intervalo: 'Fim Intervalo',
  }
  return map[tipo] ?? tipo
}

function tipoIcon(tipo: string) {
  const map: Record<string, string> = {
    entrada: 'login',
    saida: 'logout',
    inicio_intervalo: 'free_breakfast',
    fim_intervalo: 'restaurant',
  }
  return map[tipo] ?? 'schedule'
}

onMounted(async () => {
  try {
    if (auth.empresaId && auth.colaboradorId) {
      const [pontosRes] = await Promise.all([
        pontoApi.list(auth.empresaId, auth.colaboradorId),
      ])
      pontos.value = pontosRes.data
    }

    if (auth.isAdmin && auth.empresaId) {
      const colabRes = await colaboradorApi.list(auth.empresaId)
      colaboradores.value = colabRes.data
    }
  } catch {
    // handle silently
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AppLayout>
    <div class="dashboard">
      <header class="page-header">
        <div>
          <h1>{{ greeting }}!</h1>
          <p class="date-label">{{ formatDate(today) }}</p>
        </div>
      </header>

      <div v-if="loading" class="loading-state">
        <span class="spinner-lg" />
      </div>

      <template v-else>
        <div v-if="auth.isAdmin" class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background: #eef2ff">
              <span class="material-symbols-rounded" style="color: #6366f1">group</span>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.totalColab }}</span>
              <span class="stat-label">Colaboradores</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon" style="background: #ecfdf5">
              <span class="material-symbols-rounded" style="color: #10b981">check_circle</span>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.ativos }}</span>
              <span class="stat-label">Ativos</span>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon" style="background: #fef9c3">
              <span class="material-symbols-rounded" style="color: #ca8a04">schedule</span>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats.registrosHoje }}</span>
              <span class="stat-label">Registros Hoje</span>
            </div>
          </div>
        </div>

        <section class="section">
          <div class="section-header">
            <h2>Registros de Hoje</h2>
          </div>

          <div v-if="pontosHoje.length === 0" class="empty-state">
            <span class="material-symbols-rounded empty-icon">event_busy</span>
            <p>Nenhum registro de ponto hoje</p>
          </div>

          <div v-else class="timeline">
            <div v-for="ponto in pontosHoje" :key="ponto.id" class="timeline-item">
              <div class="timeline-dot">
                <span class="material-symbols-rounded">{{ tipoIcon(ponto.tipo) }}</span>
              </div>
              <div class="timeline-content">
                <span class="timeline-tipo">{{ tipoLabel(ponto.tipo) }}</span>
                <span class="timeline-time">{{ formatTime(ponto.data_hora) }}</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="auth.isAdmin && colaboradores.length" class="section">
          <div class="section-header">
            <h2>Equipe</h2>
            <RouterLink to="/colaboradores" class="see-all">Ver todos</RouterLink>
          </div>

          <div class="team-list">
            <div v-for="colab in colaboradores.slice(0, 5)" :key="colab.id" class="team-member">
              <div class="member-avatar">
                {{ colab.full_name.charAt(0).toUpperCase() }}
              </div>
              <div class="member-info">
                <span class="member-name">{{ colab.full_name }}</span>
                <span class="member-position">{{ colab.position ?? 'Sem cargo' }}</span>
              </div>
              <span
                class="status-badge"
                :class="colab.status"
              >
                {{ colab.status }}
              </span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped>
.dashboard {
  max-width: 800px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.date-label {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
  text-transform: capitalize;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.spinner-lg {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.stat-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon .material-symbols-rounded {
  font-size: 22px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-header h2 {
  font-size: 1.05rem;
  font-weight: 700;
}

.see-all {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 40px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}

.timeline {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
}

.timeline-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

.timeline-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.timeline-dot .material-symbols-rounded {
  font-size: 18px;
  color: var(--color-primary);
}

.timeline-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.timeline-tipo {
  font-size: 0.88rem;
  font-weight: 600;
}

.timeline-time {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.team-list {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.team-member {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
}

.team-member:not(:last-child) {
  border-bottom: 1px solid var(--color-border-light);
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  font-size: 0.88rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-position {
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

.status-badge.ativo {
  background: #ecfdf5;
  color: #059669;
}

.status-badge.inativo {
  background: #fef2f2;
  color: #dc2626;
}

.status-badge.ferias {
  background: #eff6ff;
  color: #2563eb;
}

.status-badge.desligado {
  background: #f5f5f5;
  color: #737373;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 14px;
  }

  .page-header h1 {
    font-size: 1.3rem;
  }
}

@media (min-width: 480px) and (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
