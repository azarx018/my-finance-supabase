/** "Rp 12.000" / "-Rp 12.000" — full precision, used in forms & lists. */
export function formatRp(n: number): string {
  if (!n || isNaN(n)) return 'Rp 0';
  const sign = n < 0 ? '-' : '';
  return sign + 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

/** "Rp 1.2 Jt" — compact form for cards/summaries where space is tight. */
export function formatRpC(n: number): string {
  const sign = (n || 0) < 0 ? '-' : '';
  const a = Math.abs(n || 0);
  if (a >= 1e9) return sign + 'Rp ' + (a / 1e9).toFixed(1) + ' M';
  if (a >= 1e6) return sign + 'Rp ' + (a / 1e6).toFixed(1) + ' Jt';
  if (a >= 1e3) return sign + 'Rp ' + (a / 1e3).toFixed(0) + ' Rb';
  return sign + 'Rp ' + a.toLocaleString('id-ID');
}

export function formatDate(s: string): string {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateShort(s: string): string {
  if (!s) return '-';
  return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function todayStr(): string {
  // Deliberately NOT `new Date().toISOString().split('T')[0]` — that's
  // UTC. Indonesia is UTC+7/+8/+9, so anytime before ~07:00 local, the
  // UTC date is still "yesterday" and every new transaction would get
  // logged one day behind. Build the string from local components instead.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Strips everything but digits — for reading a Rupiah-formatted input back into a number. */
export function parseAmt(s: string): number {
  return parseInt((s || '').replace(/\D/g, '')) || 0;
}
