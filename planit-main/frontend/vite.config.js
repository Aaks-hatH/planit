import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['planit-icon.svg', 'apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'PlanIt',
        short_name: 'PlanIt',
        description: 'Plan events together with secure chat, polls, and file sharing',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',          // allow landscape on tablets for check-in
        start_url: '/',
        scope: '/',
        // Deep-link shortcuts — show in the PWA install prompt and long-press menu
        shortcuts: [
          {
            name: 'My Events',
            short_name: 'Events',
            description: 'Browse and join events',
            url: '/discover',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
          },
        ],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // ── navigateFallback: serve index.html for ALL navigation requests ──
        // This is what makes deep links work when the app is installed as a PWA.
        // Without this, opening /event/:id or /event/:id/checkin offline shows
        // a browser error page instead of loading the React app.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          // Don't intercept API calls, socket.io, or assets with extensions
          /^\/api\//,
          /^\/socket\.io\//,
          /^\/uploads\//,
          /\.[a-z]{2,4}$/i,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ── Cache invite QR codes so they load offline on the guest page ──
          {
            urlPattern: /\/api\/invite\/[A-Z0-9]+\/qr\.svg$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'invite-qr-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ── Cache event QR codes ──
          {
            urlPattern: /\/api\/events\/[^/]+\/qr\.svg$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'event-qr-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'socket': ['socket.io-client'],
          'utils': ['axios', 'crypto-js', 'date-fns']
        }
      }
    }
  }
})
