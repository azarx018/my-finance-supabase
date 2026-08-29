import type { SyncableRecord } from '$lib/db/dexie';
import { todayStr } from './format';
import type { Cat } from './categories';
import { getCatList } from './categories';

export type DateFilter = 'today' | 'week' | 'month' | '3month' | '6month' | 'year' | 'all';

export function getDateRange(f: DateFilter): { from: string; to: string } | null {
  const today = todayStr();
  if (f === 'today') return { from: today, to: today };
  if (f === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, to: today };
  }
  if (f === 'month') {
    const d = new Date();
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (f === '3month') {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (f === '6month') {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today };
  }
  if (f === 'year') return { from: `${new Date().getFullYear()}-01-01`, to: today };
  return null;
}

export function filterTx(
  transactions: SyncableRecord[],
  dateF: DateFilter,
  typeF: 'all' | 'income' | 'expense',
  search: string
): SyncableRecord[] {
  let list = transactions.filter((t) => !t.deleted_at);
  const r = getDateRange(dateF);
  if (r) list = list.filter((t) => (t.date as string) >= r.from && (t.date as string) <= r.to);
  if (typeF === 'income') list = list.filter((t) => t.type === 'income');
  if (typeF === 'expense') list = list.filter((t) => t.type === 'expense');
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (t) =>
        ((t.description as string) || '').toLowerCase().includes(q) ||
        ((t.note as string) || '').toLowerCase().includes(q)
    );
  }
  list.sort(
    (a, b) => (b.date as string).localeCompare(a.date as string) || b.id.localeCompare(a.id)
  );
  return list;
}

export function calcTotals(list: SyncableRecord[]): { income: number; expense: number; saldo: number } {
  let income = 0;
  let expense = 0;
  list.forEach((t) => {
    if (t.type === 'income') income += t.amount as number;
    else if (t.type === 'expense') expense += t.amount as number;
  });
  return { income, expense, saldo: income - expense };
}

/**
 * How a transaction should LOOK in a list (color, +/- sign) — not the
 * same as its underlying `type`. A saving withdrawal or a debt payment
 * received both put cash back in a wallet and should read as green/+,
 * even though their `type` is 'saving_transfer'/'debt_transfer', not
 * 'income'. Used by Riwayat, Dashboard, and Kalender so all three treat
 * these consistently instead of each page reimplementing (or forgetting)
 * the same direction check.
 */
export function getDisplayType(t: SyncableRecord): 'income' | 'expense' {
  if (t.type === 'saving_transfer') return t.direction === 'withdraw' ? 'income' : 'expense';
  if (t.type === 'debt_transfer') return t.direction === 'in' ? 'income' : 'expense';
  return t.type === 'income' ? 'income' : 'expense';
}

export interface MonthlyPoint {
  month: string;
  label: string;
  income: number;
  expense: number;
}

/** Last `months` calendar months of income/expense, oldest first. */
export function getMonthlyData(transactions: SyncableRecord[], months = 6): MonthlyPoint[] {
  const result: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const txs = transactions.filter(
      (t) => (t.date as string).startsWith(mk) && t.type !== 'transfer' && t.type !== 'saving_transfer'
    );
    result.push({
      month: mk,
      label: d.toLocaleDateString('id-ID', { month: 'short' }),
      income: txs.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount as number), 0),
      expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount as number), 0)
    });
  }
  return result;
}

export interface CatBreakdown {
  id: string;
  name: string;
  emoji: string;
  value: number;
}

export function getCategoryBreakdown(
  transactions: SyncableRecord[],
  dateFilter: DateFilter,
  customCats: Cat[] = []
): CatBreakdown[] {
  const r = getDateRange(dateFilter);
  const list = transactions.filter(
    (t) => t.type === 'expense' && (!r || ((t.date as string) >= r.from && (t.date as string) <= r.to))
  );
  const map: Record<string, number> = {};
  list.forEach((t) => {
    const c = (t.cat_id as string) || 'other_exp';
    map[c] = (map[c] || 0) + (t.amount as number);
  });
  return Object.entries(map)
    .map(([id, val]) => {
      const cat = getCatList('expense', customCats).find((c) => c.id === id) || { id, name: 'Lainnya', emoji: '💸' };
      return { id, name: cat.name, emoji: cat.emoji, value: val };
    })
    .sort((a, b) => b.value - a.value);
}

/** Total expense per weekday (0=Sunday..6=Saturday), within an optional date filter. */
export function getDayOfWeekData(transactions: SyncableRecord[], dateFilter: DateFilter): number[] {
  const r = getDateRange(dateFilter);
  const days = [0, 0, 0, 0, 0, 0, 0];
  transactions
    .filter((t) => t.type === 'expense' && (!r || ((t.date as string) >= r.from && (t.date as string) <= r.to)))
    .forEach((t) => {
      const d = new Date((t.date as string) + 'T00:00:00').getDay();
      days[d] += t.amount as number;
    });
  return days;
}

export function getAvgMonthly(transactions: SyncableRecord[], type: 'income' | 'expense', n = 3): number {
  if (!transactions.length) return 0;
  const months = new Set<string>();
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(1); // avoid month rollover when today is the 29th-31st
    d.setMonth(d.getMonth() - i);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const list = transactions.filter((t) => t.type === type && months.has((t.date as string).slice(0, 7)));
  if (!list.length) return 0;
  return Math.round(list.reduce((s, t) => s + (t.amount as number), 0) / months.size);
}
