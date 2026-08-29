<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import NewCategorySheet from './NewCategorySheet.svelte';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { getBudgetMonth } from '$lib/data/budget';
  import { parseAmt } from '$lib/data/format';
  import { upsertRecord, softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { customCategories, budgets, transactions } from '$lib/stores/data';
  import type { SyncableRecord } from '$lib/db/dexie';

  export let open = false;
  export let editing: SyncableRecord | null = null;
  export let onClose: () => void = () => {};

  let catId = '';
  let limitStr = '';
  let newCatOpen = false;

  let wasOpen = false;
  $: {
    if (open && !wasOpen) {
    catId = (editing?.cat_id as string) || '';
    limitStr = editing ? Number(editing.limit_amount).toLocaleString('id-ID') : '';
    }
    wasOpen = open;
  }

  // Only offer expense categories not already budgeted this month (the
  // category currently being edited stays available to itself).
  $: month = getBudgetMonth();
  $: budgetedCatIds = $budgets
    .filter((b) => b.month === month && b.id !== editing?.id)
    .map((b) => b.cat_id as string);
  $: expenseCustom = $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[];
  $: available = getCatList('expense', expenseCustom).filter((c) => !budgetedCatIds.includes(c.id));

  function onLimitInput(e: Event) {
    limitStr = parseAmt((e.target as HTMLInputElement).value).toLocaleString('id-ID');
  }

  async function deleteCategory(id: string, name: string) {
    const inUse = $transactions.filter((t) => t.cat_id === id).length;
    if (inUse > 0) {
      showToast(`Kategori "${name}" masih dipakai di ${inUse} transaksi`, 'error');
      return;
    }
    if (!confirm(`Hapus kategori "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await softDeleteRecord('custom_categories', id);
    showToast('Kategori dihapus', 'info');
  }

  async function submit() {
    if (!catId) {
      showToast('Pilih kategori dulu', 'error');
      return;
    }
    const limit = parseAmt(limitStr);
    if (!limit) {
      showToast('Masukkan nominal budget', 'error');
      return;
    }
    await upsertRecord('budgets', { id: editing?.id, cat_id: catId, limit_amount: limit, month });
    showToast(editing ? 'Budget diupdate' : 'Budget ditambahkan');
    onClose();
  }
</script>

<BottomSheet
  open={open && !newCatOpen}
  onClose={() => {
    newCatOpen = false;
    onClose();
  }}
>
  <h2 class="text-sm font-semibold mb-4 text-txt-primary">
    {editing ? '✏️ Edit Budget' : '💰 Tambah Budget'}
  </h2>
  <div class="flex flex-col gap-3">
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        on:click={() => (newCatOpen = true)}
        class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 border-dashed border-border shrink-0 min-w-[64px]"
      >
        <span class="text-xl">➕</span>
        <span class="text-[10px] text-txt-secondary">Baru</span>
      </button>
      {#each available as c (c.id)}
        {@const isCustom = expenseCustom.some((x) => x.id === c.id)}
        <div class="relative shrink-0">
          <button
            on:click={() => (catId = c.id)}
            class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border min-w-[64px]"
            style="border-color: {catId === c.id
              ? 'var(--primary)'
              : 'var(--border)'}; background: {catId === c.id ? 'var(--primary-bg)' : 'var(--bg-card)'}"
          >
            <span class="text-xl">{c.emoji}</span>
            <span class="text-[10px] text-txt-secondary text-center leading-tight">{c.name}</span>
          </button>
          {#if isCustom}
            <button
              on:click={() => deleteCategory(c.id, c.name)}
              aria-label="Hapus kategori"
              class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] flex items-center justify-center"
              style="background: var(--expense)"
            >
              ✕
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <input
      value={limitStr}
      on:input={onLimitInput}
      inputmode="numeric"
      placeholder="Nominal budget"
      class="w-full rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />

    <button
      on:click={submit}
      class="rounded-lg py-3 text-sm font-medium text-white mt-1"
      style="background: var(--primary)"
    >
      {editing ? 'Simpan Perubahan' : 'Tambah Budget'}
    </button>
  </div>
</BottomSheet>

<NewCategorySheet
  open={newCatOpen}
  type="expense"
  onClose={() => (newCatOpen = false)}
  onCreated={(id) => (catId = id)}
/>
