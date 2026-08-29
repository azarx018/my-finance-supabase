<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { WALLET_EMOJIS } from '$lib/data/categories';
  import { parseAmt } from '$lib/data/format';
  import { upsertRecord, softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null;
  export let walletCount = 0; // guard: never delete the last wallet
  export let onClose: () => void = () => {};

  let name = '';
  let balanceStr = '';
  let emoji = '👛';

  let wasOpen = false;

  // Re-seed the form fields only when the sheet transitions from closed
  // to open (both for "add" — editing is null, fields reset — and "edit"
  // — fields populate from the record passed in). Guarding with wasOpen
  // matters because this reactive block also reads `editing`, so without
  // it, any reassignment of `editing` while the sheet is already open
  // would silently wipe whatever the user was mid-typing.
  $: if (open && !wasOpen) {
    name = (editing?.name as string) || '';
    balanceStr = editing ? Number(editing.initial_balance).toLocaleString('id-ID') : '';
    emoji = (editing?.emoji as string) || '👛';
  }
  $: wasOpen = open;

  function onBalanceInput(e: Event) {
    balanceStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Nama dompet tidak boleh kosong', 'error');
      return;
    }
    await upsertRecord('wallets', {
      id: editing?.id,
      name: trimmed,
      emoji,
      initial_balance: parseAmt(balanceStr)
    });
    showToast(editing ? 'Dompet diperbarui' : 'Dompet ditambahkan');
    onClose();
  }

  async function remove() {
    if (!editing) return;
    if (walletCount <= 1) {
      showToast('Tidak bisa menghapus dompet terakhir', 'error');
      return;
    }
    await softDeleteRecord('wallets', editing.id);
    showToast('Dompet dihapus', 'info');
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Dompet' : '👛 Tambah Dompet'}
  </h2>
  <div class="flex flex-col gap-3">
    <div>
      <label class="text-xs text-txt-secondary" for="wallet-name">Nama Dompet</label>
      <input
        id="wallet-name"
        bind:value={name}
        placeholder="mis. Dompet Tunai"
        class="w-full mt-1 rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
    </div>
    <div>
      <label class="text-xs text-txt-secondary" for="wallet-balance">Saldo Awal</label>
      <input
        id="wallet-balance"
        value={balanceStr}
        on:input={onBalanceInput}
        inputmode="numeric"
        placeholder="0"
        class="w-full mt-1 rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
    </div>
    <div>
      <p class="text-xs text-txt-secondary mb-2">Ikon</p>
      <div class="flex flex-wrap gap-2">
        {#each WALLET_EMOJIS as e (e)}
          <button
            on:click={() => (emoji = e)}
            class="w-10 h-10 rounded-lg flex items-center justify-center text-lg border"
            style="border-color: {emoji === e
              ? 'var(--primary)'
              : 'var(--border)'}; background: {emoji === e ? 'var(--primary-bg)' : 'var(--bg-card)'}"
          >
            {e}
          </button>
        {/each}
      </div>
    </div>

    <button
      on:click={submit}
      class="rounded-lg py-3 text-sm font-medium text-white mt-2"
      style="background: var(--primary)"
    >
      {editing ? 'Simpan Perubahan' : 'Tambah Dompet'}
    </button>
    {#if editing}
      <button on:click={remove} class="rounded-lg py-2.5 text-sm font-medium" style="color: var(--expense)">
        Hapus Dompet
      </button>
    {/if}
  </div>
</BottomSheet>
