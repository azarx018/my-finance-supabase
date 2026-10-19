<script lang="ts">
  import { signIn, signUp, requestPasswordReset } from '$lib/stores/auth';

  let email = '';
  let password = '';
  let mode: 'signin' | 'signup' | 'forgot' = 'signin';
  let error = '';
  let info = '';
  let loading = false;

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

<div class="min-h-screen flex items-center justify-center font-main p-6">
  <form
    on:submit|preventDefault={submit}
    class="w-full max-w-sm bg-base-card rounded-2xl shadow-lg p-6 flex flex-col gap-4 border border-border toast-in"
  >
    <div>
      <div class="w-14 h-14 rounded-full grid place-items-center coin-spin mb-3" style="background: var(--coin); border: 2px solid var(--ink); box-shadow: var(--shadow-sm); color: #12151f">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-7 h-7">
          <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
        </svg>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tight text-txt-primary">My Finance</h1>
      <p class="text-sm text-txt-secondary mt-1">
        {mode === 'signin'
          ? 'Masuk untuk sinkronkan data di semua device'
          : mode === 'signup'
            ? 'Buat akun baru'
            : 'Masukkan email untuk reset password'}
      </p>
    </div>

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
      style="background: var(--primary); border-color: var(--ink); box-shadow: var(--shadow-sm)"
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
</div>
