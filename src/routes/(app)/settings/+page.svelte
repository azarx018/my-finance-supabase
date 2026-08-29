<script lang="ts">
  import { onMount } from 'svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { signOut } from '$lib/stores/auth';
  import { notifEnabled, notifTime } from '$lib/stores/notif';
  import { scheduleNotif } from '$lib/notif/scheduler';
  import { exportJSON, exportCSV, importJSON } from '$lib/db/backup';
  import { showToast } from '$lib/stores/toast';
  import { canInstall, promptInstall } from '$lib/pwa/install';

  function onToggleNotif() {
    scheduleNotif();
  }

  onMount(() => {
    if ($notifEnabled) scheduleNotif();
  });

  let importing = false;
  let fileInput: HTMLInputElement;

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
</script>

<div class="p-4 flex flex-col gap-6 max-w-md mx-auto">
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
</div>
