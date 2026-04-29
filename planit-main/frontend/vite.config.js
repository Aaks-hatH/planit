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
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Never precache index.html — it must always be fetched fresh so
        // Safari picks up new deployments immediately instead of serving
        // the stale shell from the service-worker cache.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Navigation requests (HTML) — always go to the network first.
            // Falls back to cache only when fully offline. This ensures
            // Safari always receives the latest index.html on every load.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24, // 1 day max in offline cache
              },
            },
          },
          {
            // API calls must NEVER be cached or intercepted by the SW.
            // The /resolve endpoint in particular must always hit the network
            // so suspended/cancelled WL sites are blocked immediately.
            urlPattern: /\/api\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
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
    // Target modern browsers — smaller output, no legacy polyfills
    target: 'es2020',
    // Raise the chunk-size warning threshold; our lazy chunks are intentionally large
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split vendor code into stable, long-cacheable chunks.
        // Named chunks get deterministic filenames so a CDN/browser can cache
        // them across deploys when the underlying library hasn't changed.
        manualChunks(id) {
          // Core React runtime — almost never changes, should be cached forever
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/react-router/')) {
            return 'react-vendor';
          }
          // Socket.IO — changes rarely; separate chunk avoids invalidating React cache
          if (id.includes('node_modules/socket.io-client') ||
              id.includes('node_modules/engine.io-client')) {
            return 'socket';
          }
          // Utility libs
          if (id.includes('node_modules/axios') ||
              id.includes('node_modules/crypto-js') ||
              id.includes('node_modules/date-fns')) {
            return 'utils';
          }
          // Admin panel is large and only ever used by organizers — keep it isolated
          if (id.includes('/src/pages/Admin') ||
              id.includes('/src/pages/SecurityDashboard') ||
              id.includes('/src/components/PlatformAnalyticsDashboard')) {
            return 'admin';
          }
          // Venue/restaurant views — only tablet/kiosk users hit these
          if (id.includes('/src/pages/TableService') ||
              id.includes('/src/pages/ServerView') ||
              id.includes('/src/pages/KitchenView') ||
              id.includes('/src/pages/GuestTablet') ||
              id.includes('/src/pages/LiveWaitBoard')) {
            return 'venue';
          }
          // White-label portal chunks
          if (id.includes('/src/pages/WhiteLabel') ||
              id.includes('/src/pages/ClientPortal') ||
              id.includes('/src/pages/WLHome') ||
              id.includes('/src/pages/SetupFee')) {
            return 'whitelabel';
          }
        },
      },
    },
  }
})