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

  if (to.meta.public) {
    if (auth.isAuthenticated) return '/dashboard'
    return true
  }

  if (!auth.isAuthenticated) {
    return '/login'
  }

  const requiredRoles = to.meta.roles as string[] | undefined
  if (requiredRoles && !requiredRoles.includes(auth.userRole)) {
    return '/dashboard'
  }

  return true
})

export default router
