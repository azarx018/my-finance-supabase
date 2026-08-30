<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import { db } from '$lib/db/dexie';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { signOut } from '$lib/stores/auth';
  import { getUserId } from '$lib/stores/session';
  import { notifEnabled, notifTime } from '$lib/stores/notif';
  import { scheduleNotif } from '$lib/notif/scheduler';
  import { exportJSON, exportCSV, importJSON } from '$lib/db/backup';
  import { wipeAllData, purgeAllDataPermanently } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import { canInstall, promptInstall } from '$lib/pwa/install';
  import { flushQueue, pullAll, lastSyncError, lastSyncedAt } from '$lib/sync/engine';

  function onToggleNotif() {
    scheduleNotif();
  }

  let pendingPush = 0;
  let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let syncing = false;

  onMount(() => {
    if ($notifEnabled) scheduleNotif();
    const sub = liveQuery(() => db.syncQueue.count()).subscribe({ next: (v) => (pendingPush = v) });
    const goOnline = () => (online = true);
    const goOffline = () => (online = false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      sub.unsubscribe();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  });

  async function forceSyncNow() {
    const userId = getUserId();
    if (!userId) return;
    syncing = true;
    try {
      await pullAll(userId);
      await flushQueue();
      if (!$lastSyncError) showToast('✅ Sinkronisasi berhasil');
    } finally {
      syncing = false;
    }
  }

  let importing = false;
  let fileInput: HTMLInputElement;
  let wiping = false;
  // Two separate destructive flows, kept mutually exclusive on purpose —
  // 'soft' just hides everything (reversible via support/DB access,
  // still synced as a tombstone to other devices); 'hard' is a true
  // permanent delete from Supabase with no tombstone at all.
  let dangerMode: 'none' | 'soft' | 'hard' = 'none';
  let confirmText = '';
  const SOFT_CONFIRM_WORD = 'HAPUS';
  const HARD_CONFIRM_WORD = 'HAPUS PERMANEN';

  async function handleExportJSON() {
    try {
      await exportJSON();
      showToast('💾 Backup JSON diunduh');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal ekspor', 'error');
    }
  }

  async function handleExportCSV() {
    try {
      await exportCSV();
      showToast('📊 CSV diunduh');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal ekspor', 'error');
    }
  }

  async function handleImportFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importing = true;
    try {
      const result = await importJSON(file);
      showToast(`✅ ${result.total} data diimpor (digabung dengan data yang ada)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal impor', 'error');
    } finally {
      importing = false;
      if (fileInput) fileInput.value = '';
    }
  }

  // Two layers of friction on purpose: this is irreversible for anyone
  // without a manual backup, and unlike a soft-delete on a single
  // record, there's no easy "undo" button for wiping everything.
  async function handleWipeAll() {
    if (confirmText !== SOFT_CONFIRM_WORD) return;
    wiping = true;
    try {
      await wipeAllData();
      showToast('🗑️ Semua data disembunyikan (masih tersimpan di server)');
      dangerMode = 'none';
      confirmText = '';
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus data', 'error');
    } finally {
      wiping = false;
    }
  }

  async function handlePurgeAll() {
    if (confirmText !== HARD_CONFIRM_WORD) return;
    wiping = true;
    try {
      await purgeAllDataPermanently();
      showToast('🗑️ Semua data dihapus permanen dari server');
      dangerMode = 'none';
      confirmText = '';
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menghapus data', 'error');
    } finally {
      wiping = false;
    }
  }
</script>

<div class="p-4 flex flex-col gap-6 max-w-md mx-auto">
  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Status Sinkronisasi</h2>
    <div class="bg-base-card rounded-xl shadow-sm border border-border p-4 flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-txt-primary">Koneksi</span>
        <span
          class="text-xs px-2 py-0.5 rounded-full font-medium"
          style={online
            ? 'background: var(--income-bg); color: var(--income)'
            : 'background: var(--expense-bg); color: var(--expense)'}
        >
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-txt-primary">Menunggu dikirim ke server</span>
        <span
          class="text-xs font-medium"
          style={pendingPush > 0 ? 'color: var(--warn)' : 'color: var(--txt-secondary)'}
        >
          {pendingPush} item
        </span>
      </div>
      {#if $lastSyncedAt}
        <div class="flex items-center justify-between">
          <span class="text-sm text-txt-primary">Terakhir sinkron</span>
          <span class="text-xs text-txt-secondary">{new Date($lastSyncedAt).toLocaleTimeString('id-ID')}</span>
        </div>
      {/if}
      {#if $lastSyncError}
        <p class="text-xs rounded-lg p-2 mt-1" style="background: var(--expense-bg); color: var(--expense)">
          ⚠️ {$lastSyncError}
        </p>
      {/if}
      <button
        on:click={forceSyncNow}
        disabled={syncing || !online}
        class="w-full text-sm py-2.5 rounded-lg border border-border text-txt-primary mt-1 disabled:opacity-40"
      >
        {syncing ? 'Menyinkronkan…' : '🔄 Sinkron Sekarang'}
      </button>
      {#if pendingPush > 0}
        <p class="text-[10px] text-txt-muted">
          Ada data yang belum sampai ke server — jangan hapus data browser (cookies/site data)
          sebelum ini 0, atau data yang belum terkirim bisa hilang permanen.
        </p>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Tampilan</h2>
    <ThemeSwitcher />
  </section>

  {#if $canInstall}
    <section>
      <button
        on:click={promptInstall}
        class="w-full text-sm font-medium py-3 rounded-lg text-white"
        style="background: var(--primary)"
      >
        📲 Install My Finance ke Layar Utama
      </button>
    </section>
  {/if}

  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Pengingat Harian</h2>
    <div class="bg-base-card rounded-xl shadow-sm border border-border p-4 flex flex-col gap-3">
      <label class="flex items-center justify-between">
        <span class="text-sm text-txt-primary">Ingatkan catat pengeluaran</span>
        <input type="checkbox" bind:checked={$notifEnabled} on:change={onToggleNotif} />
      </label>
      {#if $notifEnabled}
        <div class="flex items-center justify-between">
          <span class="text-xs text-txt-secondary">Jam pengingat</span>
          <input
            type="time"
            bind:value={$notifTime}
            on:change={onToggleNotif}
            class="rounded-lg bg-base-input border border-border px-3 py-1.5 text-sm text-txt-primary"
          />
        </div>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Data & Backup</h2>
    <div class="bg-base-card rounded-xl shadow-sm border border-border p-4 flex flex-col gap-2">
      <p class="text-xs text-txt-secondary mb-1">
        Data kamu sudah otomatis tersinkron ke cloud — file di bawah ini untuk backup manual
        tambahan atau memindahkan data ke akun lain.
      </p>
      <button
        on:click={handleExportJSON}
        class="w-full text-sm py-2.5 rounded-lg border border-border text-txt-primary text-left px-3"
      >
        💾 Ekspor Backup JSON (semua data)
      </button>
      <button
        on:click={handleExportCSV}
        class="w-full text-sm py-2.5 rounded-lg border border-border text-txt-primary text-left px-3"
      >
        📊 Ekspor CSV (transaksi saja)
      </button>
      <label
        class="w-full text-sm py-2.5 rounded-lg border border-border text-txt-primary text-left px-3 cursor-pointer"
        style={importing ? 'opacity: 0.6; pointer-events: none' : ''}
      >
        📥 {importing ? 'Mengimpor…' : 'Impor Backup JSON'}
        <input bind:this={fileInput} type="file" accept="application/json" class="hidden" on:change={handleImportFile} />
      </label>
      <p class="text-[10px] text-txt-muted mt-1">
        Impor akan menggabungkan (bukan menimpa total) data yang sudah ada — data dengan ID yang
        sama akan diperbarui, sisanya ditambahkan.
      </p>
    </div>
  </section>

  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Zona Berbahaya</h2>
    <div class="bg-base-card rounded-xl shadow-sm border p-4 flex flex-col gap-3" style="border-color: var(--expense)">
      {#if dangerMode === 'none'}
        <div>
          <p class="text-sm font-medium" style="color: var(--expense)">Kosongkan Data</p>
          <p class="text-xs text-txt-secondary mt-1">
            Menyembunyikan semua dompet, transaksi, hutang, tabungan, budget, dan pengingat dari
            tampilan app. Datanya <b>masih tersimpan</b> di server (soft-delete) — bisa membantu
            kalau suatu saat butuh dipulihkan. Untuk benar-benar menghapus dari server, pakai opsi
            di bawah.
          </p>
        </div>
        <button
          on:click={() => {
            dangerMode = 'soft';
            confirmText = '';
          }}
          class="w-full text-sm font-medium py-2.5 rounded-lg border"
          style="color: var(--expense); border-color: var(--expense)"
        >
          Kosongkan Data
        </button>

        <hr class="border-border my-1" />

        <div>
          <p class="text-sm font-medium" style="color: var(--expense)">Hapus Permanen dari Server</p>
          <p class="text-xs text-txt-secondary mt-1">
            Benar-benar menghapus semua baris dari database Supabase, bukan cuma menyembunyikan.
            <b>Peringatan:</b> kalau kamu login di device lain yang sedang offline saat ini, device
            itu tidak akan tahu datanya dihapus dan bisa jadi tidak sinkron setelahnya. Pastikan
            semua device online & tersinkron dulu. Backup JSON dulu kalau masih ragu.
          </p>
        </div>
        <button
          on:click={() => {
            dangerMode = 'hard';
            confirmText = '';
          }}
          class="w-full text-sm font-medium py-2.5 rounded-lg text-white"
          style="background: var(--expense)"
        >
          Hapus Permanen dari Server
        </button>
      {:else if dangerMode === 'soft'}
        <div>
          <p class="text-sm font-medium" style="color: var(--expense)">Yakin mau kosongkan data?</p>
          <p class="text-xs text-txt-secondary mt-1">
            Data disembunyikan dari app tapi masih ada di server. Ketik <b>{SOFT_CONFIRM_WORD}</b> untuk
            konfirmasi.
          </p>
        </div>
        <input
          bind:value={confirmText}
          placeholder={SOFT_CONFIRM_WORD}
          class="w-full rounded-lg bg-base-input border border-border px-4 py-2.5 text-sm text-txt-primary"
        />
        <div class="flex gap-2">
          <button
            on:click={() => {
              dangerMode = 'none';
              confirmText = '';
            }}
            class="flex-1 text-sm py-2.5 rounded-lg border border-border text-txt-secondary"
          >
            Batal
          </button>
          <button
            on:click={handleWipeAll}
            disabled={confirmText !== SOFT_CONFIRM_WORD || wiping}
            class="flex-1 text-sm font-medium py-2.5 rounded-lg text-white disabled:opacity-40"
            style="background: var(--expense)"
          >
            {wiping ? 'Memproses…' : 'Kosongkan Data'}
          </button>
        </div>
      {:else}
        <div>
          <p class="text-sm font-medium" style="color: var(--expense)">
            Yakin mau hapus permanen dari server?
          </p>
          <p class="text-xs text-txt-secondary mt-1">
            Tindakan ini <b>tidak bisa dibatalkan sama sekali</b>. Ketik
            <b>{HARD_CONFIRM_WORD}</b> untuk konfirmasi.
          </p>
        </div>
        <input
          bind:value={confirmText}
          placeholder={HARD_CONFIRM_WORD}
          class="w-full rounded-lg bg-base-input border border-border px-4 py-2.5 text-sm text-txt-primary"
        />
        <div class="flex gap-2">
          <button
            on:click={() => {
              dangerMode = 'none';
              confirmText = '';
            }}
            class="flex-1 text-sm py-2.5 rounded-lg border border-border text-txt-secondary"
          >
            Batal
          </button>
          <button
            on:click={handlePurgeAll}
            disabled={confirmText !== HARD_CONFIRM_WORD || wiping}
            class="flex-1 text-sm font-medium py-2.5 rounded-lg text-white disabled:opacity-40"
            style="background: var(--expense)"
          >
            {wiping ? 'Menghapus…' : 'Hapus Permanen'}
          </button>
        </div>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="text-xs font-medium text-txt-secondary mb-3">Akun</h2>
    <button
      on:click={signOut}
      class="w-full text-sm font-medium border border-border rounded-lg py-3"
      style="color: var(--expense)"
    >
      Keluar
    </button>
  </section>

  <p class="text-xs text-txt-muted text-center">My Finance · v{__APP_VERSION__}</p>
  <p class="text-[10px] text-txt-muted text-center -mt-4">© 2026 Azar-Dev</p>
</div>
