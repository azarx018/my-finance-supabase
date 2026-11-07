<script lang="ts">
  import AssistantDock from '$lib/components/AssistantDock.svelte';
  import { reveal } from '$lib/actions/reveal';
  import Icon from '$lib/components/Icon.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { savingBuckets, savingTxs } from '$lib/stores/data';
  import { getBucketBalance, getSavingTotal, getSavingFlow, countMismatches, type SavingMismatch } from '$lib/data/saving';
  import { formatRp, formatRpC, todayStr } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import { upsertRecord } from '$lib/db/repo';
  import { deleteBucketCascade, checkSavingConsistency, repairSavingMismatches } from '$lib/db/savingOps';
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

  // Hapus kantong + semua riwayatnya dalam satu transaksi atomic (savingOps.ts).
  // Saldo dompet otomatis kembali karena transaksi cerminnya ikut terhapus.
  async function removeBucket(b: SyncableRecord) {
    if (!confirm(`Hapus kantong "${b.name}"? Transaksi terkait akan dihapus dan saldo dikembalikan.`)) return;
    await deleteBucketCascade(b.id);
    showToast('Kantong dihapus, saldo dikembalikan', 'info');
  }

  // Ringkasan: total semua kantong + gerakan bulan ini.
  $: total = getSavingTotal($savingBuckets, $savingTxs);
  $: monthFrom = todayStr().slice(0, 8) + '01';
  $: flow = getSavingFlow($savingTxs, monthFrom, todayStr());

  // Cek konsistensi: setiap setoran/penarikan harus punya pasangan di dompet (dan sebaliknya).
  let checked: SavingMismatch | null = null;
  let repairing = false;
  function runCheck() {
    checked = checkSavingConsistency();
    if (countMismatches(checked) === 0) showToast('Semua data tabungan cocok ✅');
  }
  async function runRepair() {
    if (!checked || repairing) return;
    repairing = true;
    try {
      const n = await repairSavingMismatches(checked);
      showToast(`${n} data diperbaiki`);
      checked = checkSavingConsistency();
    } finally {
      repairing = false;
    }
  }
</script>

<div class="p-4 flex flex-col gap-4 page-wrap">
  <div class="flex gap-2 span-all">
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

  <section class="bg-base-card rounded-xl shadow-sm p-4 border border-border span-all">
    <p class="text-xs text-txt-secondary">Total tabungan</p>
    <p class="text-2xl font-extrabold tabular-nums mt-0.5" style="color: var(--info)">{formatRp(total)}</p>
    <p class="text-[11px] text-txt-secondary mt-1">
      Bulan ini: ditabung {formatRpC(flow.deposited)} · ditarik {formatRpC(flow.withdrawn)}
    </p>
    <p class="text-[11px] text-txt-secondary mt-1">
      Uang di kantong tetap dihitung di Total Kekayaan, tapi tidak bisa dipakai belanja sebelum ditarik.
    </p>
  </section>

  <AssistantDock screen="tabungan" />

  {#if list.length === 0}
    <p class="text-xs text-txt-secondary text-center py-16 span-all">
      {tab === 'active' ? 'Belum ada kantong tabungan. Tap + untuk membuat.' : 'Belum ada kantong yang selesai.'}
    </p>
  {/if}

  {#each list as b (b.id)}
    {@const bal = getBucketBalance(b.id, $savingTxs)}
    {@const pct = b.target && (b.target as number) > 0 ? Math.min(Math.round((bal / (b.target as number)) * 100), 100) : null}
    <div use:reveal class="bg-base-card rounded-xl shadow-sm p-4 border border-border">
      <div class="flex items-center gap-3">
        <span class="em-tile" style="--k: var(--coin)">{b.emoji}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-txt-primary truncate">
            {b.name}
            {#if b.status === 'completed'}
              <span
                class="text-[10px] font-semibold rounded-full px-2 py-0.5 ml-1"
                style="color: var(--income); background: var(--income-bg)"
              >
                <Icon name="check" /> Selesai
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
          <div class="bar-track rounded-full overflow-hidden">
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
            <Icon name="up" /> Tabung
          </button>
        {/if}
        <button
          on:click={() => openTx('withdraw', b.id)}
          class="flex-1 text-xs py-2 rounded-lg"
          style="background: var(--expense-bg); color: var(--expense)"
        >
          <Icon name="down" /> Tarik
        </button>
        {#if b.status !== 'completed'}
          <button on:click={() => openEditBucket(b)} class="text-xs py-2 px-3 rounded-lg border border-border"><Icon name="edit" /></button>
        {/if}
        <button on:click={() => toggleComplete(b)} class="text-xs py-2 px-3 rounded-lg border border-border">
          <Icon name={b.status === 'completed' ? 'unlock' : 'flag'} />
        </button>
        <button
          on:click={() => removeBucket(b)}
          class="text-xs py-2 px-3 rounded-lg border border-border"
          style="color: var(--expense)"
        >
          <Icon name="trash" />
        </button>
      </div>
    </div>
  {/each}

  <section class="span-all flex flex-col gap-2 items-start">
    <button on:click={runCheck} class="text-xs underline text-txt-secondary">Cek kecocokan data tabungan</button>
    {#if checked && countMismatches(checked) > 0}
      <div class="rounded-xl p-3 border border-border text-xs w-full" style="background: var(--expense-bg)">
        <p class="font-semibold" style="color: var(--expense)">
          Ada {countMismatches(checked)} data yang tidak berpasangan
        </p>
        <p class="text-txt-secondary mt-1">
          {checked.missingMirror.length} setoran/penarikan belum tercatat di dompet ·
          {checked.missingSavingTx.length} potongan dompet belum masuk ke kantong ·
          {checked.orphanMirror.length} menunjuk kantong yang tidak ada.
        </p>
        {#if checked.missingMirror.length + checked.missingSavingTx.length > 0}
          <button
            on:click={runRepair}
            disabled={repairing}
            class="mt-2 px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-60"
            style="background: var(--primary)"
          >
            {repairing ? 'Memperbaiki…' : 'Perbaiki otomatis'}
          </button>
        {/if}
        {#if checked.orphanMirror.length > 0}
          <p class="text-txt-secondary mt-2">Data yang menunjuk kantong hilang perlu dicek manual di Riwayat.</p>
        {/if}
      </div>
    {/if}
  </section>
</div>

<BucketSheet open={bucketSheetOpen} editing={editingBucket} onClose={() => (bucketSheetOpen = false)} />
<SavingTxSheet
  open={txSheetOpen}
  mode={txMode}
  bucketId={txBucketId}
  onClose={() => (txSheetOpen = false)}
/>
