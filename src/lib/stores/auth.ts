import { supabase } from '$lib/supabase/client';
import { session, authReady, passwordRecovery } from './session';
import { startSync, stopSync } from '$lib/sync/engine';
import { wipeLocalDatabase } from '$lib/db/dexie';
import { get } from 'svelte/store';
import type { Provider, Session } from '@supabase/supabase-js';

export { session, authReady, passwordRecovery, getUserId } from './session';


function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Sesi Supabase terakhir yang tersimpan di localStorage (kunci `sb-<project>-auth-token`), atau null. */
function readStoredSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (parsed?.user?.id && parsed?.access_token) return parsed as Session;
    }
  } catch {
    /* localStorage tidak tersedia / isi rusak → anggap tidak ada sesi */
  }
  return null;
}

/** Call once, on app startup (see root +layout.svelte). */
export function initAuth(): void {
  supabase.auth.getSession().then(({ data }) => {
    // BUGFIX (offline): kalau access token sudah kedaluwarsa dan HP sedang offline, supabase-js gagal me-refresh
    // dan mengembalikan session null → route guard melempar ke /login padahal data lokal ada. Saat offline,
    // pakai sesi yang tersimpan supaya app tetap terbuka; begitu online, supabase-js me-refresh token sendiri.
    const effective = data.session ?? (isOffline() ? readStoredSession() : null);
    session.set(effective);
    authReady.set(true);
    if (effective) void startSync(effective.user.id);
  });

  supabase.auth.onAuthStateChange((event, newSession) => {
    const hadSession = !!get(session);
    // The recovery link's session must NOT trigger a normal sync
    // startup or drop the user straight into the app — it exists only
    // so they can set a new password on /reset-password.
    if (event === 'PASSWORD_RECOVERY') {
      passwordRecovery.set(true);
      session.set(newSession);
      return;
    }
    session.set(newSession);
    if (newSession && !hadSession) void startSync(newSession.user.id);
    // BUGFIX: this used to ALSO call wipeLocalDatabase() here, on the
    // theory that "session went from present to null" always means a
    // deliberate logout. It doesn't — a flaky connection during
    // Supabase's automatic token-refresh cycle (very plausible for an
    // offline-first app that sits disconnected for a while) can also
    // surface as a transient null session here, and this app can have
    // real unsynced work sitting in `syncQueue` at that exact moment
    // (an AI-applied budget, a freshly-scanned receipt, anything not
    // pushed yet). Wiping in that situation doesn't just hide data —
    // it PERMANENTLY DESTROYS it before it ever reached the server.
    // stopSync() + liveTable()'s own session-subscription (which
    // already clears every store to `[]` the instant `session` goes
    // null) are enough to stop showing this user's data immediately;
    // physically erasing the local mirror now only happens from the
    // explicit, deliberate signOut() below, never from an implicit
    // state change this handler can't fully distinguish from a hiccup.
    if (!newSession && hadSession) stopSync();
  });
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Masuk lewat OAuth (Google). Browser diarahkan ke penyedia login, lalu kembali ke /login dengan sesi
 * (dibaca otomatis oleh supabase-js lewat detectSessionInUrl) dan halaman /login meneruskan ke /dashboard.
 * Kalau penyedia belum diaktifkan di Supabase / redirect URL belum didaftarkan, error-nya dikembalikan
 * (atau muncul di URL saat kembali) dan ditampilkan di halaman login.
 * Tambah penyedia lain (mis. 'github', 'apple') cukup memanggil fungsi ini dengan provider berbeda.
 */
export async function signInWithOAuth(provider: Provider) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { data: null, error: new Error('Butuh koneksi internet untuk masuk') };
  }
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/login`,
      // Selalu tampilkan pemilih akun supaya tidak otomatis masuk ke akun Google yang salah.
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined
    }
  });
}

/**
 * Sends the "reset your password" email via Supabase Auth. The link in
 * that email brings the user back to /reset-password with a temporary
 * recovery session (handled by the PASSWORD_RECOVERY branch above).
 */
export async function requestPasswordReset(email: string) {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

/** Sets a new password while inside an active recovery session. */
export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function signOut(): Promise<void> {
  stopSync();
  await supabase.auth.signOut();
  // The onAuthStateChange handler above will ALSO fire after this and
  // try to wipe again — wipeLocalDatabase() clearing already-empty
  // tables is harmless, so no guard needed against calling it twice.
  await wipeLocalDatabase();
}
