import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/ViewLogin.vue'),
      meta: { public: true },
    },
    {
      path: '/kiosk',
      name: 'kiosk',
      component: () => import('@/views/ViewKiosk.vue'),
      meta: { roles: ['kiosk'] },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/ViewDashboard.vue'),
    },
    {
      path: '/ponto',
      name: 'ponto',
      component: () => import('@/views/ViewPonto.vue'),
    },
    {
      path: '/colaboradores',
      name: 'colaboradores',
      component: () => import('@/views/ViewColaboradores.vue'),
      meta: { roles: ['admin', 'root', 'rh'] },
    },
    {
      path: '/atestados',
      name: 'atestados',
      component: () => import('@/views/ViewAtestados.vue'),
    },
    {
      path: '/empresa',
      name: 'empresa',
      component: () => import('@/views/ViewEmpresa.vue'),
      meta: { roles: ['admin', 'root', 'rh'] },
    },
    {
      path: '/usuarios',
      name: 'usuarios',
      component: () => import('@/views/ViewUsuarios.vue'),
      meta: { roles: ['admin', 'root', 'rh'] },
    },
    {
      path: '/nova-empresa',
      name: 'nova-empresa',
      component: () => import('@/views/ViewNovaEmpresa.vue'),
      meta: { roles: ['root'] },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const defaultAuthenticatedRoute = auth.userRole === 'kiosk' ? '/kiosk' : '/dashboard'

  if (to.meta.public) {
    if (auth.isAuthenticated) return defaultAuthenticatedRoute
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  const requiredRoles = to.meta.roles as string[] | undefined
  if (requiredRoles && !requiredRoles.includes(auth.userRole)) {
    return defaultAuthenticatedRoute
  }

  if (auth.userRole === 'kiosk' && to.path !== '/kiosk') {
    return '/kiosk'
  }

  return true
})

// Quando houve deploy com o app aberto, os chunks (lazy views) mudam de hash
// e `import()` do route-level dispara "Failed to fetch dynamically imported
// module" (404). Nesse caso, forçamos um reload uma única vez para que o
// navegador baixe o index.html novo e seus assets. O flag em sessionStorage
// evita loop quando o problema não for de deploy.
const CHUNK_RELOAD_FLAG = 'temphora_chunk_reload'

function isDynamicImportError(err: unknown): boolean {
  if (!err) return false
  const msg =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk \S+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

router.onError((error, to) => {
  if (!isDynamicImportError(error)) return

  const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1'
  if (alreadyReloaded) {
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG)
    return
  }

  sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
  const target = to?.fullPath || window.location.pathname
  window.location.replace(target)
})

router.afterEach(() => {
  if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1') {
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG)
  }
})

export default router
