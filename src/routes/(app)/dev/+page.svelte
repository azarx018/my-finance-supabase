<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import { db, type SyncableRecord } from '$lib/db/dexie';
  import { upsertRecord } from '$lib/db/repo';
  import { flushQueue } from '$lib/sync/engine';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';

  let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let pending = 0;
  let wallets: SyncableRecord[] = [];
  let adding = false;

  onMount(() => {
    const onOnline = () => (online = true);
    const onOffline = () => (online = false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const queueSub = liveQuery(() => db.syncQueue.count()).subscribe({
      next: (v) => (pending = v),
      error: console.error
    });
    const walletSub = liveQuery(() =>
      db.wallets.toArray().then((rows) => rows.filter((r) => !r.deleted_at))
    ).subscribe({
      next: (rows) => (wallets = rows),
      error: console.error
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      queueSub.unsubscribe();
      walletSub.unsubscribe();
    };
  });

  async function addSampleWallet() {
    adding = true;
    const names = ['Dompet Tunai', 'Rekening Bank', 'E-Wallet'];
    await upsertRecord('wallets', {
      name: names[wallets.length % names.length],
      emoji: '👛',
      initial_balance: 0
    });
    adding = false;
  }
</script>

<div class="p-4 flex flex-col gap-6 max-w-md mx-auto">
  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Preview tema</h2>
    <ThemeSwitcher />
  </section>

  <section class="rounded-lg border border-border p-4 flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <p class="text-xs font-medium text-txt-primary">Status sync</p>
      <span
        class="text-xs px-2 py-0.5 rounded-full"
        style={online
          ? 'background: var(--income-bg); color: var(--income)'
          : 'background: var(--expense-bg); color: var(--expense)'}
      >
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
    <p class="text-xs text-txt-secondary">
      Menunggu dikirim: <span class="font-medium text-txt-primary">{pending}</span>
    </p>

    <button
      on:click={addSampleWallet}
      disabled={adding}
      class="rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
      style="background: var(--primary)"
    >
      + Tambah dompet contoh
    </button>
    <button
      on:click={() => flushQueue()}
      class="rounded-lg py-2 text-xs text-txt-secondary border border-border"
    >
      Paksa sync sekarang
    </button>

    {#if wallets.length > 0}
      <ul class="flex flex-col gap-1.5 mt-1">
        {#each wallets as w (w.id)}
          <li class="text-xs text-txt-secondary flex items-center gap-2">
            <span>{w.emoji}</span><span>{w.name}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
