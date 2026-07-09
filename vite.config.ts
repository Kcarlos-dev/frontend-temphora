import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro é feito manualmente em src/main.ts para permitir polling,
      // atualização ao voltar o foco e reload automático em `onNeedRefresh`.
      injectRegister: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'temphora-192.png',
        'temphora-512.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Temphora - Gestão de Ponto',
        short_name: 'Temphora',
        description: 'Sistema de gestão de ponto e RH',
        theme_color: '#090c26',
        background_color: '#f5f4fa',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'temphora-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'temphora-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'temphora-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // HTML fica fora do precache; navegações usam NetworkFirst abaixo para
        // que deploys apareçam no próximo carregamento, sem esperar todas as
        // abas fecharem (crítico em iOS standalone).
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Navegações sempre pela rede: NetworkFirst com timeout servia HTML antigo
        // em rede lenta (PWA/iOS), quebrando login e lazy chunks após deploy.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
