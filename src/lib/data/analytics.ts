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
  typeF: 'all' | 'income' | 'expense' | 'transfer',
  search: string
): SyncableRecord[] {
  let list = transactions.filter((t) => !t.deleted_at);
  const r = getDateRange(dateF);
  if (r) list = list.filter((t) => (t.date as string) >= r.from && (t.date as string) <= r.to);
  if (typeF === 'income') list = list.filter((t) => t.type === 'income');
  if (typeF === 'expense') list = list.filter((t) => t.type === 'expense');
  if (typeF === 'transfer') list = list.filter((t) => t.type === 'transfer');
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

/**
 * Average monthly EXPENSE per category over the last `n` months —
 * context for the AI Assistant's budget suggestions (see
 * `cloudflare/ai-worker/src/assistant.ts`). Divides by `n` (not by
 * how many of those months actually had spending), same convention as
 * `getAvgMonthly` above, so a category the person only spent on twice in
 * 3 months correctly averages lower rather than inflating to "2-month
 * average" and overstating how much they usually spend on it.
 */
export function getAverageSpendingByCategory(transactions: SyncableRecord[], n = 3): Record<string, number> {
  const months = new Set<string>();
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const totals: Record<string, number> = {};
  transactions
    .filter((t) => t.type === 'expense' && months.has((t.date as string).slice(0, 7)))
    .forEach((t) => {
      const catId = (t.cat_id as string) || 'other_exp';
      totals[catId] = (totals[catId] || 0) + (t.amount as number);
    });
  const averages: Record<string, number> = {};
  for (const [catId, total] of Object.entries(totals)) {
    averages[catId] = Math.round(total / n);
  }
  return averages;
}

export interface SalaryTransactionInfo {
  amount: number;
  date: string; // YYYY-MM-DD
  walletId: string | null; // which wallet the salary landed in — used to default propose_saving's source wallet
}

/**
 * Finds the most recent income transaction tagged with the built-in
 * "Gaji" category (see categories.ts — `id: 'salary'`), preferring one
 * from `month` but falling back to the single most recent one overall
 * (e.g. asked before this month's payday has landed yet). Returns null
 * if there's no salary-tagged income at all, in which case the
 * Assistant is instructed to ask the person directly rather than guess
 * — see the system prompt in assistant.ts.
 */
export function findSalaryTransaction(transactions: SyncableRecord[], month: string): SalaryTransactionInfo | null {
  const salaryTxs = transactions
    .filter((t) => t.type === 'income' && t.cat_id === 'salary')
    .sort((a, b) => (b.date as string).localeCompare(a.date as string));
  if (!salaryTxs.length) return null;

  const thisMonth = salaryTxs.find((t) => (t.date as string).startsWith(month));
  const chosen = thisMonth ?? salaryTxs[0];
  return {
    amount: chosen.amount as number,
    date: chosen.date as string,
    walletId: (chosen.wallet_id as string) ?? null
  };
}

/** Existing budget allocations for `month` — { cat_id: limit_amount }. */
export function getExistingBudget(budgets: SyncableRecord[], month: string): Record<string, number> {
  const result: Record<string, number> = {};
  budgets
    .filter((b) => b.month === month)
    .forEach((b) => {
      result[b.cat_id as string] = b.limit_amount as number;
    });
  return result;
}

export interface CategorySpend {
  cat_id: string;
  amount: number;
}

export interface SpendingSummary {
  total: number;
  by_category: CategorySpend[]; // sorted highest first — index 0 IS "biggest category"
}

/**
 * Spending breakdown for exactly one month — the "get_spending_summary"
 * capability for the AI Assistant, computed entirely client-side from
 * Dexie (same reasoning as getAverageSpendingByCategory: no raw
 * transactions ever leave the device, and no extra Gemini round-trip is
 * needed just to fetch this). Sent as context on every /assistant
 * request alongside the current month AND the previous one, so the
 * model can answer "pengeluaran terbesar bulan ini?" or "kenapa naik?"
 * directly from context instead of needing a tool-call round-trip.
 */
export function getSpendingSummary(transactions: SyncableRecord[], month: string): SpendingSummary {
  const totals: Record<string, number> = {};
  let total = 0;
  transactions
    .filter((t) => t.type === 'expense' && (t.date as string).startsWith(month))
    .forEach((t) => {
      const catId = (t.cat_id as string) || 'other_exp';
      const amt = t.amount as number;
      totals[catId] = (totals[catId] || 0) + amt;
      total += amt;
    });
  const by_category = Object.entries(totals)
    .map(([cat_id, amount]) => ({ cat_id, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { total, by_category };
}

/** "2026-09" -> "2026-08". Handles the January -> December-of-previous-year rollover. */
export function getPreviousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // JS months are 0-indexed; -2 = one month before `m`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface ActiveDebtInfo {
  id: string;
  name: string;
  dtype: 'borrowed' | 'lent';
  remaining: number;
}

/**
 * Unpaid debts/receivables — context for propose_debt_payment's fuzzy
 * name matching (see assistant.ts's system prompt). `remaining` uses
 * the same `amount - paid_amount` calculation as hutang/+page.svelte —
 * kept here instead of duplicated so the two never drift apart.
 */
export function getActiveDebts(debts: SyncableRecord[]): ActiveDebtInfo[] {
  return debts
    .filter((d) => !d.paid)
    .map((d) => ({
      id: d.id,
      name: d.name as string,
      dtype: d.dtype as 'borrowed' | 'lent',
      remaining: (d.amount as number) - ((d.paid_amount as number) || 0)
    }));
}
