<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { parseAmt, todayStr, formatRp } from '$lib/data/format';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets } from '$lib/stores/data';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let debt: SyncableRecord | null = null;
  export let onClose: () => void = () => {};

  let amountStr = '';
  let date = todayStr();
  let note = '';
  let walletId = '';

  $: isLent = debt?.dtype === 'lent';
  $: paidSoFar = (debt?.paid_amount as number) || 0;
  $: total = (debt?.amount as number) || 0;
  $: remaining = total - paidSoFar;
  $: pct = total > 0 ? Math.min(100, Math.round((paidSoFar / total) * 100)) : 0;

  let wasOpen = false;
  $: if (open && !wasOpen) {
    amountStr = '';
    date = todayStr();
    note = '';
    walletId = (debt?.wallet_id as string) || $wallets[0]?.id || '';
  }
  $: wasOpen = open;

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }
  function fillHalf() {
    amountStr = Math.ceil(remaining / 2).toLocaleString('id-ID');
  }
  function fillFull() {
    amountStr = remaining.toLocaleString('id-ID');
  }

  async function submit() {
    if (!debt) return;
    const amount = parseAmt(amountStr);
    if (!amount) {
      showToast('Masukkan jumlah pembayaran', 'error');
      return;
    }
    if (!date) {
      showToast('Tanggal tidak boleh kosong', 'error');
      return;
    }
    if (amount > remaining) {
      showToast(`Melebihi sisa hutang (${formatRp(remaining)})`, 'error');
      return;
    }

    await upsertRecord('debt_payments', {
      debt_id: debt.id,
      amount,
      date,
      note: note.trim(),
      wallet_id: walletId
    });

    const newPaidAmount = paidSoFar + amount;
    const nowFullyPaid = newPaidAmount >= total;
    await upsertRecord('debts', {
      id: debt.id,
      paid_amount: newPaidAmount,
      paid: nowFullyPaid,
      paid_date: nowFullyPaid ? date : ((debt.paid_date as string) ?? null)
    });

    // Same as debt creation: this is a debt_transfer, not real
    // income/expense — settling a liability/receivable isn't earning or
    // spending. borrowed paying back = cash out; lent receiving back = cash in.
    const direction = isLent ? 'in' : 'out';
    await upsertRecord('transactions', {
      type: 'debt_transfer',
      direction,
      amount,
      desc: isLent ? `Terima kembali dari ${debt.name}` : `Bayar hutang ke ${debt.name}`,
      date,
      wallet_id: walletId,
      cat_id: 'debt_transfer',
      note: note.trim() ? `[Cicilan] ${note.trim()}` : '[Cicilan hutang]',
      photo: null,
      debt_ref: debt.id
    });

    showToast(
      nowFullyPaid
        ? isLent
          ? 'Piutang lunas diterima kembali!'
          : 'Hutang lunas!'
        : isLent
          ? `+${formatRp(amount)} diterima kembali`
          : `Cicilan ${formatRp(amount)} dibayar`
    );
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  {#if debt}
    <h2 class="text-sm font-semibold mb-1 text-txt-primary">
      {isLent ? '💰 Terima Kembali' : '💳 Bayar Hutang'}
    </h2>
    <p class="text-xs text-txt-secondary mb-4">{isLent ? 'Dari' : 'Hutang ke'}: {debt.name}</p>

    <div class="bg-base-card2 rounded-lg p-3 mb-4">
      <div class="flex justify-between text-xs text-txt-secondary mb-1">
        <span>Terbayar {formatRp(paidSoFar)}</span><span>Total {formatRp(total)}</span>
      </div>
      <div class="h-1.5 rounded-full bg-base-card overflow-hidden">
        <div class="h-full rounded-full" style="width: {pct}%; background: var(--primary)"></div>
      </div>
      <p class="text-xs text-txt-secondary mt-1">Sisa: {formatRp(remaining)}</p>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex gap-2">
        <input
          value={amountStr}
          on:input={onAmountInput}
          inputmode="numeric"
          placeholder="Jumlah"
          class="flex-1 rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
        />
        <button on:click={fillHalf} class="px-3 rounded-lg border border-border text-xs text-txt-secondary">50%</button>
        <button on:click={fillFull} class="px-3 rounded-lg border border-border text-xs text-txt-secondary">Full</button>
      </div>

      <div class="flex gap-2 overflow-x-auto pb-1">
        {#each $wallets as w (w.id)}
          <button
            on:click={() => (walletId = w.id)}
            class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs shrink-0"
            style="border-color: {walletId === w.id
              ? 'var(--primary)'
              : 'var(--border)'}; background: {walletId === w.id ? 'var(--primary-bg)' : 'var(--bg-card)'}"
          >
            <span>{w.emoji}</span><span>{w.name}</span>
          </button>
        {/each}
      </div>

      <input
        bind:value={date}
        type="date"
        class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
      <input
        bind:value={note}
        placeholder="Catatan (opsional)"
        class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />

      <button
        on:click={submit}
        class="rounded-lg py-3 text-sm font-medium text-white mt-1"
        style="background: {isLent ? 'var(--primary)' : 'var(--expense)'}"
      >
        {isLent ? 'Catat Penerimaan Kembali' : 'Bayar Sekarang'}
      </button>
    </div>
  {/if}
</BottomSheet>
