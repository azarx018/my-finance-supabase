import { supabase } from '$lib/supabase/client';
import { session, authReady, passwordRecovery } from './session';
import { startSync, stopSync } from '$lib/sync/engine';
import { wipeLocalDatabase } from '$lib/db/dexie';
import { get } from 'svelte/store';

export { session, authReady, passwordRecovery, getUserId } from './session';

/** Call once, on app startup (see root +layout.svelte). */
export function initAuth(): void {
  supabase.auth.getSession().then(({ data }) => {
    session.set(data.session);
    authReady.set(true);
    if (data.session) void startSync(data.session.user.id);
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
