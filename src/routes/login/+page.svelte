<script lang="ts">
  import { onMount } from 'svelte';
  import { signIn, signUp, requestPasswordReset, signInWithOAuth } from '$lib/stores/auth';

  let email = '';
  let password = '';
  let mode: 'signin' | 'signup' | 'forgot' = 'signin';
  let error = '';
  let info = '';
  let loading = false;
  let oauthLoading = false;

  // Kalau login Google gagal / dibatalkan, Supabase mengembalikan pesan di URL (hash atau query).
  onMount(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
    const desc = params.get('error_description');
    if (desc) {
      error = desc; // URLSearchParams sudah men-decode '+' jadi spasi
      history.replaceState(null, '', window.location.pathname);
    }
  });

  async function google() {
    error = '';
    info = '';
    oauthLoading = true;
    const { error: err } = await signInWithOAuth('google');
    // Sukses = browser sudah dialihkan ke Google (tidak sampai sini). Kalau sampai, berarti gagal.
    oauthLoading = false;
    if (err) {
      error = /provider is not enabled|Unsupported provider/i.test(err.message)
        ? 'Login Google belum diaktifkan di server. Coba masuk dengan email dulu.'
        : err.message;
    }
  }

  async function submit() {
    error = '';
    info = '';
    loading = true;
    if (mode === 'forgot') {
      if (!email) {
        error = 'Masukkan email dulu';
        loading = false;
        return;
      }
      const { error: err } = await requestPasswordReset(email);
      loading = false;
      if (err) {
        error = err.message;
      } else {
        info = 'Link reset password sudah dikirim ke email kamu. Cek inbox (atau folder spam).';
      }
      return;
    }
    const { error: err } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    loading = false;
    if (err) {
      error = err.message;
    } else if (mode === 'signup') {
      info = 'Akun dibuat — cek email untuk konfirmasi, lalu masuk.';
      mode = 'signin';
    }
  }
</script>

<div class="min-h-screen flex flex-col items-center justify-center font-main p-6">
  <div class="w-full max-w-sm flex flex-col items-center">
  <form
    on:submit|preventDefault={submit}
    class="w-full bg-base-card rounded-2xl shadow-lg p-6 flex flex-col gap-4 border border-border toast-in"
  >
    <div>
      <div class="w-14 h-14 rounded-full grid place-items-center coin-spin mb-3" style="background: var(--coin); border: 2px solid var(--line); box-shadow: var(--shadow-sm); color: #12151f">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-7 h-7">
          <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
        </svg>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tight text-txt-primary">Flow Money</h1>
      <p class="text-sm text-txt-secondary mt-1">
        {mode === 'signin'
          ? 'Masuk untuk sinkronkan data di semua device'
          : mode === 'signup'
            ? 'Buat akun baru'
            : 'Masukkan email untuk reset password'}
      </p>
    </div>

    {#if mode !== 'forgot'}
      <button
        type="button"
        on:click={google}
        disabled={oauthLoading || loading}
        class="rounded-xl py-3 text-sm font-extrabold border-2 flex items-center justify-center gap-2 disabled:opacity-60"
        style="background: var(--bg-card); border-color: var(--line); box-shadow: var(--shadow-sm); color: var(--txt-primary)"
      >
        <svg viewBox="0 0 48 48" class="w-5 h-5" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        {oauthLoading ? 'Mengalihkan…' : 'Lanjut dengan Google'}
      </button>
      <div class="flex items-center gap-3 text-[11px] text-txt-secondary -my-1">
        <span class="flex-1 h-px" style="background: var(--border)"></span>atau pakai email<span class="flex-1 h-px" style="background: var(--border)"></span>
      </div>
    {/if}

    <input
      type="email"
      bind:value={email}
      placeholder="Email"
      required
      autocomplete="email"
      class="rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
    />
    {#if mode !== 'forgot'}
      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        required
        minlength="6"
        autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
        class="rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
      />
    {/if}

    {#if mode === 'signin'}
      <button
        type="button"
        class="text-xs text-txt-secondary underline self-end -mt-2"
        on:click={() => {
          mode = 'forgot';
          error = '';
          info = '';
        }}
      >
        Lupa password?
      </button>
    {/if}

    {#if error}<p class="text-xs" style="color: var(--expense)">{error}</p>{/if}
    {#if info}<p class="text-xs" style="color: var(--income)">{info}</p>{/if}

    <button
      type="submit"
      disabled={loading}
      class="rounded-xl py-3.5 text-sm font-extrabold text-white disabled:opacity-60 border-2"
      style="background: var(--primary); border-color: var(--line); box-shadow: var(--shadow-sm)"
    >
      {loading ? 'Memproses…' : mode === 'signin' ? 'Masuk' : mode === 'signup' ? 'Daftar' : 'Kirim Link Reset'}
    </button>

    <button
      type="button"
      class="text-xs text-txt-secondary underline self-center"
      on:click={() => {
        mode = mode === 'signup' ? 'signin' : mode === 'forgot' ? 'signin' : 'signup';
        error = '';
        info = '';
      }}
    >
      {mode === 'signin' ? 'Belum punya akun? Daftar' : mode === 'signup' ? 'Sudah punya akun? Masuk' : 'Kembali ke halaman masuk'}
    </button>
  </form>
  <p class="text-[11px] text-txt-secondary text-center mt-4">
    Dengan masuk, kamu menyetujui
    <a href="/terms" target="_blank" rel="noopener" class="underline">Syarat Penggunaan</a> dan
    <a href="/privacy" target="_blank" rel="noopener" class="underline">Kebijakan Privasi</a>.
  </p>
  </div>
</div>
