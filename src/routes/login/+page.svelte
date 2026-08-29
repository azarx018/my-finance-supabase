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

<div class="min-h-screen flex items-center justify-center bg-base-bg font-main p-6">
  <form
    on:submit|preventDefault={submit}
    class="w-full max-w-sm bg-base-card rounded-xl shadow-md p-6 flex flex-col gap-4"
  >
    <div>
      <h1 class="text-lg font-semibold text-txt-primary">My Finance</h1>
      <p class="text-xs text-txt-secondary mt-1">
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
      class="rounded-lg py-3 text-sm font-medium text-white transition-colors disabled:opacity-60"
      style="background: var(--primary)"
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
