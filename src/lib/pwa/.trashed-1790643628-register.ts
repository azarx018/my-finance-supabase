import { writable } from 'svelte/store';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = writable(false);
export const offlineReady = writable(false);

let applyUpdateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function initPwa(): void {
  if (typeof window === 'undefined') return;
  applyUpdateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable.set(true);
    },
    onOfflineReady() {
      offlineReady.set(true);
    },
    onRegisterError(error) {
      console.warn('[pwa] service worker registration failed:', error);
    }
  });
}

export async function applyUpdate(): Promise<void> {
  if (applyUpdateFn) await applyUpdateFn(true);
}
