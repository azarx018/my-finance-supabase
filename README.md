# Flow Money — Landing (static)

Repo terpisah dari app. Situs statis murni (tanpa build).
- Domain landing: `https://azh-flowmoney.vercel.app`
- Domain app: `https://flowmoney-app-azh.vercel.app` (repo `flowmoney-app`)

Deploy: project Vercel sendiri, Root Directory = root repo ini, Framework Preset = Other, tanpa Build Command.

| URL | File |
|---|---|
| `/` | `index.html` |
| `/privacy`, `/terms` | `privacy.html`, `terms.html` (via `cleanUrls`) |
| `/landing/*` | gambar hash (cache immutable; ganti gambar = nama file baru) |

Link ke app (semua absolut ke `https://flowmoney-app-azh.vercel.app`): tombol "Buka App"/"Mulai sekarang" → `/login`; PWA terinstal yang membuka landing dialihkan ke `/dashboard` app.
Canonical, OG, JSON-LD, `robots.txt`, `sitemap.xml` memakai domain landing.
Kalau domain berubah, ganti string domain di `index.html`, `privacy.html`, `terms.html`, `robots.txt`, `sitemap.xml`.

Auto-deploy dari Git dimatikan (`git.deploymentEnabled: false` di `vercel.json`); deploy manual lewat dashboard Vercel atau `vercel --prod`.
