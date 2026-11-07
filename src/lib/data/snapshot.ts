import type { SyncableRecord } from '$lib/db/dexie';
import { computeWalletStats } from './wallets';
import { getNetWorth, getBucketBalance } from './saving';
import { summarizePeriod, type PeriodStatus } from './cashflow';
import { effectiveBudget, shiftMonth } from './budget';

/**
 * SNAPSHOT KEUANGAN untuk Asisten AI.
 *
 * Dulu asisten hanya menerima NAMA dompet + ringkasan pengeluaran, tanpa saldo dan tanpa pemasukan. Akibatnya
 * "sisa duit gue berapa?" dijawab 0 kalau belum ada pemasukan tercatat — padahal dompet punya saldo bawaan.
 * Sekarang semua angka dihitung dengan fungsi YANG SAMA dengan Dashboard/Analitik/Budget (computeWalletStats,
 * getNetWorth, summarizePeriod, effectiveBudget), jadi asisten dan layar app tidak pernah berbeda angka.
 * Dihitung ulang tiap pesan dikirim, jadi selalu mengikuti data terbaru (termasuk hasil sync dari perangkat lain).
 */
export interface PeriodBrief {
  income: number;
  expense: number;
  cash_net: number; // pemasukan − pengeluaran murni
  carry_from_last_month: number;
  status: PeriodStatus;
  savings_rate: number;
  deposited_to_savings: number;
  withdrawn_from_savings: number;
}

export interface FinanceSnapshot {
  wallets: Array<{ id: string; name: string; balance: number }>;
  wallets_total: number;
  savings_buckets: Array<{ name: string; balance: number; target: number; status: string }>;
  savings_total: number;
  receivable: number;
  payable: number;
  net_worth: number;
  this_month: PeriodBrief;
  last_month: PeriodBrief;
  budgets_this_month: Array<{ cat_id: string; limit: number; carried: number; used: number; remaining: number }>;
}

const lastDayOf = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

function brief(
  wallets: SyncableRecord[],
  transactions: SyncableRecord[],
  from: string,
  to: string
): PeriodBrief {
  const s = summarizePeriod(wallets, transactions, from, to);
  return {
    income: s.income,
    expense: s.expense,
    cash_net: s.cashNet,
    carry_from_last_month: s.carry,
    status: s.status,
    savings_rate: s.rate,
    deposited_to_savings: s.deposited,
    withdrawn_from_savings: s.withdrawn
  };
}

export function buildFinanceSnapshot(input: {
  wallets: SyncableRecord[];
  transactions: SyncableRecord[];
  buckets: SyncableRecord[];
  savingTxs: SyncableRecord[];
  debts: SyncableRecord[];
  budgets: SyncableRecord[];
  today: string; // YYYY-MM-DD
}): FinanceSnapshot {
  const { wallets, transactions, buckets, savingTxs, debts, budgets, today } = input;
  const month = today.slice(0, 7);
  const prev = shiftMonth(month, -1);
  const live = transactions.filter((t) => !t.deleted_at);

  const stats = computeWalletStats(wallets, live);
  const worth = getNetWorth(wallets, live, buckets, savingTxs, debts);

  const used = (cat: string) =>
    live
      .filter((t) => t.type === 'expense' && t.cat_id === cat && (t.date as string).startsWith(month))
      .reduce((s, t) => s + (t.amount as number), 0);

  return {
    wallets: wallets.map((w) => ({ id: w.id, name: w.name as string, balance: stats[w.id]?.balance ?? 0 })),
    wallets_total: worth.wallets,
    savings_buckets: buckets.map((b) => ({
      name: b.name as string,
      balance: getBucketBalance(b.id, savingTxs),
      target: (b.target as number) || 0,
      status: (b.status as string) || 'active'
    })),
    savings_total: worth.savings,
    receivable: worth.receivable,
    payable: worth.payable,
    net_worth: worth.total,
    this_month: brief(wallets, live, `${month}-01`, today),
    last_month: brief(wallets, live, `${prev}-01`, lastDayOf(prev)),
    budgets_this_month: budgets
      .filter((b) => !b.deleted_at && b.month === month)
      .map((b) => {
        const eff = effectiveBudget(budgets, live, b.cat_id as string, month);
        const u = used(b.cat_id as string);
        return { cat_id: b.cat_id as string, limit: eff.limit, carried: eff.carried, used: u, remaining: eff.limit - u };
      })
  };
}
