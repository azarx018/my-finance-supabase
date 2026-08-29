<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { debts as debtsStore, debtPayments } from '$lib/stores/data';
  import { formatRp, formatRpC, formatDateShort } from '$lib/data/format';
  import { daysUntil } from '$lib/data/debt';
  import { fabHandler } from '$lib/stores/fab';
  import { softDeleteRecord, upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import DebtSheet from '$lib/components/DebtSheet.svelte';
  import PaymentSheet from '$lib/components/PaymentSheet.svelte';
  import type { SyncableRecord } from '$lib/db/dexie';

  let filter: 'all' | 'unpaid' | 'paid' | 'urgent' = 'all';
  let debtSheetOpen = false;
  let editingDebt: SyncableRecord | null = null;
  let paySheetOpen = false;
  let payingDebt: SyncableRecord | null = null;

  function openAdd() {
    editingDebt = null;
    debtSheetOpen = true;
  }
  function openEdit(d: SyncableRecord) {
    editingDebt = d;
    debtSheetOpen = true;
  }
  function openPay(d: SyncableRecord) {
    payingDebt = d;
    paySheetOpen = true;
  }

  onMount(() => fabHandler.set(openAdd));
  onDestroy(() => fabHandler.set(null));

  $: list = $debtsStore.filter((d) => {
    if (filter === 'unpaid') return !d.paid;
    if (filter === 'paid') return !!d.paid;
    if (filter === 'urgent') return !d.paid && d.due_date && daysUntil(d.due_date as string) <= 7;
    return true;
  });
  $: sorted = [...list].sort((a, b) => {
    if (a.paid && !b.paid) return 1;
    if (!a.paid && b.paid) return -1;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return (a.due_date as string).localeCompare(b.due_date as string);
  });

  $: totalUnpaid = $debtsStore
    .filter((d) => !d.paid && d.dtype === 'borrowed')
    .reduce((s, d) => s + ((d.amount as number) - ((d.paid_amount as number) || 0)), 0);
  $: countUnpaid = $debtsStore.filter((d) => !d.paid).length;
  $: countPaid = $debtsStore.filter((d) => d.paid).length;
  $: nearest = $debtsStore
    .filter((d) => !d.paid && d.due_date)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))[0];
  $: nearestLabel = (() => {
    if (!nearest) return '-';
    const nd = daysUntil(nearest.due_date as string);
    return nd < 0 ? 'Lewat' : nd === 0 ? 'Hari ini' : nd + 'h';
  })();

  function paymentsFor(debtId: string) {
    return $debtPayments
      .filter((p) => p.debt_id === debtId)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      .slice(-2)
      .reverse();
  }

  async function markUnpaid(d: SyncableRecord) {
    await upsertRecord('debts', { id: d.id, paid: false, paid_date: null });
    showToast('Status dikembalikan ke belum lunas', 'info');
  }

  async function removeDebt(d: SyncableRecord) {
    if (!confirm(`Hapus catatan hutang "${d.name}"? Transaksi terkait tidak ikut terhapus otomatis.`)) return;
    await softDeleteRecord('debts', d.id);
    showToast('Hutang dihapus', 'info');
  }
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <section class="rounded-xl p-5 text-white shadow-lg" style="background: linear-gradient(135deg, var(--expense), #f97373)">
    <p class="text-sm opacity-80">Total Hutang Belum Lunas</p>
    <p class="text-2xl font-semibold mt-1">{formatRp(totalUnpaid)}</p>
    <div class="flex gap-4 mt-3 text-xs opacity-90">
      <span>{countUnpaid} belum lunas</span>
      <span>{countPaid} lunas</span>
      <span>Terdekat: {nearestLabel}</span>
    </div>
  </section>

  <div class="flex gap-2 overflow-x-auto pb-1">
    {#each [{ id: 'all', label: 'Semua' }, { id: 'unpaid', label: 'Belum Lunas' }, { id: 'paid', label: 'Lunas' }, { id: 'urgent', label: 'Mendesak' }] as f (f.id)}
      <button
        on:click={() => (filter = f.id as typeof filter)}
        class="px-3 py-1.5 rounded-full text-xs font-medium border shrink-0"
        style="border-color: {filter === f.id
          ? 'var(--primary)'
          : 'var(--border)'}; background: {filter === f.id ? 'var(--primary-bg)' : 'var(--bg-card)'}; color: {filter ===
        f.id
          ? 'var(--primary)'
          : 'var(--txt-secondary)'}"
      >
        {f.label}
      </button>
    {/each}
  </div>

  {#if sorted.length === 0}
    <p class="text-xs text-txt-secondary text-center py-12">
      {filter === 'urgent' ? 'Tidak ada hutang mendesak' : 'Belum ada hutang. Tap + untuk mencatat.'}
    </p>
  {/if}

  {#each sorted as d (d.id)}
    {@const remaining = (d.amount as number) - ((d.paid_amount as number) || 0)}
    {@const pct = (d.amount as number) > 0 ? Math.min(100, Math.round((((d.paid_amount as number) || 0) / (d.amount as number)) * 100)) : 0}
    {@const days = d.due_date ? daysUntil(d.due_date as string) : null}
    {@const isLent = d.dtype === 'lent'}
    {@const isUrgent = !d.paid && days !== null && days <= 3}
    {@const isWarn = !d.paid && days !== null && days > 3 && days <= 7}
    {@const dayLabel = days === null ? '-' : days < 0 ? `⚠️ Terlambat ${Math.abs(days)} hari` : days === 0 ? '⚠️ Jatuh tempo hari ini' : `${formatDateShort(d.due_date as string)} (${days} hari lagi)`}
    <div
      class="bg-base-card rounded-lg p-4 border"
      style="border-color: {d.paid ? 'var(--border)' : isUrgent ? 'var(--expense)' : isWarn ? 'var(--warn)' : 'var(--border)'}"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-sm font-medium text-txt-primary">{d.name}</p>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style="background: {isLent ? 'var(--info-bg)' : 'var(--primary-bg)'}; color: {isLent
                ? 'var(--info)'
                : 'var(--primary)'}"
            >
              {isLent ? 'Dipinjamkan' : 'Hutang'}
            </span>
          </div>
          {#if d.note}
            <p class="text-xs text-txt-secondary mt-0.5">{d.note}</p>
          {/if}
        </div>
        <div class="text-right shrink-0">
          {#if d.paid}
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style="background: var(--income-bg); color: var(--income)">✅ Lunas</span>
          {:else if isUrgent}
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style="background: var(--expense-bg); color: var(--expense)">🔴 Mendesak</span>
          {:else if isWarn}
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style="background: var(--warn-bg); color: var(--warn)">⚠️ Segera</span>
          {:else}
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style="background: var(--bg-card2); color: var(--txt-secondary)">Belum Lunas</span>
          {/if}
          <p class="text-sm font-semibold mt-1" style="color: {isLent ? 'var(--income)' : 'var(--expense)'}">
            {isLent ? '+' : '-'}{formatRpC(d.amount as number)}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div>
          <p class="text-txt-secondary">Sisa</p>
          <p class="font-medium" style="color: {d.paid ? 'var(--income)' : 'var(--expense)'}">
            {d.paid ? 'Lunas' : formatRpC(remaining)}
          </p>
        </div>
        <div>
          <p class="text-txt-secondary">Jatuh Tempo</p>
          <p class="font-medium" style="color: {isUrgent ? 'var(--expense)' : isWarn ? 'var(--warn)' : 'var(--txt-primary)'}">
            {dayLabel}
          </p>
        </div>
      </div>

      {#if !d.paid}
        <div class="mt-3">
          <div class="flex justify-between text-[10px] text-txt-secondary mb-1">
            <span>Terbayar {formatRpC((d.paid_amount as number) || 0)} dari {formatRpC(d.amount as number)}</span>
            <span style="color: {pct >= 100 ? 'var(--income)' : pct >= 50 ? 'var(--warn)' : 'var(--expense)'}">{pct}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-base-card2 overflow-hidden">
            <div class="h-full rounded-full" style="width: {pct}%; background: var(--primary)"></div>
          </div>
        </div>
      {/if}

      {#if paymentsFor(d.id).length > 0}
        <div class="mt-3 border-t border-border pt-2">
          <p class="text-[10px] text-txt-secondary mb-1">Riwayat Bayar</p>
          {#each paymentsFor(d.id) as p (p.id)}
            <div class="flex justify-between text-xs text-txt-secondary">
              <span>{formatDateShort(p.date as string)}</span>
              <span style="color: var(--expense)">-{formatRpC(p.amount as number)}</span>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex gap-2 mt-3 flex-wrap">
        {#if !d.paid}
          <button
            on:click={() => openPay(d)}
            class="flex-1 text-xs py-2 rounded-lg text-white"
            style="background: {isLent ? 'var(--info)' : 'var(--primary)'}"
          >
            {isLent ? '💰 Terima' : '💳 Bayar'}
          </button>
        {:else}
          <button on:click={() => markUnpaid(d)} class="flex-1 text-xs py-2 rounded-lg border border-border text-txt-secondary">
            ↩ Batal Lunas
          </button>
        {/if}
        <button on:click={() => openEdit(d)} class="text-xs py-2 px-3 rounded-lg border border-border text-txt-secondary">
          ✏️
        </button>
        <button on:click={() => removeDebt(d)} class="text-xs py-2 px-3 rounded-lg border border-border" style="color: var(--expense)">
          🗑️
        </button>
      </div>
    </div>
  {/each}
</div>

<DebtSheet open={debtSheetOpen} editing={editingDebt} onClose={() => (debtSheetOpen = false)} />
<PaymentSheet open={paySheetOpen} debt={payingDebt} onClose={() => (paySheetOpen = false)} />
