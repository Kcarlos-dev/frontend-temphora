<script setup lang="ts">
import AppSidebar from './AppSidebar.vue'
import AppBottomNav from './AppBottomNav.vue'
</script>

<template>
  <div class="app-layout">
    <AppSidebar />
    <main class="main-content">
      <slot />
    </main>
    <AppBottomNav />
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
}

.main-content {
  flex: 1;
  margin-left: var(--sidebar-width);
  padding: 24px;
  padding-bottom: 24px;
  min-height: 100vh;
}

@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    padding: 16px;
    padding-bottom: calc(var(--bottomnav-height) + 16px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
