<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import { BUCKET_EMOJIS } from '$lib/data/categories';
  import { parseAmt } from '$lib/data/format';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null;
  export let onClose: () => void = () => {};

  let name = '';
  let targetStr = '';
  let emoji = '🎯';

  let wasOpen = false;
  $: if (open && !wasOpen) {
    name = (editing?.name as string) || '';
    targetStr = editing?.target ? Number(editing.target).toLocaleString('id-ID') : '';
    emoji = (editing?.emoji as string) || '🎯';
  }
  $: wasOpen = open;

  function onTargetInput(e: Event) {
    targetStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast('Isi nama kantong', 'error');
      return;
    }
    await upsertRecord('saving_buckets', {
      id: editing?.id,
      name: trimmed,
      emoji,
      target: parseAmt(targetStr),
      status: (editing?.status as string) || 'active'
    });
    showToast(editing ? 'Kantong diupdate ✅' : 'Kantong dibuat ✅');
    onClose();
  }
</script>

<BottomSheet {open} {onClose}>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Kantong' : '🪣 Buat Kantong Tabungan'}
  </h2>
  <div class="flex flex-col gap-3">
    <input
      bind:value={name}
      placeholder="Nama kantong (mis. Dana Darurat)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <input
      value={targetStr}
      on:input={onTargetInput}
      inputmode="numeric"
      placeholder="Target (opsional)"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    <div>
      <p class="text-xs text-txt-secondary mb-2">Ikon</p>
      <div class="grid grid-cols-8 gap-2">
        {#each BUCKET_EMOJIS as e (e)}
          <button
            on:click={() => (emoji = e)}
            class="w-full aspect-square rounded-lg flex items-center justify-center text-base border"
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
      {editing ? 'Simpan Perubahan' : 'Buat Kantong'}
    </button>
  </div>
</BottomSheet>
