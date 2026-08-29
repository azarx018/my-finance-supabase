<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { savingBuckets, savingTxs, transactions } from '$lib/stores/data';
  import { getBucketBalance } from '$lib/data/saving';
  import { formatRp, formatRpC } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import { upsertRecord, softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import BucketSheet from '$lib/components/BucketSheet.svelte';
  import SavingTxSheet from '$lib/components/SavingTxSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let tab: 'active' | 'completed' = 'active';
  let bucketSheetOpen = false;
  let editingBucket: SyncableRecord | null = null;
  let txSheetOpen = false;
  let txMode: 'deposit' | 'withdraw' = 'deposit';
  let txBucketId: string | null = null;

  function openAddBucket() {
    editingBucket = null;
    bucketSheetOpen = true;
  }
  function openEditBucket(b: SyncableRecord) {
    editingBucket = b;
    bucketSheetOpen = true;
  }
  function openTx(mode: 'deposit' | 'withdraw', bucketId: string) {
    txMode = mode;
    txBucketId = bucketId;
    txSheetOpen = true;
  }

  onMount(() => fabHandler.set(openAddBucket));
  onDestroy(() => fabHandler.set(null));

  $: list = $savingBuckets.filter((b) =>
    tab === 'active' ? b.status !== 'completed' : b.status === 'completed'
  );

  async function toggleComplete(b: SyncableRecord) {
    const nowCompleted = b.status !== 'completed';
    await upsertRecord('saving_buckets', { id: b.id, status: nowCompleted ? 'completed' : 'active' });
    showToast(nowCompleted ? 'Kantong ditandai selesai 🏁' : 'Kantong dibuka lagi');
  }

  // Mirrors deleteSavingBucket() in the original: soft-delete the bucket
  // plus every saving_tx and transaction tied to it. Wallet balances are
  // restored automatically since those transactions stop counting once
  // marked deleted.
  async function removeBucket(b: SyncableRecord) {
    if (!confirm(`Hapus kantong "${b.name}"? Transaksi terkait akan dihapus dan saldo dikembalikan.`)) return;
    await softDeleteRecord('saving_buckets', b.id);
    for (const t of $savingTxs.filter((x) => x.bucket_id === b.id)) {
      await softDeleteRecord('saving_txs', t.id);
    }
    for (const t of $transactions.filter((x) => x.bucket_id === b.id)) {
      await softDeleteRecord('transactions', t.id);
    }
    showToast('Kantong dihapus, saldo dikembalikan', 'info');
  }
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <div class="flex gap-2">
    <button
      on:click={() => (tab = 'active')}
      class="flex-1 py-2 rounded-lg text-xs font-medium border"
      style="border-color: {tab === 'active'
        ? 'var(--primary)'
        : 'var(--border)'}; background: {tab === 'active' ? 'var(--primary-bg)' : 'var(--bg-card)'}; color: {tab ===
      'active'
        ? 'var(--primary)'
        : 'var(--txt-secondary)'}"
    >
      Aktif
    </button>
    <button
      on:click={() => (tab = 'completed')}
      class="flex-1 py-2 rounded-lg text-xs font-medium border"
      style="border-color: {tab === 'completed'
        ? 'var(--primary)'
        : 'var(--border)'}; background: {tab === 'completed' ? 'var(--primary-bg)' : 'var(--bg-card)'}; color: {tab ===
      'completed'
        ? 'var(--primary)'
        : 'var(--txt-secondary)'}"
    >
      Selesai
    </button>
  </div>

  {#if list.length === 0}
    <p class="text-xs text-txt-secondary text-center py-16">
      {tab === 'active' ? 'Belum ada kantong tabungan. Tap + untuk membuat.' : 'Belum ada kantong yang selesai.'}
    </p>
  {/if}

  {#each list as b (b.id)}
    {@const bal = getBucketBalance(b.id, $savingTxs)}
    {@const pct = b.target && (b.target as number) > 0 ? Math.min(Math.round((bal / (b.target as number)) * 100), 100) : null}
    <div class="bg-base-card rounded-xl shadow-sm p-4 border border-border">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{b.emoji}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-txt-primary truncate">
            {b.name}
            {#if b.status === 'completed'}
              <span
                class="text-[10px] font-semibold rounded-full px-2 py-0.5 ml-1"
                style="color: var(--income); background: var(--income-bg)"
              >
                ✅ Selesai
              </span>
            {/if}
          </p>
          {#if pct !== null}
            <p class="text-xs text-txt-secondary">{pct}% dari target</p>
          {/if}
        </div>
        <p class="text-sm font-semibold shrink-0" style="color: var(--info)">{formatRp(bal)}</p>
      </div>

      {#if b.target && (b.target as number) > 0}
        <div class="mt-3">
          <div class="flex justify-between text-[10px] text-txt-secondary mb-1">
            <span>{formatRpC(bal)} tersimpan</span><span>Target {formatRpC(b.target as number)}</span>
          </div>
          <div class="h-1.5 rounded-full bg-base-card2 overflow-hidden">
            <div class="h-full rounded-full" style="width: {pct}%; background: var(--primary)"></div>
          </div>
        </div>
      {/if}

      <div class="flex gap-2 mt-3 flex-wrap">
        {#if b.status !== 'completed'}
          <button
            on:click={() => openTx('deposit', b.id)}
            class="flex-1 text-xs py-2 rounded-lg"
            style="background: var(--primary-bg); color: var(--primary)"
          >
            ⬆️ Tabung
          </button>
        {/if}
        <button
          on:click={() => openTx('withdraw', b.id)}
          class="flex-1 text-xs py-2 rounded-lg"
          style="background: var(--expense-bg); color: var(--expense)"
        >
          ⬇️ Tarik
        </button>
        {#if b.status !== 'completed'}
          <button on:click={() => openEditBucket(b)} class="text-xs py-2 px-3 rounded-lg border border-border">✏️</button>
        {/if}
        <button on:click={() => toggleComplete(b)} class="text-xs py-2 px-3 rounded-lg border border-border">
          {b.status === 'completed' ? '🔓' : '🏁'}
        </button>
        <button
          on:click={() => removeBucket(b)}
          class="text-xs py-2 px-3 rounded-lg border border-border"
          style="color: var(--expense)"
        >
          🗑️
        </button>
      </div>
    </div>
  {/each}
</div>

<BucketSheet open={bucketSheetOpen} editing={editingBucket} onClose={() => (bucketSheetOpen = false)} />
<SavingTxSheet
  open={txSheetOpen}
  mode={txMode}
  bucketId={txBucketId}
  onClose={() => (txSheetOpen = false)}
/>
