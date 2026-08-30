import { writable, get } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';

// Kept in its own tiny module on purpose: src/lib/sync/engine.ts reads
// getUserId(), and src/lib/stores/auth.ts (which starts/stops the sync
// engine) writes to `session`. If both lived in auth.ts, engine.ts and
// auth.ts would import each other — a circular dependency. Importing
// from this leaf module instead keeps the dependency graph one-directional.
export const session = writable<Session | null>(null);
export const authReady = writable(false);
// Set true only while the user is in the middle of a password-recovery
// flow (clicked the email link, Supabase gave them a temporary session
// via the URL). Lets the root layout guard treat this session
// differently — send them to /reset-password instead of straight into
// the app.
export const passwordRecovery = writable(false);

export function getUserId(): string | null {
  return get(session)?.user.id ?? null;
}
