<script lang="ts">
  import { goto } from '$app/navigation';
  import { updatePassword } from '$lib/stores/auth';
  import { passwordRecovery } from '$lib/stores/session';
  import { showToast } from '$lib/stores/toast';

  let password = '';
  let confirm = '';
  let error = '';
  let loading = false;
  let done = false;

  async function submit() {
    error = '';
    if (password.length < 6) {
      error = 'Password minimal 6 karakter';
      return;
    }
    if (password !== confirm) {
      error = 'Konfirmasi password tidak cocok';
      return;
    }
    loading = true;
    const { error: err } = await updatePassword(password);
    loading = false;
    if (err) {
      error = err.message;
      return;
    }
    done = true;
    passwordRecovery.set(false);
    showToast('Password berhasil diganti ✅');
    setTimeout(() => goto('/dashboard'), 1200);
  }
</script>

<div class="min-h-screen flex items-center justify-center font-main p-6">
  <div class="w-full max-w-sm bg-base-card rounded-2xl shadow-lg p-6 flex flex-col gap-4 border border-border toast-in">
    <div>
      <div class="w-14 h-14 rounded-full grid place-items-center coin-spin mb-3" style="background: var(--coin); border: 2px solid var(--line); box-shadow: var(--shadow-sm); color: #12151f">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-7 h-7">
          <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4" />
        </svg>
      </div>
      <h1 class="text-3xl font-extrabold tracking-tight text-txt-primary">Buat Password Baru</h1>
      <p class="text-sm text-txt-secondary mt-1">Masukkan password baru untuk akun My Finance kamu.</p>
    </div>

    {#if done}
      <p class="text-sm" style="color: var(--income)">Berhasil! Mengarahkan ke dashboard…</p>
    {:else}
      <form on:submit|preventDefault={submit} class="flex flex-col gap-4">
        <input
          type="password"
          bind:value={password}
          placeholder="Password baru"
          required
          minlength="6"
          autocomplete="new-password"
          class="rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
        />
        <input
          type="password"
          bind:value={confirm}
          placeholder="Ulangi password baru"
          required
          minlength="6"
          autocomplete="new-password"
          class="rounded-lg bg-base-input border border-border px-4 py-3 text-sm text-txt-primary"
        />
        {#if error}<p class="text-xs" style="color: var(--expense)">{error}</p>{/if}
        <button
          type="submit"
          disabled={loading}
          class="rounded-xl py-3.5 text-sm font-extrabold text-white disabled:opacity-60 border-2"
          style="background: var(--primary); border-color: var(--line); box-shadow: var(--shadow-sm)"
        >
          {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
        </button>
      </form>
    {/if}
  </div>
</div>
