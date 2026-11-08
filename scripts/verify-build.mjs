// Runs automatically after `npm run build` (npm "postbuild" hook, so it also runs on Vercel).
// Fails the build if the app shell is not precached by the service worker (offline would break).
import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const warns = [];

if (!existsSync('build/index.html')) errors.push('build/index.html (app shell SPA) tidak ada.');
if (!existsSync('build/fonts/BricolageGrotesque-var.woff')) errors.push('build/fonts/BricolageGrotesque-var.woff tidak ada (cek folder static/).');

if (!existsSync('build/sw.js')) {
  errors.push('build/sw.js tidak ada.');
} else {
  const sw = readFileSync('build/sw.js', 'utf-8');
  const precached = [...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  // index.html WAJIB ada di daftar precache — kalau tidak, offline browser menampilkan halaman "Anda offline"
  // bawaan, bukan app. Ditambahkan oleh scripts/patch-sw.mjs.
  if (!precached.some((u) => /(^|\/)index\.html$/.test(u)))
    errors.push(`sw.js tidak mem-precache index.html → app tidak bisa jalan offline (terbaca ${precached.length} entri precache).`);
  if (!sw.includes('BricolageGrotesque')) warns.push('sw.js tidak mem-precache font → tampilan offline bisa pakai font cadangan.');
}

warns.forEach((w) => console.warn('[verify-build] WARN:', w));
if (errors.length) {
  errors.forEach((e) => console.error('[verify-build] ERROR:', e));
  process.exit(1);
}
console.log('[verify-build] OK — app shell ter-precache.');
