import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vMaska } from 'maska/vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.directive('maska', vMaska)

app.mount('#app')
