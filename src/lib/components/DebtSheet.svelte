<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { parseAmt, todayStr } from '$lib/data/format';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets, transactions } from '$lib/stores/data';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null;
  export let onClose: () => void = () => {};

  let dtype: 'borrowed' | 'lent' = 'borrowed';
  let name = '';
  let amountStr = '';
  let dueDate = '';
  let note = '';
  let walletId = '';

  let wasOpen = false;
  $: {
    if (open && !wasOpen) {
    dtype = (editing?.dtype as 'borrowed' | 'lent') || 'borrowed';
    name = (editing?.name as string) || '';
    amountStr = editing ? Number(editing.amount).toLocaleString('id-ID') : '';
    dueDate = (editing?.due_date as string) || '';
    note = (editing?.note as string) || '';
    walletId = (editing?.wallet_id as string) || $wallets[0]?.id || '';
    }
    wasOpen = open;
  }

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    const trimmedName = name.trim();
    const amount = parseAmt(amountStr);
    if (!trimmedName) {
      showToast('Nama tidak boleh kosong', 'error');
      return;
    }
    if (!amount) {
      showToast('Jumlah tidak boleh kosong', 'error');
      return;
    }
    if (!dueDate) {
      showToast('Jatuh tempo tidak boleh kosong', 'error');
      return;
    }

    if (editing) {
      const changed =
        (editing.amount as number) !== amount ||
        editing.wallet_id !== walletId ||
        editing.dtype !== dtype;

      await upsertRecord('debts', {
        id: editing.id,
        name: trimmedName,
        amount,
        due_date: dueDate,
        note,
        dtype,
        wallet_id: walletId
      });

      if (changed) {
        // The initial transaction auto-created when this debt was added is
        // tagged '[Otomatis]' so it's never confused with a later payment
        // transaction sharing the same debt_ref. Editing amount/wallet/type
        // later can drift that transaction out of sync with the debt — we
        // never change it silently, only if the user explicitly confirms,
        // since it affects historical saldo.
        const linkedTx = $transactions.find(
          (t) => t.debt_ref === editing!.id && (t.note as string)?.startsWith('[Otomatis]')
        );
        const wantSync =
          linkedTx &&
          confirm(
            'Nominal/dompet/jenis hutang berubah.\n\nSesuaikan juga transaksi awal yang sudah tercatat di histori? Saldo akan ikut disesuaikan.\n\nPilih "Batal" jika ingin histori lama tetap seperti semula.'
          );
        if (wantSync && linkedTx) {
          const direction = dtype === 'borrowed' ? 'in' : 'out';
          await upsertRecord('transactions', {
            id: linkedTx.id,
            type: 'debt_transfer',
            direction,
            amount,
            wallet_id: walletId,
            cat_id: 'debt_transfer',
            description: dtype === 'borrowed' ? `Hutang dari ${trimmedName}` : `Pinjaman ke ${trimmedName}`
          });
          showToast('Hutang & transaksi terkait diperbarui');
        } else {
          showToast('Hutang diperbarui (histori transaksi lama tidak diubah)');
        }
      } else {
        showToast('Hutang diperbarui');
      }
    } else {
      const debt = await upsertRecord('debts', {
        name: trimmedName,
        amount,
        due_date: dueDate,
        note,
        dtype,
        wallet_id: walletId,
        paid: false,
        paid_date: null,
        paid_amount: 0
      });

      // debt_transfer moves cash but is never counted as real
      // income/expense — same reasoning as saving_transfer: a loan is a
      // liability/receivable, not something earned or spent.
      const direction = dtype === 'borrowed' ? 'in' : 'out';
      await upsertRecord('transactions', {
        type: 'debt_transfer',
        direction,
        amount,
        description: dtype === 'borrowed' ? `Hutang dari ${trimmedName}` : `Pinjaman ke ${trimmedName}`,
        date: todayStr(),
        wallet_id: walletId,
        cat_id: 'debt_transfer',
        note: `[Otomatis] ${note}`.trim(),
        photo: null,
        debt_ref: debt.id
      });

      showToast(dtype === 'borrowed' ? 'Hutang dicatat — Saldo bertambah' : 'Pinjaman dicatat — Saldo berkurang');
    }

    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Hutang' : '💳 Tambah Hutang'}
  </h2>

  <div class="flex gap-2 mb-4">
    <button
      on:click={() => (dtype = 'borrowed')}
      class="flex-1 py-2.5 rounded-lg text-sm font-medium border"
      style="border-color: {dtype === 'borrowed'
        ? 'var(--primary)'
        : 'var(--border)'}; background: {dtype === 'borrowed'
        ? 'var(--primary-bg)'
        : 'var(--bg-card)'}; color: {dtype === 'borrowed' ? 'var(--primary)' : 'var(--txt-secondary)'}"
    >
      Hutang (Saya pinjam)
    </button>
    <button
      on:click={() => (dtype = 'lent')}
      class="flex-1 py-2.5 rounded-lg text-sm font-medium border"
      style="border-color: {dtype === 'lent'
        ? 'var(--info)'
        : 'var(--border)'}; background: {dtype === 'lent'
        ? 'var(--info-bg)'
        : 'var(--bg-card)'}; color: {dtype === 'lent' ? 'var(--info)' : 'var(--txt-secondary)'}"
    >
      Piutang (Saya pinjamkan)
    </button>
  </div>

  <div class="flex flex-col gap-3">
    <div>
      <label class="text-xs text-txt-secondary" for="debt-name">
        {dtype === 'borrowed' ? 'Hutang Dari Siapa' : 'Dipinjamkan Kepada'}
      </label>
      <input
        id="debt-name"
        bind:value={name}
        placeholder="Nama"
        class="w-full mt-1 rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
    </div>
    <input
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      placeholder="Jumlah"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <div>
      <label class="text-xs text-txt-secondary" for="debt-due-date">Jatuh Tempo</label>
      <input
        id="debt-due-date"
        bind:value={dueDate}
        type="date"
        class="w-full mt-1 rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
    </div>

    <div>
      <label class="text-xs text-txt-secondary" for="debt-wallet">
        {dtype === 'borrowed' ? 'Dompet Penerima (Saldo Masuk +)' : 'Dompet Sumber (Saldo Keluar −)'}
      </label>
      <div id="debt-wallet" class="flex gap-2 overflow-x-auto pb-1 mt-1">
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
    </div>

    <textarea
      bind:value={note}
      placeholder="Catatan (opsional)"
      rows="2"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary resize-none"
    ></textarea>

    <button
      on:click={submit}
      class="rounded-lg py-3 text-sm font-medium text-white mt-1"
      style="background: {dtype === 'borrowed' ? 'var(--primary)' : 'var(--info)'}"
    >
      {editing ? 'Simpan Perubahan' : dtype === 'borrowed' ? 'Simpan — Saldo Bertambah' : 'Simpan — Saldo Berkurang'}
    </button>
  </div>
</BottomSheet>
