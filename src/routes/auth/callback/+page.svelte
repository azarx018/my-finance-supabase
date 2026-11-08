<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { session } from '$lib/stores/auth';

  // Halaman tujuan balik OAuth (Google). Supabase mengembalikan token di hash URL (atau error di hash/query);
  // supabase-js membaca token itu otomatis (detectSessionInUrl). Begitu `session` terisi, route guard di
  // +layout.svelte meneruskan ke /dashboard. Kalau ada error / sesi tak kunjung muncul, tampilkan pesannya di sini.
  let error = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    const raw = window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(raw);
    const desc = params.get('error_description');
    const code = params.get('error');
    if (desc || code) {
      error = desc ?? code ?? 'Login gagal';
      history.replaceState(null, '', window.location.pathname); // buang detail dari URL
      return;
    }
    // Jaring pengaman: kalau 10 detik tidak ada sesi, anggap gagal supaya tidak berputar selamanya.
    timer = setTimeout(() => {
      if (!$session) error = 'Login tidak selesai. Coba lagi, atau masuk dengan email.';
    }, 10000);
  });

  onDestroy(() => clearTimeout(timer));

  $: friendly = /access_denied/i.test(error)
    ? 'Login dibatalkan.'
    : /provider is not enabled|Unsupported provider/i.test(error)
      ? 'Login Google belum diaktifkan di server. Coba masuk dengan email dulu.'
      : error;
</script>

<div
  class="min-h-[100dvh] flex items-center justify-center font-main px-6 py-8"
  style="padding-top: max(2rem, env(safe-area-inset-top)); padding-bottom: max(2rem, env(safe-area-inset-bottom))"
>
  <div class="w-full max-w-sm bg-base-card rounded-2xl shadow-lg p-6 flex flex-col items-center gap-4 border border-border toast-in text-center">
    {#if error}
      <div class="w-12 h-12 rounded-full grid place-items-center text-xl" style="background: var(--bg-input); color: var(--expense)" aria-hidden="true">!</div>
      <h1 class="text-xl font-extrabold tracking-tight text-txt-primary">Login belum berhasil</h1>
      <p class="text-sm text-txt-secondary" role="alert">{friendly}</p>
      <button
        type="button"
        class="w-full rounded-xl py-3.5 text-sm font-extrabold text-white border-2"
        style="background: var(--primary); border-color: var(--line); box-shadow: var(--shadow-sm)"
        on:click={() => goto('/login', { replaceState: true })}
      >
        Kembali ke halaman masuk
      </button>
    {:else}
      <div class="w-12 h-12 rounded-full border-4 animate-spin" style="border-color: var(--border); border-top-color: var(--primary)" aria-hidden="true"></div>
      <h1 class="text-xl font-extrabold tracking-tight text-txt-primary">Menyelesaikan login…</h1>
      <p class="text-sm text-txt-secondary" role="status">Sebentar ya, kami menyiapkan akunmu.</p>
    {/if}
  </div>
</div>
