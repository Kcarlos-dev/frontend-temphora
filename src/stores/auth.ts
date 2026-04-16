import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, empresaApi } from '@/services/api'
import type { AuthPayload, Empresa } from '@/types'

function parseJwt(token: string): AuthPayload | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('temphora_token'))
  const payload = ref<AuthPayload | null>(token.value ? parseJwt(token.value) : null)
  const empresa = ref<Empresa | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!payload.value)
  const isAdmin = computed(() =>
    ['admin', 'root', 'rh'].includes(payload.value?.role ?? ''),
  )
  const isRoot = computed(() => payload.value?.role === 'root')
  const userName = computed(() => payload.value?.email ?? '')
  const empresaId = computed(() => payload.value?.empresaId)
  const colaboradorId = computed(() => payload.value?.colaboradorId)
  const userRole = computed(() => payload.value?.role ?? '')

  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const res = await authApi.login(email, password)
      const jwt = res.data.token
      token.value = jwt
      payload.value = parseJwt(jwt)
      localStorage.setItem('temphora_token', jwt)

      if (payload.value?.empresaId) {
        await fetchEmpresa()
      }
    } catch (err: any) {
      error.value = err.response?.data?.message ?? 'Erro ao fazer login'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchEmpresa() {
    if (!payload.value?.empresaId) return
    try {
      const res = await empresaApi.get(payload.value.empresaId)
      empresa.value = res.data
    } catch {
      // silently fail
    }
  }

  function logout() {
    token.value = null
    payload.value = null
    empresa.value = null
    localStorage.removeItem('temphora_token')
  }

  function initialize() {
    if (token.value) {
      payload.value = parseJwt(token.value)
      if (!payload.value) {
        logout()
      }
    }
  }

  return {
    token,
    payload,
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
  }
})
