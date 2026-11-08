import type { SyncableRecord } from '$lib/db/dexie';
import { computeWalletStats } from '$lib/data/wallets';
import { getBucketBalance } from '$lib/data/saving';
import { getActiveDebts, getPreviousMonth, getSpendingSummary } from '$lib/data/analytics';

/**
 * Posisi keuangan yang dikirim ke asisten di SETIAP pesan, dihitung dari data lokal terbaru memakai fungsi
 * yang sama dengan layar app (computeWalletStats, getBucketBalance, getActiveDebts, getSpendingSummary) —
 * jadi angka yang dijawab asisten = angka yang terlihat di Dompet / Tabungan / Hutang / Budget.
 * Hanya angka ringkasan yang keluar dari device (tidak ada transaksi mentah).
 */
export interface AssistantSnapshot {
  wallets: Array<{ id: string; name: string; balance: number }>;
  wallets_total: number;
  savings_buckets: Array<{ id: string; name: string; balance: number; target: number; status: string }>;
  savings_total: number;
  /** Piutang aktif (uang yang masih dipinjam orang dari user). */
  receivable: number;
  /** Hutang aktif (uang yang masih harus dibayar user). */
  payable: number;
  this_month: { income: number; expense: number };
  last_month: { income: number; expense: number };
  budgets_this_month: Array<{ cat_id: string; limit: number; used: number; remaining: number }>;
}

function monthIncomeExpense(transactions: SyncableRecord[], month: string) {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (!(t.date as string)?.startsWith(month)) continue;
    if (t.type === 'income') income += t.amount as number;
    else if (t.type === 'expense') expense += t.amount as number;
  }
  return { income, expense };
}

export function buildAssistantSnapshot(input: {
  wallets: SyncableRecord[];
  transactions: SyncableRecord[];
  savingBuckets: SyncableRecord[];
  savingTxs: SyncableRecord[];
  debts: SyncableRecord[];
  budgets: SyncableRecord[];
  month: string;
}): AssistantSnapshot {
  const { wallets, transactions, savingBuckets, savingTxs, debts, budgets, month } = input;

  const stats = computeWalletStats(wallets, transactions);
  const walletList = wallets.map((w) => ({
    id: w.id as string,
    name: w.name as string,
    balance: stats[w.id as string]?.balance ?? 0
  }));

  const buckets = savingBuckets.map((b) => ({
    id: b.id as string,
    name: b.name as string,
    balance: getBucketBalance(b.id as string, savingTxs),
    target: (b.target as number) || 0,
    status: (b.status as string) || 'active'
  }));

  const active = getActiveDebts(debts);
  const sumRemaining = (dtype: 'borrowed' | 'lent') =>
    active.filter((d) => d.dtype === dtype).reduce((s, d) => s + Math.max(d.remaining, 0), 0);

  const spent = Object.fromEntries(getSpendingSummary(transactions, month).by_category.map((c) => [c.cat_id, c.amount]));
  const budgetRows = budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const limit = (b.limit_amount as number) || 0;
      const used = spent[b.cat_id as string] ?? 0;
      return { cat_id: b.cat_id as string, limit, used, remaining: limit - used };
    });

  return {
    wallets: walletList,
    wallets_total: walletList.reduce((s, w) => s + w.balance, 0),
    savings_buckets: buckets,
    savings_total: buckets.reduce((s, b) => s + b.balance, 0),
    receivable: sumRemaining('lent'),
    payable: sumRemaining('borrowed'),
    this_month: monthIncomeExpense(transactions, month),
    last_month: monthIncomeExpense(transactions, getPreviousMonth(month)),
    budgets_this_month: budgetRows
  };
}
