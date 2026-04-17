<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

interface NavItem {
  name: string
  icon: string
  to: string
  roles?: string[]
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { name: 'Home', icon: 'dashboard', to: '/dashboard' },
    { name: 'Ponto', icon: 'schedule', to: '/ponto' },
    { name: 'Equipe', icon: 'group', to: '/colaboradores', roles: ['admin', 'root', 'rh'] },
    { name: 'Atestados', icon: 'description', to: '/atestados' },
    { name: 'Empresa', icon: 'business', to: '/empresa', roles: ['admin', 'root', 'rh'] },
    { name: 'Usuários', icon: 'manage_accounts', to: '/usuarios', roles: ['root'] },
    { name: 'Nova empresa', icon: 'add_business', to: '/nova-empresa', roles: ['root'] },
  ]
  return items.filter(
    (item) => !item.roles || item.roles.includes(auth.userRole),
  )
})

function isActive(path: string) {
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="bottom-nav">
    <RouterLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="bottom-nav-item"
      :class="{ active: isActive(item.to) }"
    >
      <span class="material-symbols-rounded bottom-nav-icon">{{ item.icon }}</span>
      <span class="bottom-nav-label">{{ item.name }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottomnav-height);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: all 0.15s ease;
  min-width: 56px;
}

.bottom-nav-item.active {
  color: var(--color-primary);
}

.bottom-nav-item.active .bottom-nav-icon {
  background: var(--color-accent);
  color: var(--color-primary);
  border-radius: var(--radius-lg);
  padding: 2px 14px;
}

.bottom-nav-icon {
  font-size: 22px;
  transition: all 0.15s ease;
}

.bottom-nav-label {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

@media (min-width: 769px) {
  .bottom-nav {
    display: none;
  }
}
</style>
