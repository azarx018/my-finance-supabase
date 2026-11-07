import { get } from 'svelte/store';
import { atomic, upsertRecord, softDeleteRecord } from './repo';
import { wallets, transactions, savingBuckets, savingTxs } from '$lib/stores/data';
import { getBucketBalance, getWalletBalanceAsOf, findSavingMismatches, type SavingMismatch } from '$lib/data/saving';
import { computeWalletStats } from '$lib/data/wallets';
import type { SyncableRecord } from './dexie';

/**
 * SATU-SATUNYA pintu untuk mengubah tabungan. Sheet Tabungan, Asisten AI, dan hapus kantong
 * semuanya lewat sini supaya aturannya sama dan dua tabel (`saving_txs` + cermin
 * `transactions`) selalu ditulis bersamaan (atomic) — tidak ada lagi uang "dobel" atau "hilang".
 */
export type OpResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): OpResult => ({ ok: false, error });

export interface SavingMove {
  bucketId: string;
  walletId: string;
  amount: number;
  date: string;
  note?: string;
}

async function writePair(
  kind: 'deposit' | 'withdraw',
  m: SavingMove,
  bucketName: string,
  descOverride?: string
): Promise<void> {
  const note = (m.note ?? '').trim();
  await upsertRecord('saving_txs', {
    bucket_id: m.bucketId,
    wallet_id: m.walletId,
    type: kind,
    amount: m.amount,
    date: m.date,
    note
  });
  await upsertRecord('transactions', {
    type: 'saving_transfer',
    direction: kind,
    amount: m.amount,
    cat_id: 'saving_transfer',
    description: descOverride ?? (kind === 'deposit' ? `Tabung → ${bucketName}` : `Tarik ← ${bucketName}`),
    date: m.date,
    wallet_id: m.walletId,
    note,
    photo: null,
    bucket_id: m.bucketId
  });
}

export async function depositToBucket(m: SavingMove): Promise<OpResult> {
  const bucket = get(savingBuckets).find((b) => b.id === m.bucketId);
  if (!bucket) return fail('Kantong tabungan tidak ditemukan');
  if (bucket.status === 'completed') return fail('Kantong ini sudah selesai — buka lagi dulu untuk menabung');
  if (!(m.amount > 0)) return fail('Masukkan jumlah');
  const ws = get(wallets);
  const txs = get(transactions);
  if (!ws.some((w) => w.id === m.walletId)) return fail('Pilih dompet');

  const now = computeWalletStats(ws, txs)[m.walletId]?.balance ?? 0;
  const atDate = getWalletBalanceAsOf(m.walletId, ws, txs, m.date);
  if (now < m.amount || atDate < m.amount) return fail('Saldo dompet tidak cukup');

  await atomic(['saving_txs', 'transactions'], () => writePair('deposit', m, bucket.name as string));
  return { ok: true };
}

export async function withdrawFromBucket(m: SavingMove): Promise<OpResult> {
  const bucket = get(savingBuckets).find((b) => b.id === m.bucketId);
  if (!bucket) return fail('Kantong tabungan tidak ditemukan');
  if (!(m.amount > 0)) return fail('Masukkan jumlah');
  if (!get(wallets).some((w) => w.id === m.walletId)) return fail('Pilih dompet');

  const stx = get(savingTxs);
  if (getBucketBalance(m.bucketId, stx) < m.amount || getBucketBalance(m.bucketId, stx, m.date) < m.amount) {
    return fail('Saldo tabungan tidak cukup');
  }
  await atomic(['saving_txs', 'transactions'], () => writePair('withdraw', m, bucket.name as string));
  return { ok: true };
}

/** Kantong baru + setoran pertama dalam satu unit (dipakai Asisten AI). */
export async function createBucketWithDeposit(p: {
  name: string;
  emoji?: string;
  target?: number;
  walletId: string;
  amount: number;
  date: string;
  note?: string;
}): Promise<OpResult> {
  if (!(p.amount > 0)) return fail('Masukkan jumlah');
  const ws = get(wallets);
  const txs = get(transactions);
  if (!ws.some((w) => w.id === p.walletId)) return fail('Pilih dompet');
  const now = computeWalletStats(ws, txs)[p.walletId]?.balance ?? 0;
  if (now < p.amount || getWalletBalanceAsOf(p.walletId, ws, txs, p.date) < p.amount) {
    return fail('Saldo dompet tidak cukup');
  }
  await atomic(['saving_buckets', 'saving_txs', 'transactions'], async () => {
    const bucket = await upsertRecord('saving_buckets', {
      name: p.name,
      emoji: p.emoji ?? '🐷',
      target: p.target ?? 0,
      status: 'active'
    });
    await writePair('deposit', { bucketId: bucket.id, walletId: p.walletId, amount: p.amount, date: p.date, note: p.note }, p.name);
  });
  return { ok: true };
}

/** Hapus kantong + semua riwayatnya dalam SATU transaksi (dulu bisa setengah jalan). Saldo dompet otomatis kembali. */
export async function deleteBucketCascade(bucketId: string): Promise<void> {
  const stx = get(savingTxs).filter((x) => x.bucket_id === bucketId);
  const mirrors = get(transactions).filter((x) => x.bucket_id === bucketId);
  await atomic(['saving_buckets', 'saving_txs', 'transactions'], async () => {
    await softDeleteRecord('saving_buckets', bucketId);
    for (const t of stx) await softDeleteRecord('saving_txs', t.id);
    for (const t of mirrors) await softDeleteRecord('transactions', t.id);
  });
}

export function checkSavingConsistency(): SavingMismatch {
  return findSavingMismatches(get(savingBuckets), get(savingTxs), get(transactions));
}

/** Perbaiki yang aman: buat pasangan yang hilang. Yang yatim (kantong tidak ada) hanya dilaporkan. */
export async function repairSavingMismatches(
  m: SavingMismatch,
  buckets: SyncableRecord[] = get(savingBuckets)
): Promise<number> {
  let fixed = 0;
  await atomic(['saving_txs', 'transactions'], async () => {
    for (const s of m.missingMirror) {
      const name = (buckets.find((b) => b.id === s.bucket_id)?.name as string) ?? 'Tabungan';
      await upsertRecord('transactions', {
        type: 'saving_transfer',
        direction: s.type,
        amount: s.amount,
        cat_id: 'saving_transfer',
        description: s.type === 'deposit' ? `Tabung → ${name}` : `Tarik ← ${name}`,
        date: s.date,
        wallet_id: s.wallet_id,
        note: (s.note as string) ?? '',
        photo: null,
        bucket_id: s.bucket_id
      });
      fixed++;
    }
    for (const t of m.missingSavingTx) {
      await upsertRecord('saving_txs', {
        bucket_id: t.bucket_id,
        wallet_id: t.wallet_id,
        type: t.direction,
        amount: t.amount,
        date: t.date,
        note: (t.note as string) ?? ''
      });
      fixed++;
    }
  });
  return fixed;
}
