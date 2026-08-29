import { writable, get } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';

// Kept in its own tiny module on purpose: src/lib/sync/engine.ts reads
// getUserId(), and src/lib/stores/auth.ts (which starts/stops the sync
// engine) writes to `session`. If both lived in auth.ts, engine.ts and
// auth.ts would import each other — a circular dependency. Importing
// from this leaf module instead keeps the dependency graph one-directional.
export const session = writable<Session | null>(null);
export const authReady = writable(false);

export function getUserId(): string | null {
  return get(session)?.user.id ?? null;
}
