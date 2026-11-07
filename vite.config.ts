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
        // (e.g. "flowmoney-v0.1.0-precache-..."), purely so it's obvious
        // in DevTools which deployed version a given cache belongs to —
        // doesn't change update-detection behavior, which is already
        // content-hash based (see note below).
        cacheId: `flowmoney-v${pkg.version}`,
        // 'development' skips workbox-build's own terser minification pass
        // on the generated sw.js. Needed because terser can hang
        // indefinitely in constrained/ARM environments (e.g. building
        // inside Termux on Android) — this doesn't affect the main app
        // bundle, which Vite still minifies normally via esbuild. The
        // service worker file just ends up a few KB larger, unminified.
        mode: 'development',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        // LANDING PAGE (static/landing.html, served at "/" by vercel.json):
        // it must NEVER be part of the PWA. Three things keep it out:
        //  1. globIgnores   → landing.html AND static/landing/* (screenshots, og.png)
        //     are not precached, so none of it is downloaded with the app
        //  2. directoryIndex: null → Workbox by default answers "/" with the
        //     precached "/index.html" (the app shell). That would hide the
        //     landing from anyone who already has the SW installed.
        //  3. navigateFallbackDenylist → navigations to "/" and "/landing.html"
        //     skip the app-shell fallback and go to the network.
        // Result: landing = online only (link / browser). The installed app
        // starts at /dashboard (manifest start_url) and works fully offline.
        globIgnores: ['**/landing.html', '**/landing/**', '**/privacy.html', '**/terms.html', '**/fonts/DMMono-*'],
        // NOTE: index.html (app shell) is NOT in the glob output — adapter-static writes it after this plugin runs.
        // scripts/patch-sw.mjs (postbuild) adds it to the precache; verify-build.mjs fails the build if it is missing.
        directoryIndex: null,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/$/, /^\/landing\.html$/, /^\/privacy\/?$/, /^\/terms\/?$/, /^\/privacy\.html$/, /^\/terms\.html$/],
        runtimeCaching: [
          {
            // Fonts are self-hosted (static/fonts) and precached via globPatterns above.
            // Explicitly bypass SW for Supabase — always go to network,
            // let the sync engine decide what happens when it fails.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      },
      manifest: {
        name: 'Flow Money',
        short_name: 'Flow Money',
        description: 'Pencatatan keuangan pribadi — income & expense tracker',
        // "/" is the public landing page (online only). The installed app
        // must open straight into the app, which is precached/offline-ready.
        // `id` pins the app identity to the old value so existing installs
        // are treated as the same app after start_url changes.
        id: '/',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        lang: 'id',
        categories: ['finance', 'productivity', 'utilities'],
        // BUGFIX: this manifest previously declared only one SVG file
        // reused for every size/purpose combo. Some Chromium/Android
        // versions fail the PWA installability check (or silently never
        // fire beforeinstallprompt) when the manifest has no real
        // raster icon — an "any"-purpose PNG at 192 and 512, plus a
        // dedicated "maskable" PNG with safe-zone padding, is what the
        // install criteria actually expect. SVG is kept as a fallback.
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      },
      devOptions: {
        enabled: true // test PWA/offline behavior in dev too
      }
    })
  ]
});
