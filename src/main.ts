import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vMaska } from 'maska/vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.directive('maska', vMaska)

app.mount('#app')

// Checa novas versões a cada 60s e ao voltar o foco (iOS standalone raramente
// recarrega sozinho); quando uma atualização chega, recarrega de imediato.
const UPDATE_INTERVAL_MS = 60 * 1000

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const tryUpdate = () => {
      registration.update().catch(() => {
        // ignora falhas de rede no update: o próximo tick tenta de novo.
      })
    }

    setInterval(tryUpdate, UPDATE_INTERVAL_MS)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tryUpdate()
    })
    window.addEventListener('focus', tryUpdate)
    window.addEventListener('online', tryUpdate)
  },
})
