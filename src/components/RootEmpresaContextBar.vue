<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const inputId = ref('')
const applying = ref(false)
const localError = ref('')

function syncInputFromStore() {
  const id = auth.empresaId
  inputId.value = id != null ? String(id) : ''
}

onMounted(() => {
  syncInputFromStore()
})

async function aplicar() {
  localError.value = ''
  const n = Number(String(inputId.value).trim())
  if (!Number.isFinite(n) || n <= 0) {
    localError.value = 'Informe um ID de empresa válido (inteiro > 0).'
    return
  }
  applying.value = true
  try {
    auth.setRootEmpresaContext(Math.trunc(n))
    await auth.fetchEmpresa()
    syncInputFromStore()
  } finally {
    applying.value = false
  }
}

async function limparContexto() {
  localError.value = ''
  applying.value = true
  try {
    auth.setRootEmpresaContext(null)
    await auth.fetchEmpresa()
    syncInputFromStore()
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="root-context" role="region" aria-label="Contexto de empresa (root)">
    <div class="root-context-inner">
      <span class="material-symbols-rounded root-context-icon" aria-hidden="true"
        >apartment</span
      >
      <div class="root-context-text">
        <strong>Empresa ativa</strong>
        <span class="root-context-hint">
          Todas as telas usam este ID nas rotas da API. O token de root não precisa
          estar vinculado a esta empresa.
        </span>
      </div>
      <form class="root-context-form" @submit.prevent="aplicar">
        <label class="sr-only" for="root-empresa-id">ID da empresa</label>
        <input
          id="root-empresa-id"
          v-model="inputId"
          type="number"
          min="1"
          step="1"
          class="root-context-input"
          placeholder="ID"
          :disabled="applying"
        />
        <button type="submit" class="btn-apply" :disabled="applying">Aplicar</button>
        <button
          v-if="auth.rootEmpresaContextId != null"
          type="button"
          class="btn-clear"
          :disabled="applying"
          @click="limparContexto"
        >
          Limpar override
        </button>
      </form>
      <span v-if="auth.empresa?.enterprise" class="root-context-nome">{{
        auth.empresa.enterprise
      }}</span>
    </div>
    <p v-if="localError" class="root-context-error">{{ localError }}</p>
  </div>
</template>

<style scoped>
.root-context {
  background: linear-gradient(90deg, rgba(212, 168, 75, 0.12), rgba(9, 12, 38, 0.06));
  border-bottom: 1px solid var(--color-border);
  padding: 10px 16px;
}

.root-context-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.root-context-icon {
  font-size: 22px;
  color: var(--color-accent-dark, #a67c2a);
  flex-shrink: 0;
}

.root-context-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 200px;
}

.root-context-text strong {
  font-size: 0.85rem;
  color: var(--color-text);
}

.root-context-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

.root-context-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.root-context-input {
  width: 100px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 0.9rem;
  background: var(--color-surface);
  color: var(--color-text);
}

.btn-apply {
  padding: 8px 14px;
  border-radius: var(--radius-md);
  border: 0;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--color-primary);
  color: #fff;
}

.btn-apply:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-clear {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.root-context-nome {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-context-error {
  margin: 8px auto 0;
  max-width: 1200px;
  font-size: 0.8rem;
  color: var(--color-danger);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
