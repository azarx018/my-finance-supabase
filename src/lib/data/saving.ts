import type { SyncableRecord } from '$lib/db/dexie';
import { computeWalletStats } from './wallets';
import { getDebtPosition } from './debt';

/**
 * Saldo satu kantong tabungan = total setoran − total penarikan.
 * `asOf` (YYYY-MM-DD, opsional) = hanya hitung transaksi sampai tanggal itu,
 * dipakai untuk memvalidasi transaksi yang tanggalnya mundur.
 */
export function getBucketBalance(bucketId: string, savingTxs: SyncableRecord[], asOf?: string): number {
  let bal = 0;
  for (const t of savingTxs) {
    if (t.bucket_id !== bucketId) continue;
    if (asOf && (t.date as string) > asOf) continue;
    if (t.type === 'deposit') bal += t.amount as number;
    else if (t.type === 'withdraw') bal -= t.amount as number;
  }
  return bal;
}

export function getSavingTotal(buckets: SyncableRecord[], savingTxs: SyncableRecord[]): number {
  return buckets.reduce((s, b) => s + getBucketBalance(b.id, savingTxs), 0);
}

/** Saldo satu dompet per akhir `asOf` (inklusif). */
export function getWalletBalanceAsOf(
  walletId: string,
  wallets: SyncableRecord[],
  transactions: SyncableRecord[],
  asOf: string
): number {
  const upTo = transactions.filter((t) => (t.date as string) <= asOf);
  return computeWalletStats(wallets, upTo)[walletId]?.balance ?? 0;
}

/**
 * Total kekayaan yang benar = saldo semua dompet + isi semua kantong tabungan + piutang − hutang.
 * Menabung hanya memindahkan uang (dompet → kantong); meminjam menambah dompet TAPI menambah hutang
 * dengan jumlah sama, jadi keduanya tidak mengubah kekayaan.
 */
export function getNetWorth(
  wallets: SyncableRecord[],
  transactions: SyncableRecord[],
  buckets: SyncableRecord[],
  savingTxs: SyncableRecord[],
  debts: SyncableRecord[] = []
): { wallets: number; savings: number; receivable: number; payable: number; total: number } {
  const stats = computeWalletStats(wallets, transactions);
  const w = wallets.reduce((s, x) => s + (stats[x.id]?.balance ?? 0), 0);
  const sv = getSavingTotal(buckets, savingTxs);
  const { receivable, payable } = getDebtPosition(debts);
  return { wallets: w, savings: sv, receivable, payable, total: w + sv + receivable - payable };
}

/** Setoran & penarikan tabungan dalam rentang tanggal (inklusif). */
export function getSavingFlow(
  savingTxs: SyncableRecord[],
  from: string,
  to: string
): { deposited: number; withdrawn: number; net: number } {
  let deposited = 0;
  let withdrawn = 0;
  for (const t of savingTxs) {
    const d = t.date as string;
    if (d < from || d > to) continue;
    if (t.type === 'deposit') deposited += t.amount as number;
    else if (t.type === 'withdraw') withdrawn += t.amount as number;
  }
  return { deposited, withdrawn, net: deposited - withdrawn };
}

export interface SavingMismatch {
  /** saving_txs ada, tapi transaksi cermin di dompet tidak ada → bucket bertambah, dompet tidak berkurang. */
  missingMirror: SyncableRecord[];
  /** transaksi cermin ada, tapi saving_txs tidak ada → dompet berkurang, bucket tidak bertambah. */
  missingSavingTx: SyncableRecord[];
  /** transaksi cermin menunjuk kantong yang tidak ada (terhapus / belum tersinkron). */
  orphanMirror: SyncableRecord[];
}

const sig = (bucket: unknown, kind: unknown, amount: unknown, date: unknown, wallet: unknown) =>
  `${bucket}|${kind}|${amount}|${date}|${wallet ?? ''}`;

/**
 * Dua tabel harus selalu berpasangan: setiap baris `saving_txs` punya satu
 * transaksi `saving_transfer` (cermin) di dompet. Kalau salah satu gagal sync,
 * uang bisa "hilang" atau "dobel". Fungsi ini mencocokkan keduanya (multiset,
 * tanpa kolom baru) supaya masalahnya kelihatan dan bisa diperbaiki.
 */
export function findSavingMismatches(
  buckets: SyncableRecord[],
  savingTxs: SyncableRecord[],
  transactions: SyncableRecord[]
): SavingMismatch {
  const bucketIds = new Set(buckets.map((b) => b.id));
  const mirrors = transactions.filter((t) => t.type === 'saving_transfer' && t.bucket_id);

  const pool = new Map<string, SyncableRecord[]>();
  for (const m of mirrors) {
    const k = sig(m.bucket_id, m.direction, m.amount, m.date, m.wallet_id);
    const arr = pool.get(k) ?? [];
    arr.push(m);
    pool.set(k, arr);
  }

  const missingMirror: SyncableRecord[] = [];
  for (const s of savingTxs) {
    const k = sig(s.bucket_id, s.type, s.amount, s.date, s.wallet_id);
    const arr = pool.get(k);
    if (arr && arr.length) arr.pop();
    else missingMirror.push(s);
  }

  const leftover = [...pool.values()].flat();
  const missingSavingTx = leftover.filter((m) => bucketIds.has(m.bucket_id as string));
  const orphanMirror = leftover.filter((m) => !bucketIds.has(m.bucket_id as string));
  return { missingMirror, missingSavingTx, orphanMirror };
}

export function countMismatches(m: SavingMismatch): number {
  return m.missingMirror.length + m.missingSavingTx.length + m.orphanMirror.length;
}
