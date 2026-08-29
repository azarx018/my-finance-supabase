<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { transactions, wallets, customCategories } from '$lib/stores/data';
  import { filterTx, getDisplayType, type DateFilter } from '$lib/data/analytics';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { formatRp, formatDateShort } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import TxSheet from '$lib/components/TxSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let sheetOpen = false;
  let editing: SyncableRecord | null = null;
  let search = '';
  let typeF: 'all' | 'income' | 'expense' = 'all';
  let dateF: DateFilter = 'all';

  function openAdd() {
    editing = null;
    sheetOpen = true;
  }
  function openEdit(t: SyncableRecord) {
    if (t.type === 'saving_transfer' || t.type === 'debt_transfer') return;
    editing = t;
    sheetOpen = true;
  }

  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  $: list = filterTx($transactions, dateF, typeF, search);

  function walletOf(id: string) {
    return $wallets.find((w) => w.id === id);
  }
  function catOf(t: SyncableRecord) {
    const dt = getDisplayType(t);
    const custom = $customCategories.filter((c) => c.type === dt) as unknown as Cat[];
    return getCatList(dt, custom).find((c) => c.id === t.cat_id);
  }
</script>

<div class="p-4 flex flex-col gap-3 max-w-md mx-auto">
  <input
    bind:value={search}
    placeholder="Cari transaksi…"
    class="w-full rounded-lg bg-base-input border border-border px-4 py-2.5 text-sm text-txt-primary"
  />

  <div class="flex gap-2">
    <select
      bind:value={typeF}
      class="flex-1 rounded-lg bg-base-input border border-border px-3 py-2 text-xs text-txt-primary"
    >
      <option value="all">Semua Tipe</option>
      <option value="income">Pemasukan</option>
      <option value="expense">Pengeluaran</option>
    </select>
    <select
      bind:value={dateF}
      class="flex-1 rounded-lg bg-base-input border border-border px-3 py-2 text-xs text-txt-primary"
    >
      <option value="all">Semua Waktu</option>
      <option value="today">Hari Ini</option>
      <option value="week">Minggu Ini</option>
      <option value="month">Bulan Ini</option>
      <option value="year">Tahun Ini</option>
    </select>
  </div>

  {#if list.length === 0}
    <p class="text-xs text-txt-secondary text-center py-16">Belum ada transaksi yang cocok.</p>
  {/if}

  {#each list as t (t.id)}
    {@const cat = catOf(t)}
    {@const w = walletOf(t.wallet_id as string)}
    {@const dt = getDisplayType(t)}
    {@const isLinked = t.type === 'saving_transfer' || t.type === 'debt_transfer'}
    {#if isLinked}
      <div class="flex items-center gap-3 bg-base-card rounded-xl shadow-sm p-3 border border-border text-left">
        <span class="text-xl">{cat?.emoji ?? '💸'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-txt-primary truncate">{t.description}</p>
          <p class="text-xs text-txt-secondary truncate">
            {cat?.name ?? ''} · {w?.emoji ?? ''} {w?.name ?? ''} · {formatDateShort(t.date as string)}
            <span class="text-txt-muted">· 🔒 kelola dari {t.type === 'saving_transfer' ? 'Tabungan' : 'Hutang'}</span>
          </p>
        </div>
        <p class="text-sm font-semibold shrink-0" style="color: {dt === 'income' ? 'var(--income)' : 'var(--expense)'}">
          {dt === 'income' ? '+' : '-'}{formatRp(t.amount as number)}
        </p>
      </div>
    {:else}
      <button
        on:click={() => openEdit(t)}
        class="flex items-center gap-3 bg-base-card rounded-xl shadow-sm p-3 border border-border text-left"
      >
        <span class="text-xl">{cat?.emoji ?? '💸'}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-txt-primary truncate">{t.description}</p>
          <p class="text-xs text-txt-secondary truncate">
            {cat?.name ?? ''} · {w?.emoji ?? ''} {w?.name ?? ''} · {formatDateShort(t.date as string)}
          </p>
        </div>
        <p class="text-sm font-semibold shrink-0" style="color: {dt === 'income' ? 'var(--income)' : 'var(--expense)'}">
          {dt === 'income' ? '+' : '-'}{formatRp(t.amount as number)}
        </p>
      </button>
    {/if}
  {/each}
</div>

<TxSheet open={sheetOpen} {editing} onClose={() => (sheetOpen = false)} />
