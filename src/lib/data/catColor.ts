// Warna ubin ikon per kategori: stabil (id yang sama selalu warna yang sama),
// tanpa perlu daftar manual setiap kategori (termasuk kategori buatan user).
const PALETTE = ['#ff8a3d', '#2f5bea', '#e0447f', '#6b4df0', '#f5a524', '#12a15f', '#0ca5b0', '#e5484d'];

export function catColor(id?: string | null): string {
  if (!id) return 'var(--primary)';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
