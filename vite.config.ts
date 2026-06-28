import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'PCB Scouting List',
        short_name: 'Scouting',
        description: 'Personal scouting list for the Panama City Beach area',
        theme_color: '#7FC2B8',
        background_color: '#FBF8F3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      // SPA offline routing: now that we use BrowserRouter (clean URLs), the
      // service worker must serve index.html for any in-app route when offline,
      // so an installed/offline deep link like /browse doesn't 404. (Online, the
      // Worker's not_found_handling = single-page-application handles this.)
      workbox: {
        navigateFallback: '/index.html',
        // Precache the bundled fonts too. vite-plugin-pwa's default glob omits
        // woff/woff2, so without this the Fraunces/Nunito faces only survive
        // offline via the (evictable) HTTP cache — headings would silently fall
        // back to system fonts once that's cleared. Precaching makes offline
        // typography durable.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      // Keep the service worker OFF in dev — it caches the app shell and can
      // serve a stale/broken state back to every device. The SW still builds
      // for production (`npm run build`); offline install is verified in Phase 3.
      devOptions: { enabled: false },
    }),
  ],
})
