import type { SyncableRecord } from '$lib/db/dexie';

export interface WalletStat {
  balance: number;
  income: number;
  expense: number;
  count: number;
}

/**
 * Computes balance + income/expense/count for every wallet in one pass
 * over the transaction list, instead of re-filtering per wallet.
 * Ported 1:1 from features/wallet.js's computeWalletStats — same rules:
 * transfers move balance between wallets without touching income/expense,
 * saving_transfer/debt_transfer move cash but are never counted as real
 * income/expense either.
 */
export function computeWalletStats(
  wallets: SyncableRecord[],
  transactions: SyncableRecord[]
): Record<string, WalletStat> {
  const stats: Record<string, WalletStat> = {};
  wallets.forEach((w) => {
    stats[w.id] = { balance: (w.initial_balance as number) || 0, income: 0, expense: 0, count: 0 };
  });

  transactions.forEach((t) => {
    const walletId = t.wallet_id as string | undefined;
    if (walletId && stats[walletId]) stats[walletId].count++;

    if (t.type === 'transfer') {
      const toId = t.to_wallet_id as string | undefined;
      if (toId && stats[toId]) stats[toId].balance += t.amount as number;
      if (walletId && stats[walletId]) stats[walletId].balance -= t.amount as number;
      return;
    }
    if (t.type === 'saving_transfer') {
      const s = walletId ? stats[walletId] : undefined;
      if (!s) return;
      if (t.direction === 'withdraw') s.balance += t.amount as number;
      else s.balance -= t.amount as number;
      return;
    }
    if (t.type === 'debt_transfer') {
      const s = walletId ? stats[walletId] : undefined;
      if (!s) return;
      if (t.direction === 'in') s.balance += t.amount as number;
      else s.balance -= t.amount as number;
      return;
    }
    const s = walletId ? stats[walletId] : undefined;
    if (!s) return;
    if (t.type === 'income') {
      s.balance += t.amount as number;
      s.income += t.amount as number;
    } else if (t.type === 'expense') {
      s.balance -= t.amount as number;
      s.expense += t.amount as number;
    }
  });

  return stats;
}

export function getTotalNetWorth(wallets: SyncableRecord[], transactions: SyncableRecord[]): number {
  const stats = computeWalletStats(wallets, transactions);
  return wallets.reduce((s, w) => s + (stats[w.id]?.balance || 0), 0);
}
