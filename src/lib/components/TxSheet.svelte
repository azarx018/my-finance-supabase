<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import CatPill from './CatPill.svelte';
  import { onDestroy } from 'svelte';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { parseAmt, todayStr, formatRpC } from '$lib/data/format';
  import { upsertRecord, softDeleteRecord, newId } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { wallets, customCategories, transactions } from '$lib/stores/data';
  import { computeWalletStats } from '$lib/data/wallets';
  import { compressImage, type CompressedImage } from '$lib/media/compressImage';
  import { queuePhotoUpload, getPhotoUrl, deletePhoto, hasPendingUpload } from '$lib/media/photoUpload';
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

  // Photo attachment state. Kept separate from the amount/desc/etc
  // fields above because it has its own async lifecycle (compression,
  // signed-URL fetch, queueing) that shouldn't block or complicate the
  // rest of the form.
  let existingPhotoPath: string | null = null; // Storage path already saved on this transaction
  let existingPhotoUrl: string | null = null; // signed URL, loaded async for display
  let removePhoto = false; // user tapped ✕ on the existing photo
  let newPhotoCompressed: CompressedImage | null = null; // freshly picked + compressed, not yet queued
  let newPhotoPreviewUrl: string | null = null; // local object URL for the above
  let photoProcessing = false;
  let photoPending = false; // true if this transaction has an upload still sitting in the local queue

  $: {
    if (open && !wasOpen) {
    type = (editing?.type as 'income' | 'expense') || 'income';
    amountStr = editing ? Number(editing.amount).toLocaleString('id-ID') : '';
    desc = (editing?.description as string) || '';
    date = (editing?.date as string) || todayStr();
    note = (editing?.note as string) || '';
    catId = (editing?.cat_id as string) || (type === 'income' ? 'other_inc' : 'other_exp');
    walletId = (editing?.wallet_id as string) || $wallets[0]?.id || '';

    existingPhotoPath = (editing?.photo as string) ?? null;
    existingPhotoUrl = null;
    removePhoto = false;
    clearNewPhoto();
    if (existingPhotoPath) void loadExistingPhoto(existingPhotoPath);
    if (editing?.id) void hasPendingUpload(editing.id).then((v) => (photoPending = v));
    else photoPending = false;
    }
    wasOpen = open;
  }

  async function loadExistingPhoto(path: string) {
    const url = await getPhotoUrl(path);
    // Guard against a stale response landing after the user already
    // navigated away from this photo (removed it / closed the sheet).
    if (existingPhotoPath === path) existingPhotoUrl = url;
  }

  async function onPhotoSelected(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    photoProcessing = true;
    try {
      newPhotoCompressed = await compressImage(file);
      if (newPhotoPreviewUrl) URL.revokeObjectURL(newPhotoPreviewUrl);
      newPhotoPreviewUrl = URL.createObjectURL(newPhotoCompressed.blob);
      removePhoto = false;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses foto', 'error');
    } finally {
      photoProcessing = false;
    }
  }

  function clearNewPhoto() {
    if (newPhotoPreviewUrl) URL.revokeObjectURL(newPhotoPreviewUrl);
    newPhotoPreviewUrl = null;
    newPhotoCompressed = null;
  }

  function removeExistingPhoto() {
    removePhoto = true;
    existingPhotoUrl = null;
  }

  onDestroy(clearNewPhoto);

  $: cats = getCatList(
    type,
    $customCategories.filter((c) => c.type === type) as unknown as Cat[]
  );

  // A wallet with 0 (or negative) balance can't fund an expense — this
  // computes each wallet's current balance so the picker can disable
  // empty ones and steer the user toward a wallet that actually has
  // money in it. Income is always allowed regardless of balance.
  $: walletStats = computeWalletStats($wallets, $transactions);
  $: isWalletEmpty = (w: SyncableRecord) => (walletStats[w.id]?.balance ?? 0) <= 0;
  $: selectedWalletEmpty =
    type === 'expense' && !!walletId && walletId !== (editing?.wallet_id as string | undefined) &&
    (walletStats[walletId]?.balance ?? 0) <= 0;

  function pickWallet(w: SyncableRecord) {
    if (type === 'expense' && isWalletEmpty(w) && w.id !== (editing?.wallet_id as string | undefined)) {
      showToast(`Saldo ${w.name} kosong — pakai dompet lain untuk transaksi ini`, 'error');
      return;
    }
    walletId = w.id;
  }

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
    if (selectedWalletEmpty) {
      showToast('Saldo dompet ini kosong — pilih dompet lain', 'error');
      return;
    }
    // Generated up front (rather than left for upsertRecord's own
    // fallback) so the id is known now — the photo queue needs it to
    // build the Storage path, and it must be the SAME id the
    // transaction row ends up with.
    const txId = editing?.id ?? newId();
    const photoValue = removePhoto ? null : existingPhotoPath;

    await upsertRecord('transactions', {
      id: txId,
      type,
      amount,
      description: desc.trim(),
      date,
      note: note.trim(),
      cat_id: catId,
      wallet_id: walletId,
      photo: photoValue
    });

    // Storage path is deterministic ({userId}/{txId}.{ext}), so
    // "replace" is just a new upload overwriting the same path —
    // only a pure removal (no replacement) needs an explicit delete.
    if (removePhoto && existingPhotoPath && !newPhotoCompressed) {
      await deletePhoto(txId, existingPhotoPath);
    }
    if (newPhotoCompressed) {
      await queuePhotoUpload(txId, newPhotoCompressed);
    }

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
        {@const empty = type === 'expense' && isWalletEmpty(w) && w.id !== (editing?.wallet_id as string | undefined)}
        <button
          on:click={() => pickWallet(w)}
          class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs shrink-0 transition-opacity"
          class:opacity-40={empty}
          style="border-color: {walletId === w.id
            ? 'var(--primary)'
            : 'var(--border)'}; background: {walletId === w.id ? 'var(--primary-bg)' : 'var(--bg-card)'}"
        >
          <span>{w.emoji}</span><span>{w.name}</span>
          {#if empty}<span class="text-[9px]" style="color: var(--expense)">· kosong</span>{/if}
        </button>
      {/each}
    </div>
    {#if selectedWalletEmpty}
      <p class="text-xs -mt-2" style="color: var(--expense)">
        Saldo dompet ini kosong. Kalau mau pakai dompet lain untuk transaksi ini, pilih di atas.
      </p>
    {/if}

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

    <div>
      <p class="text-xs text-txt-secondary mb-1.5">Bukti Transaksi (opsional)</p>
      {#if newPhotoPreviewUrl}
        <div class="relative w-24 h-24">
          <img
            src={newPhotoPreviewUrl}
            alt="Bukti transaksi"
            class="w-24 h-24 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            on:click={clearNewPhoto}
            aria-label="Batalkan foto"
            class="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-sm"
            style="background: var(--expense)"
          >
            ✕
          </button>
        </div>
      {:else if existingPhotoUrl && !removePhoto}
        <div class="relative w-24 h-24">
          <img
            src={existingPhotoUrl}
            alt="Bukti transaksi"
            class="w-24 h-24 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            on:click={removeExistingPhoto}
            aria-label="Hapus foto"
            class="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs shadow-sm"
            style="background: var(--expense)"
          >
            ✕
          </button>
          {#if photoPending}
            <span
              class="absolute bottom-0 inset-x-0 text-[9px] text-center py-0.5 rounded-b-lg text-white"
              style="background: rgba(0,0,0,0.55)"
            >
              menunggu upload
            </span>
          {/if}
        </div>
      {:else if existingPhotoPath && !existingPhotoUrl && !removePhoto}
        <div class="w-24 h-24 rounded-lg border border-border flex items-center justify-center text-txt-muted text-[10px]">
          Memuat…
        </div>
      {:else}
        <label
          class="flex flex-col items-center justify-center w-24 h-24 rounded-lg border border-dashed border-border text-txt-muted cursor-pointer"
          class:opacity-60={photoProcessing}
        >
          {#if photoProcessing}
            <span class="text-[10px]">Memproses…</span>
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5 mb-1">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span class="text-[10px]">Tambah Foto</span>
          {/if}
          <!--
            BUGFIX: `capture="environment"` forces most mobile browsers to
            jump straight into the camera app, skipping the normal
            camera-vs-gallery chooser entirely — so there was never any
            way to attach an existing photo, only a freshly taken one.
            Dropping `capture` lets the OS show its native picker (camera
            AND gallery/files), which is what "Tambah Foto" should offer.
          -->
          <input
            type="file"
            accept="image/*"
            class="hidden"
            disabled={photoProcessing}
            on:change={onPhotoSelected}
          />
        </label>
      {/if}
      <p class="text-[10px] text-txt-muted mt-1">
        Foto otomatis dikompres (WebP) supaya hemat kuota & penyimpanan. Bisa tetap dilampirkan
        walau offline — akan terupload otomatis begitu online lagi.
      </p>
    </div>

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
