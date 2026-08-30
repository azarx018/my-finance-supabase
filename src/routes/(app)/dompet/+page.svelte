<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { wallets, transactions } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { formatRpC } from '$lib/data/format';
  import { fabHandler } from '$lib/stores/fab';
  import WalletSheet from '$lib/components/WalletSheet.svelte';
  import TransferSheet from '$lib/components/TransferSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let sheetOpen = false;
  let editing: SyncableRecord | null = null;
  let transferOpen = false;

  function openAdd() {
    editing = null;
    sheetOpen = true;
  }
  function openEdit(w: SyncableRecord) {
    editing = w;
    sheetOpen = true;
  }
  function openTransfer() {
    transferOpen = true;
  }

  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  $: stats = computeWalletStats($wallets, $transactions);
</script>

<div class="p-4 flex flex-col gap-3 max-w-md mx-auto">
  {#if $wallets.length === 0}
    <p class="text-xs text-txt-secondary text-center py-16">
      Belum ada dompet. Tap tombol + di kanan bawah untuk menambah.
    </p>
  {/if}

  {#if $wallets.length >= 2}
    <button
      on:click={openTransfer}
      class="w-full text-sm font-medium py-2.5 rounded-lg border flex items-center justify-center gap-2"
      style="border-color: var(--primary); color: var(--primary)"
    >
      🔁 Transfer Antar Dompet
    </button>
  {/if}

  {#each $wallets as w (w.id)}
    <button
      on:click={() => openEdit(w)}
      class="flex items-center gap-3 bg-base-card rounded-xl shadow-sm p-4 border border-border text-left"
    >
      <span class="text-2xl">{w.emoji}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-txt-primary truncate">{w.name}</p>
        <p class="text-xs text-txt-secondary">{stats[w.id]?.count ?? 0} transaksi</p>
      </div>
      <p
        class="text-sm font-semibold shrink-0"
        style="color: {(stats[w.id]?.balance ?? 0) >= 0 ? 'var(--txt-primary)' : 'var(--expense)'}"
      >
        {formatRpC(stats[w.id]?.balance ?? 0)}
      </p>
    </button>
  {/each}
</div>

<WalletSheet open={sheetOpen} {editing} walletCount={$wallets.length} onClose={() => (sheetOpen = false)} />
<TransferSheet open={transferOpen} editing={null} onClose={() => (transferOpen = false)} />
