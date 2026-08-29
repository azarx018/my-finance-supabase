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

<div class="min-h-screen flex items-center justify-center bg-base-bg font-main p-6">
  <div class="w-full max-w-sm bg-base-card rounded-xl shadow-md p-6 flex flex-col gap-4">
    <div>
      <h1 class="text-lg font-semibold text-txt-primary">Buat Password Baru</h1>
      <p class="text-xs text-txt-secondary mt-1">Masukkan password baru untuk akun My Finance kamu.</p>
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
          class="rounded-lg py-3 text-sm font-medium text-white disabled:opacity-60"
          style="background: var(--primary)"
        >
          {loading ? 'Menyimpan…' : 'Simpan Password Baru'}
        </button>
      </form>
    {/if}
  </div>
</div>
