<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { formatDate, parseAmt } from '$lib/data/format';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';

  export let open = false;
  export let date: string | null = null;
  export let onClose: () => void = () => {};

  let title = '';
  let amountStr = '';

  let wasOpen = false;
  $: if (open && !wasOpen) {
    title = '';
    amountStr = '';
  }
  $: wasOpen = open;

  function onAmountInput(e: Event) {
    amountStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    if (!date) return;
    const trimmed = title.trim();
    if (!trimmed) {
      showToast('Isi judul pengingat', 'error');
      return;
    }
    await upsertRecord('reminders', { date, title: trimmed, amount: parseAmt(amountStr), cat: 'bills' });
    showToast('Pengingat ditambahkan 🔔');
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-1 text-txt-primary">🔔 Tambah Pengingat</h2>
  {#if date}
    <p class="text-xs text-txt-secondary mb-4">Tanggal: {formatDate(date)}</p>
  {/if}
  <div class="flex flex-col gap-3">
    <input
      bind:value={title}
      placeholder="Judul (mis. Bayar listrik)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <input
      value={amountStr}
      on:input={onAmountInput}
      inputmode="numeric"
      placeholder="Jumlah (opsional)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <button
      on:click={submit}
      class="rounded-lg py-3 text-sm font-medium text-white mt-1"
      style="background: var(--primary)"
    >
      Tambah Pengingat
    </button>
  </div>
</BottomSheet>
