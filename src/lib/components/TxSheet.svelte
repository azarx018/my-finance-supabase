<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import CatPill from './CatPill.svelte';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { parseAmt, todayStr } from '$lib/data/format';
  import { upsertRecord, softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets, customCategories } from '$lib/stores/data';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null;
  export let onClose: () => void = () => {};

  let type: 'income' | 'expense' = 'income';
  let amountStr = '';
  let desc = '';
  let date = todayStr();
  let note = '';
  let catId = 'other_inc';
  let walletId = '';
  let wasOpen = false;

  $: if (open && !wasOpen) {
    type = (editing?.type as 'income' | 'expense') || 'income';
    amountStr = editing ? Number(editing.amount).toLocaleString('id-ID') : '';
    desc = (editing?.desc as string) || '';
    date = (editing?.date as string) || todayStr();
    note = (editing?.note as string) || '';
    catId = (editing?.cat_id as string) || (type === 'income' ? 'other_inc' : 'other_exp');
    walletId = (editing?.wallet_id as string) || $wallets[0]?.id || '';
  }
  $: wasOpen = open;

  $: cats = getCatList(
    type,
    $customCategories.filter((c) => c.type === type) as unknown as Cat[]
  );

  function setType(t: 'income' | 'expense') {
    type = t;
    catId = t === 'income' ? 'other_inc' : 'other_exp';
  }

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    const amount = parseAmt(amountStr);
    if (!amount || amount <= 0) {
      showToast('Nominal tidak boleh kosong', 'error');
      return;
    }
    if (!desc.trim()) {
      showToast('Deskripsi tidak boleh kosong', 'error');
      return;
    }
    if (!date) {
      showToast('Tanggal tidak boleh kosong', 'error');
      return;
    }
    if (!walletId) {
      showToast('Pilih dompet dulu', 'error');
      return;
    }
    await upsertRecord('transactions', {
      id: editing?.id,
      type,
      amount,
      desc: desc.trim(),
      date,
      note: note.trim(),
      cat_id: catId,
      wallet_id: walletId,
      photo: (editing?.photo as string) ?? null
    });
    showToast(
      editing ? 'Transaksi diperbarui' : type === 'income' ? 'Pemasukan dicatat' : 'Pengeluaran dicatat'
    );
    onClose();
  }

  async function remove() {
    if (!editing) return;
    await softDeleteRecord('transactions', editing.id);
    showToast('Transaksi dihapus', 'info');
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Transaksi' : '➕ Catat Transaksi'}
  </h2>

  <div class="flex gap-2 mb-4">
    <button
      on:click={() => setType('income')}
      class="flex-1 py-2.5 rounded-lg text-sm font-medium border"
      style="border-color: {type === 'income'
        ? 'var(--income)'
        : 'var(--border)'}; background: {type === 'income'
        ? 'var(--income-bg)'
        : 'var(--bg-card)'}; color: {type === 'income' ? 'var(--income)' : 'var(--txt-secondary)'}"
    >
      Pemasukan
    </button>
    <button
      on:click={() => setType('expense')}
      class="flex-1 py-2.5 rounded-lg text-sm font-medium border"
      style="border-color: {type === 'expense'
        ? 'var(--expense)'
        : 'var(--border)'}; background: {type === 'expense'
        ? 'var(--expense-bg)'
        : 'var(--bg-card)'}; color: {type === 'expense' ? 'var(--expense)' : 'var(--txt-secondary)'}"
    >
      Pengeluaran
    </button>
  </div>

  <div class="flex flex-col gap-3">
    <input
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      placeholder="Rp 0"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-lg font-semibold text-txt-primary"
    />

    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each cats as c (c.id)}
        <CatPill emoji={c.emoji} label={c.name} selected={catId === c.id} onClick={() => (catId = c.id)} />
      {/each}
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
      bind:value={desc}
      placeholder="Deskripsi (mis. Makan siang)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <input
      bind:value={date}
      type="date"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <textarea
      bind:value={note}
      placeholder="Catatan (opsional)"
      rows="2"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary resize-none"
    ></textarea>

    <button
      on:click={submit}
      class="rounded-lg py-3 text-sm font-medium text-white mt-1"
      style="background: {type === 'expense' ? 'var(--expense)' : 'var(--primary)'}"
    >
      {editing ? 'Update' : 'Simpan'} {type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
    </button>
    {#if editing}
      <button on:click={remove} class="rounded-lg py-2.5 text-sm font-medium" style="color: var(--expense)">
        Hapus Transaksi
      </button>
    {/if}
  </div>
</BottomSheet>
