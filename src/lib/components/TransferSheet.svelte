<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { parseAmt, todayStr, formatRpC } from '$lib/data/format';
  import { upsertRecord, softDeleteRecord, newId } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets, transactions } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null; // an existing type:'transfer' row
  export let onClose: () => void = () => {};

  let amountStr = '';
  let fromWalletId = '';
  let toWalletId = '';
  let date = todayStr();
  let note = '';
  let wasOpen = false;

  $: {
    if (open && !wasOpen) {
      amountStr = editing ? Number(editing.amount).toLocaleString('id-ID') : '';
      fromWalletId = (editing?.wallet_id as string) || $wallets[0]?.id || '';
      toWalletId = (editing?.to_wallet_id as string) || $wallets[1]?.id || '';
      date = (editing?.date as string) || todayStr();
      note = (editing?.note as string) || '';
    }
    wasOpen = open;
  }

  // Excludes the current transaction's own old amount from "from"
  // balance when editing, so editing a transfer doesn't double-count
  // money it already moved — same idea as TxSheet's selectedWalletEmpty
  // guard, just mirrored for a two-wallet operation.
  $: walletStats = computeWalletStats($wallets, $transactions);
  $: fromBalance =
    (walletStats[fromWalletId]?.balance ?? 0) +
    (editing?.wallet_id === fromWalletId ? (editing.amount as number) : 0);

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    const amount = parseAmt(amountStr);
    if (!amount || amount <= 0) {
      showToast('Nominal tidak boleh kosong', 'error');
      return;
    }
    if (!fromWalletId || !toWalletId) {
      showToast('Pilih dompet asal dan tujuan', 'error');
      return;
    }
    if (fromWalletId === toWalletId) {
      showToast('Dompet asal dan tujuan tidak boleh sama', 'error');
      return;
    }
    if (!date) {
      showToast('Tanggal tidak boleh kosong', 'error');
      return;
    }
    if (amount > fromBalance) {
      showToast('Saldo dompet asal tidak cukup', 'error');
      return;
    }

    const fromWallet = $wallets.find((w) => w.id === fromWalletId);
    const toWallet = $wallets.find((w) => w.id === toWalletId);

    await upsertRecord('transactions', {
      id: editing?.id ?? newId(),
      type: 'transfer',
      amount,
      description: `Transfer ${fromWallet?.name ?? ''} → ${toWallet?.name ?? ''}`,
      date,
      note: note.trim(),
      cat_id: null,
      wallet_id: fromWalletId,
      to_wallet_id: toWalletId
    });

    showToast(editing ? 'Transfer diperbarui' : 'Transfer dicatat');
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await softDeleteRecord('transactions', editing.id);
    showToast('Transfer dihapus', 'info');
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Transfer' : '🔁 Transfer Antar Dompet'}
  </h2>

  <div class="flex flex-col gap-3">
    <input
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      placeholder="Rp 0"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-lg font-semibold text-txt-primary"
    />

    <div>
      <label class="text-xs text-txt-secondary" for="transfer-from">Dari Dompet</label>
      <select
        id="transfer-from"
        bind:value={fromWalletId}
        class="w-full rounded-lg bg-base-input border border-border px-3 py-2.5 text-sm text-txt-primary mt-1"
      >
        {#each $wallets as w (w.id)}
          <option value={w.id}>{w.emoji} {w.name}</option>
        {/each}
      </select>
      <p class="text-[10px] text-txt-muted mt-1">Saldo saat ini: {formatRpC(fromBalance)}</p>
    </div>

    <div class="flex justify-center text-txt-muted">↓</div>

    <div>
      <label class="text-xs text-txt-secondary" for="transfer-to">Ke Dompet</label>
      <select
        id="transfer-to"
        bind:value={toWalletId}
        class="w-full rounded-lg bg-base-input border border-border px-3 py-2.5 text-sm text-txt-primary mt-1"
      >
        {#each $wallets as w (w.id)}
          <option value={w.id} disabled={w.id === fromWalletId}>{w.emoji} {w.name}</option>
        {/each}
      </select>
    </div>

    {#if fromWalletId && amountStr && parseAmt(amountStr) > fromBalance}
      <p class="text-xs" style="color: var(--expense)">Saldo dompet asal tidak cukup untuk transfer ini.</p>
    {/if}

    <input
      type="date"
      bind:value={date}
      class="w-full rounded-lg bg-base-input border border-border px-4 py-2.5 text-sm text-txt-primary"
    />

    <input
      bind:value={note}
      placeholder="Catatan (opsional)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-2.5 text-sm text-txt-primary"
    />

    <div class="flex gap-2 mt-2">
      {#if editing}
        <button
          on:click={remove}
          class="flex-1 py-3 rounded-lg text-sm font-medium border"
          style="color: var(--expense); border-color: var(--expense)"
        >
          Hapus
        </button>
      {/if}
      <button on:click={submit} class="flex-1 py-3 rounded-lg text-sm font-medium text-white" style="background: var(--primary)">
        {editing ? 'Update Transfer' : 'Simpan Transfer'}
      </button>
    </div>
  </div>
</BottomSheet>
