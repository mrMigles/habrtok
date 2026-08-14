import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        id: '/',
        name: 'HabrTok — Habr по свайпу',
        short_name: 'HabrTok',
        description: 'Технические статьи Habr в жестовой ленте: листайте, уходите в темы и сохраняйте маршрут.',
        lang: 'ru',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1115',
        theme_color: '#0b1115',
        categories: ['news', 'education', 'productivity'],
        icons: [
          { src: '/icons/habrtok-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/habrtok-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/habrtok-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/habr\.com\/kek\/v2\/articles\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'habrtok-api-v1',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/habrastorage\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'habrtok-media-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
