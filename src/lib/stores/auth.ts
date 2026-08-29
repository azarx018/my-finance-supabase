import { supabase } from '$lib/supabase/client';
import { session, authReady } from './session';
import { startSync, stopSync } from '$lib/sync/engine';
import { get } from 'svelte/store';

export { session, authReady, getUserId } from './session';

/** Call once, on app startup (see root +layout.svelte). */
export function initAuth(): void {
  supabase.auth.getSession().then(({ data }) => {
    session.set(data.session);
    authReady.set(true);
    if (data.session) void startSync(data.session.user.id);
  });

  supabase.auth.onAuthStateChange((_event, newSession) => {
    const hadSession = !!get(session);
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

export async function signOut(): Promise<void> {
  stopSync();
  await supabase.auth.signOut();
}
