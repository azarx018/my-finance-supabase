<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { CAT_EMOJIS } from '$lib/data/categories';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';

  export let open = false;
  export let type: 'income' | 'expense' = 'expense';
  export let onClose: () => void = () => {};
  /** Called with the newly created category id, so the caller can pre-select it. */
  export let onCreated: (catId: string) => void = () => {};

  let name = '';
  let emoji = CAT_EMOJIS[0];

  let wasOpen = false;
  $: if (open && !wasOpen) {
    name = '';
    emoji = CAT_EMOJIS[0];
  }
  $: wasOpen = open;

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Nama kategori tidak boleh kosong', 'error');
      return;
    }
    const record = await upsertRecord('custom_categories', { name: trimmed, emoji, type });
    showToast(`Kategori "${trimmed}" ditambahkan`);
    onCreated(record.id);
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">➕ Kategori Baru</h2>
  <div class="flex flex-col gap-3">
    <input
      bind:value={name}
      placeholder="Nama kategori"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <div>
      <p class="text-xs text-txt-secondary mb-2">Ikon</p>
      <div class="grid grid-cols-6 gap-2">
        {#each CAT_EMOJIS as e (e)}
          <button
            on:click={() => (emoji = e)}
            class="w-full aspect-square rounded-lg flex items-center justify-center text-lg border"
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
      class="rounded-lg py-3 text-sm font-medium text-white mt-1"
      style="background: var(--primary)"
    >
      Tambah Kategori
    </button>
  </div>
</BottomSheet>
