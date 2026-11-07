export function getBudgetMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getBudgetMonthLabel(): string {
  const n = new Date();
  return `${MONTH_NAMES[n.getMonth()]} ${n.getFullYear()}`;
}

/** "2026-11" digeser `delta` bulan (negatif = mundur). Aman untuk pergantian tahun. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabelOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Budget dengan "rollover": kalau budget bulan ini ditandai `rollover`, sisa limit bulan lalu
 * (limit efektif bulan lalu − pemakaian bulan lalu, minimal 0) ditambahkan ke limit bulan ini.
 * Berantai: sisa yang dibawa dari bulan-bulan sebelumnya ikut terbawa selama tiap bulan punya
 * budget kategori itu dan ditandai rollover. Bulan lalu tanpa budget = rantai putus (tidak ada sisa).
 * Pemakaian = pengeluaran (`type: expense`) di kategori itu; transfer tabungan/hutang tidak dihitung.
 */
export interface EffectiveBudget {
  base: number;
  carried: number;
  limit: number;
}

function usedInMonth(
  transactions: { type?: unknown; cat_id?: unknown; date?: unknown; amount?: unknown; deleted_at?: unknown }[],
  catId: string,
  month: string
): number {
  let u = 0;
  for (const t of transactions) {
    if (t.deleted_at || t.type !== 'expense' || t.cat_id !== catId) continue;
    if ((t.date as string).startsWith(month)) u += t.amount as number;
  }
  return u;
}

export function effectiveBudget(
  budgets: { cat_id?: unknown; month?: unknown; limit_amount?: unknown; rollover?: unknown; deleted_at?: unknown }[],
  transactions: { type?: unknown; cat_id?: unknown; date?: unknown; amount?: unknown; deleted_at?: unknown }[],
  catId: string,
  month: string,
  depth = 24
): EffectiveBudget {
  const b = budgets.find((x) => !x.deleted_at && x.cat_id === catId && x.month === month);
  if (!b) return { base: 0, carried: 0, limit: 0 };
  const base = b.limit_amount as number;
  let carried = 0;
  if (b.rollover === true && depth > 0) {
    const prevMonth = shiftMonth(month, -1);
    const prev = effectiveBudget(budgets, transactions, catId, prevMonth, depth - 1);
    if (prev.limit > 0) carried = Math.max(0, prev.limit - usedInMonth(transactions, catId, prevMonth));
  }
  return { base, carried, limit: base + carried };
}
