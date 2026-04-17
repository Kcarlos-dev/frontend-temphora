<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppSidebar from './AppSidebar.vue'
import AppBottomNav from './AppBottomNav.vue'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <div class="content-column">
      <header class="mobile-topbar">
        <div class="mobile-user">
          <span class="material-symbols-rounded mobile-user-icon">person</span>
          <span class="mobile-user-email">{{ auth.userName }}</span>
        </div>
        <button type="button" class="mobile-logout" @click="handleLogout">
          <span class="material-symbols-rounded">logout</span>
          <span>Sair</span>
        </button>
      </header>
      <main class="main-content">
        <slot />
      </main>
    </div>
    <AppBottomNav />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
}

.content-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 100vh;
}

.mobile-topbar {
  display: none;
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 24px;
  padding-bottom: 24px;
  min-height: 0;
}

@media (max-width: 768px) {
  .mobile-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-left: 0;
    padding: 10px 16px;
    padding-top: calc(10px + env(safe-area-inset-top, 0px));
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 90;
  }

  .mobile-user {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .mobile-user-icon {
    font-size: 22px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .mobile-user-email {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-logout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-danger);
    background: rgba(217, 72, 65, 0.08);
    transition: background 0.15s ease;
  }

  .mobile-logout .material-symbols-rounded {
    font-size: 18px;
  }

  .mobile-logout:hover {
    background: rgba(217, 72, 65, 0.14);
  }

  .main-content {
    margin-left: 0;
    padding: 16px;
    padding-bottom: calc(var(--bottomnav-height) + 16px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
