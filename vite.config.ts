import { readFileSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

// Single source of truth for the app version: package.json. Bumping the
// version there is the only thing needed — it flows into the Settings
// page display (via __APP_VERSION__, see src/app.d.ts) and into the
// Workbox cache name prefix below, so a version bump is always visible
// both in the UI and in DevTools > Application > Cache Storage.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      // Manual registration (see src/lib/pwa/register.ts) instead of the
      // default auto-injected script — this is what lets us show our own
      // "update available, tap to reload" banner instead of the SW
      // silently swapping in a new version underneath the user.
      injectRegister: false,
      // Cache-first for the app shell (instant load offline), but the
      // Supabase REST/Realtime calls must NEVER be cached by the SW —
      // the sync engine (Dexie + custom queue) owns offline behavior for
      // data, the SW only owns offline behavior for the app shell itself.
      workbox: {
        // Prefixes every Workbox-managed cache name with the app version
        // (e.g. "my-finance-v0.1.0-precache-..."), purely so it's obvious
        // in DevTools which deployed version a given cache belongs to —
        // doesn't change update-detection behavior, which is already
        // content-hash based (see note below).
        cacheId: `my-finance-v${pkg.version}`,
        // 'development' skips workbox-build's own terser minification pass
        // on the generated sw.js. Needed because terser can hang
        // indefinitely in constrained/ARM environments (e.g. building
        // inside Termux on Android) — this doesn't affect the main app
        // bundle, which Vite still minifies normally via esbuild. The
        // service worker file just ends up a few KB larger, unminified.
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Google Fonts — cache-first, long lived
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Explicitly bypass SW for Supabase — always go to network,
            // let the sync engine decide what happens when it fails.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      manifest: {
        name: 'My Finance',
        short_name: 'My Finance',
        description: 'Pencatatan keuangan pribadi — income & expense tracker',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0f',
        theme_color: '#22c55e',
        lang: 'id',
        categories: ['finance', 'productivity', 'utilities'],
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icon-192.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: 'icon-192.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      devOptions: {
        enabled: true // test PWA/offline behavior in dev too
      }
    })
  ]
});
