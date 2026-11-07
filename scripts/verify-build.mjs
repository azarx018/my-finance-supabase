// Runs automatically after `npm run build` (npm "postbuild" hook, so it also
// runs on Vercel). Fails the build if the landing/PWA separation is broken:
//  - landing must exist in build/ (Vercel serves it at "/")
//  - the app shell (index.html) must be precached by the service worker
//  - the landing must NOT be in the service worker (no offline copy, not
//    downloaded with the PWA)
import { existsSync, readFileSync } from 'node:fs';

const errors = [];
const warns = [];

if (!existsSync('build/landing.html')) errors.push('build/landing.html tidak ada (cek static/landing.html).');
if (!existsSync('build/index.html')) errors.push('build/index.html (app shell SPA) tidak ada.');
for (const f of ['build/landing/og.png', 'build/robots.txt', 'build/sitemap.xml', 'build/fonts/BricolageGrotesque-var.woff', 'build/privacy.html', 'build/terms.html']) {
  if (!existsSync(f)) errors.push(`${f} tidak ada (cek folder static/).`);
}
// every /landing/* asset referenced by the landing page must exist in the build
if (existsSync('build/landing.html')) {
  const html = readFileSync('build/landing.html', 'utf-8');
  for (const ref of new Set(html.match(/\/landing\/[\w.-]+/g) ?? [])) {
    if (!existsSync('build' + ref)) errors.push(`landing.html merujuk ${ref} tapi file tidak ada di build/.`);
  }
}

if (!existsSync('build/sw.js')) {
  errors.push('build/sw.js tidak ada.');
} else {
  const sw = readFileSync('build/sw.js', 'utf-8');
  // Only inspect what is actually PRECACHED (the {url, revision} manifest).
  // Searching the whole sw.js is wrong: navigateFallbackDenylist is serialized
  // into it as regexes (/^\/landing\.html$/, /^\/privacy\/?$/ ...), which
  // legitimately contain these words.
  const precached = [...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const leaked = precached.filter((u) => /(^|\/)(landing|privacy|terms)(\.html|\/|$)/i.test(u));
  if (leaked.length) errors.push(`sw.js mem-precache halaman publik: ${leaked.join(', ')}. Cek globIgnores di vite.config.ts.`);
  // index.html WAJIB ada di daftar precache (bukan sekadar disebut di navigateFallback) — kalau tidak, offline
  // browser menampilkan halaman "Anda offline" bawaan, bukan app. Ditambahkan oleh scripts/patch-sw.mjs.
  if (!precached.some((u) => /(^|\/)index\.html$/.test(u)))
    errors.push(`sw.js tidak mem-precache index.html → app tidak bisa jalan offline (terbaca ${precached.length} entri precache).`);
  if (!sw.includes('BricolageGrotesque')) warns.push('sw.js tidak mem-precache font → tampilan offline bisa pakai font cadangan.');
  if (!/denylist/i.test(sw)) warns.push('sw.js tanpa navigateFallbackDenylist → "/" bisa dijawab app shell oleh SW.');
}

warns.forEach((w) => console.warn('[verify-build] WARN:', w));
if (errors.length) {
  errors.forEach((e) => console.error('[verify-build] ERROR:', e));
  process.exit(1);
}
console.log('[verify-build] OK — landing terpisah dari PWA, app shell ter-precache.');
