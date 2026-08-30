import { supabase } from '$lib/supabase/client';
import { session, authReady, passwordRecovery } from './session';
import { startSync, stopSync } from '$lib/sync/engine';
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
}
