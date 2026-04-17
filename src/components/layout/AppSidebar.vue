<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

interface NavItem {
  name: string
  icon: string
  to: string
  roles?: string[]
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { name: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
    { name: 'Ponto', icon: 'schedule', to: '/ponto' },
    { name: 'Colaboradores', icon: 'group', to: '/colaboradores', roles: ['admin', 'root', 'rh'] },
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

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <img src="@/assets/temphora.png" alt="Temphora" class="sidebar-logo" />
      <span class="sidebar-brand">Temphora</span>
    </div>

    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="material-symbols-rounded nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.name }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">
          <span class="material-symbols-rounded">person</span>
        </div>
        <div class="user-details">
          <span class="user-email">{{ auth.userName }}</span>
          <span class="user-role">{{ auth.userRole }}</span>
        </div>
      </div>
      <button class="logout-btn" @click="handleLogout">
        <span class="material-symbols-rounded">logout</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: var(--color-sidebar);
  color: #fff;
  display: flex;
  flex-direction: column;
  z-index: 100;
  transition: transform 0.3s ease;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.sidebar-brand {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: var(--color-accent);
  color: var(--color-sidebar);
}

.nav-item.active .nav-icon {
  color: var(--color-sidebar);
}

.nav-icon {
  font-size: 20px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-avatar .material-symbols-rounded {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.7);
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-email {
  font-size: 0.78rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: capitalize;
}

.logout-btn {
  padding: 6px;
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.15s;
  flex-shrink: 0;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
</style>
