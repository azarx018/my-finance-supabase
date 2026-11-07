// Runs after `vite build`, BEFORE verify-build.mjs (see "postbuild" in package.json).
//
// Why this exists: the app is a SPA served by adapter-static with `fallback: 'index.html'`. That fallback file is
// written by the adapter AFTER the PWA plugin has already computed the service worker's precache list, so the
// generated sw.js precaches every JS/CSS chunk but NOT index.html. Result: offline, the SW's navigateFallback
// ('/index.html') finds nothing in the cache and the browser shows its own "Anda offline" page instead of the app.
//
// Fix: add build/index.html to the precache manifest in sw.js, with its real content hash as the revision, so a
// new deploy always refreshes it. Does nothing if index.html is already precached.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SW = 'build/sw.js';
const INDEX = 'build/index.html';

if (!existsSync(SW) || !existsSync(INDEX)) {
  console.error(`[patch-sw] ERROR: ${SW} atau ${INDEX} tidak ada — tidak bisa menambahkan index.html ke precache.`);
  process.exit(1);
}

let sw = readFileSync(SW, 'utf-8');
const already = [...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].some((m) => /(^|\/)index\.html$/.test(m[1]));
if (already) {
  console.log('[patch-sw] index.html sudah ada di precache — tidak ada yang diubah.');
  process.exit(0);
}

const revision = createHash('md5').update(readFileSync(INDEX)).digest('hex');
const patched = sw.replace(/precacheAndRoute\(\s*\[/, (m) => `${m}\n    { "url": "index.html", "revision": "${revision}" },`);
if (patched === sw) {
  console.error('[patch-sw] ERROR: pola precacheAndRoute([ tidak ditemukan di sw.js (format Workbox berubah?).');
  process.exit(1);
}
writeFileSync(SW, patched);
console.log(`[patch-sw] index.html ditambahkan ke precache (revision ${revision.slice(0, 8)}).`);
