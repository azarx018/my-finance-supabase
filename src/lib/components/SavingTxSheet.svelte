<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { parseAmt, todayStr, formatRpC } from '$lib/data/format';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets, transactions, savingBuckets, savingTxs } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { getBucketBalance } from '$lib/data/saving';

  export let open = false;
  export let mode: 'deposit' | 'withdraw' = 'deposit';
  export let bucketId: string | null = null;
  export let onClose: () => void = () => {};

  let selectedBucketId = '';
  let selectedWalletId = '';
  let amountStr = '';
  let date = todayStr();
  let note = '';

  $: pickable = mode === 'deposit' ? $savingBuckets.filter((b) => b.status !== 'completed') : $savingBuckets;

  let wasOpen = false;
  $: if (open && !wasOpen) {
    selectedBucketId = bucketId && pickable.some((b) => b.id === bucketId) ? bucketId : pickable[0]?.id || '';
    selectedWalletId = $wallets[0]?.id || '';
    amountStr = '';
    date = todayStr();
    note = '';
  }
  $: wasOpen = open;

  $: walletStats = computeWalletStats($wallets, $transactions);

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    if (!selectedBucketId) {
      showToast('Pilih kantong tabungan', 'error');
      return;
    }
    const amount = parseAmt(amountStr);
    if (!amount) {
      showToast('Masukkan jumlah', 'error');
      return;
    }
    if (!selectedWalletId) {
      showToast('Pilih dompet', 'error');
      return;
    }

    const bucket = $savingBuckets.find((b) => b.id === selectedBucketId);
    if (mode === 'deposit' && bucket?.status === 'completed') {
      showToast('Kantong ini sudah selesai — buka lagi dulu untuk menabung', 'error');
      return;
    }
    if (mode === 'deposit') {
      const bal = walletStats[selectedWalletId]?.balance ?? 0;
      if (bal < amount) {
        showToast('Saldo dompet tidak cukup', 'error');
        return;
      }
    } else {
      const bucketBal = getBucketBalance(selectedBucketId, $savingTxs);
      if (bucketBal < amount) {
        showToast('Saldo tabungan tidak cukup', 'error');
        return;
      }
    }

    await upsertRecord('saving_txs', {
      bucket_id: selectedBucketId,
      wallet_id: selectedWalletId,
      type: mode,
      amount,
      date,
      note: note.trim()
    });
    // Mirrors the wallet balance via a dedicated 'saving_transfer' type +
    // direction, exactly like the original — every income/expense filter
    // already excludes this type, so nothing extra to remember elsewhere.
    const desc = mode === 'deposit' ? `Tabung → ${bucket?.name || 'Tabungan'}` : `Tarik ← ${bucket?.name || 'Tabungan'}`;
    await upsertRecord('transactions', {
      type: 'saving_transfer',
      direction: mode,
      amount,
      cat_id: 'saving_transfer',
      desc,
      date,
      wallet_id: selectedWalletId,
      note: note.trim(),
      photo: null,
      bucket_id: selectedBucketId
    });

    showToast(mode === 'deposit' ? `Berhasil menabung ${formatRpC(amount)}` : `Berhasil menarik ${formatRpC(amount)}`);
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {mode === 'deposit' ? '⬆️ Tabung' : '⬇️ Tarik dari Tabungan'}
  </h2>
  <div class="flex flex-col gap-3">
    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each pickable as b (b.id)}
        <button
          on:click={() => (selectedBucketId = b.id)}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs shrink-0"
          style="border-color: {selectedBucketId === b.id
            ? 'var(--primary)'
            : 'var(--border)'}; background: {selectedBucketId === b.id ? 'var(--primary-bg)' : 'var(--bg-card)'}"
        >
          <span>{b.emoji}</span><span>{b.name}</span>
        </button>
      {/each}
    </div>

    <input
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      placeholder="Jumlah"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-lg font-semibold text-txt-primary"
    />

    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each $wallets as w (w.id)}
        <button
          on:click={() => (selectedWalletId = w.id)}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs shrink-0"
          style="border-color: {selectedWalletId === w.id
            ? 'var(--primary)'
            : 'var(--border)'}; background: {selectedWalletId === w.id ? 'var(--primary-bg)' : 'var(--bg-card)'}"
        >
          <span>{w.emoji}</span><span>{w.name}</span>
          <span class="opacity-70">({formatRpC(walletStats[w.id]?.balance ?? 0)})</span>
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
      style="background: {mode === 'deposit' ? 'var(--primary)' : 'var(--expense)'}"
    >
      {mode === 'deposit' ? 'Tabung' : 'Tarik'}
    </button>
  </div>
</BottomSheet>
