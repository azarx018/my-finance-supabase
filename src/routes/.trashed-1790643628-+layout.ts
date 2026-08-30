// This app has no server: every read/write happens through Dexie (local)
// and the Supabase client SDK (sync). Running as a pure SPA — ssr off,
// no prerendering — and adapter-static's `fallback: 'index.html'` (see
// svelte.config.js) serves every route from one shell, client-routed.
export const ssr = false;
export const prerender = false;
