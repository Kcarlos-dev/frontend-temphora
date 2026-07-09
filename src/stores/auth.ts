import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, empresaApi } from '@/services/api'
import type { AuthPayload, Empresa } from '@/types'

const ROOT_EMPRESA_CONTEXT_KEY = 'temphora_root_empresa_context'

function parseJwt(token: string): AuthPayload | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as AuthPayload & { exp?: number }
    if (payload.exp != null && payload.exp * 1000 < Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('temphora_token'))
  const payload = ref<AuthPayload | null>(token.value ? parseJwt(token.value) : null)
  /** Só para papel `root`: ID da empresa usada nas rotas `/.../:id_empresa/...`. Persistido em `sessionStorage`. */
  const rootEmpresaContextId = ref<number | null>(null)
  const empresa = ref<Empresa | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function readStoredRootContext() {
    rootEmpresaContextId.value = null
    if (payload.value?.role !== 'root') {
      sessionStorage.removeItem(ROOT_EMPRESA_CONTEXT_KEY)
      return
    }
    const raw = sessionStorage.getItem(ROOT_EMPRESA_CONTEXT_KEY)
    if (!raw?.trim()) return
    const n = Number(raw.trim())
    if (Number.isFinite(n) && n > 0) {
      rootEmpresaContextId.value = Math.trunc(n)
    }
  }

  const isAuthenticated = computed(() => !!token.value && !!payload.value)
  const isAdmin = computed(() =>
    ['admin', 'root', 'rh'].includes(payload.value?.role ?? ''),
  )
  const isRoot = computed(() => payload.value?.role === 'root')
  const userName = computed(() => payload.value?.email ?? '')

  const empresaId = computed(() => {
    if (payload.value?.role === 'root') {
      const ctx = rootEmpresaContextId.value
      if (ctx != null && ctx > 0) return ctx
    }
    return payload.value?.empresaId ?? null
  })

  const colaboradorId = computed(() => payload.value?.colaboradorId)
  const userRole = computed(() => payload.value?.role ?? '')

  function setRootEmpresaContext(id: number | null) {
    if (payload.value?.role !== 'root') return
    if (id == null || !Number.isFinite(id) || id <= 0) {
      rootEmpresaContextId.value = null
      sessionStorage.removeItem(ROOT_EMPRESA_CONTEXT_KEY)
      return
    }
    rootEmpresaContextId.value = Math.trunc(id)
    sessionStorage.setItem(ROOT_EMPRESA_CONTEXT_KEY, String(rootEmpresaContextId.value))
  }

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const res = await authApi.login(email, password)
      const jwt = res.data.token
      token.value = jwt
      payload.value = parseJwt(jwt)
      localStorage.setItem('temphora_token', jwt)

      readStoredRootContext()
      if (empresaId.value != null) {
        await fetchEmpresa()
      } else {
        empresa.value = null
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        error.value = err.response.data.message
      } else if (err.request && !err.response) {
        error.value =
          'Falha de conexão. Verifique a internet e tente novamente.'
      } else {
        error.value = 'Erro ao fazer login'
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchEmpresa() {
    const id = empresaId.value
    if (id == null) {
      empresa.value = null
      return
    }
    try {
      const res = await empresaApi.get(id)
      empresa.value = res.data
    } catch {
      empresa.value = null
    }
  }

  function logout() {
    token.value = null
    payload.value = null
    empresa.value = null
    rootEmpresaContextId.value = null
    sessionStorage.removeItem(ROOT_EMPRESA_CONTEXT_KEY)
    localStorage.removeItem('temphora_token')
  }

  function initialize() {
    if (token.value) {
      payload.value = parseJwt(token.value)
      if (!payload.value) {
        logout()
        return
      }
      readStoredRootContext()
    }
  }

  return {
    token,
    payload,
    rootEmpresaContextId,
    empresa,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    isRoot,
    userName,
    empresaId,
    colaboradorId,
    userRole,
    login,
    logout,
    fetchEmpresa,
    initialize,
    setRootEmpresaContext,
  }
})
