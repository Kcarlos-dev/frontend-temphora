import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { User } from '@/types'

export type RecentUser = User & {
  id_empresa: number
  /** Timestamp (ms) de quando foi adicionado à lista. */
  created_at: number
}

const STORAGE_KEY = 'temphora_recent_users'
const MAX_RECENT = 5

// Migração: versão anterior salvava em localStorage. Remove para não deixar
// dado antigo persistido no disco além do escopo da sessão.
try {
  localStorage.removeItem(STORAGE_KEY)
} catch {
  // ignora
}

function loadFromStorage(): RecentUser[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (u): u is RecentUser =>
        u &&
        typeof u.id === 'number' &&
        typeof u.email === 'string' &&
        typeof u.id_empresa === 'number',
    )
  } catch {
    return []
  }
}

/**
 * Mantém os últimos usuários criados pelo operador logado. Persiste em
 * sessionStorage (escopo da aba): sobrevive a F5 e navegação entre rotas,
 * mas é descartado quando a aba/janela é fechada. Funciona como uma "cola"
 * temporária para lembrar o id_user ao cadastrar o colaborador em seguida.
 * O usuário também pode limpar manualmente via ação na UI.
 */
export const useRecentUsersStore = defineStore('recentUsers', () => {
  const items = ref<RecentUser[]>(loadFromStorage())

  watch(
    items,
    (val) => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      } catch {
        // quota cheia / modo privado — ignora, não é crítico.
      }
    },
    { deep: true },
  )

  function add(user: User, id_empresa: number) {
    const entry: RecentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      id_empresa,
      created_at: Date.now(),
    }
    items.value = [entry, ...items.value.filter((u) => u.id !== user.id)].slice(
      0,
      MAX_RECENT,
    )
  }

  function clear() {
    items.value = []
  }

  return {
    items,
    max: MAX_RECENT,
    add,
    clear,
  }
})
