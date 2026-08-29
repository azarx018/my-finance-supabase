import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Static adapter: this app has no server-side logic at all — every
    // read/write goes through Dexie (local) + Supabase (client SDK), so
    // the whole thing builds down to static files servable from any CDN
    // and installable as a PWA.
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // SPA fallback: client-side routing after install
      precompress: false,
      strict: true
    })
  }
};

export default config;
