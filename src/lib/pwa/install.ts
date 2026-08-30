import { writable, get } from 'svelte/store';

// The browser fires this event on Chromium-based browsers (and some
// others) when the app meets installability criteria. It's only usable
// once — capturing it here lets Settings show an "Install App" button
// whenever it's available, rather than waiting for the browser's own
// (often easy-to-miss) install icon in the address bar.
export const canInstall = writable(false);

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredEvent: BeforeInstallPromptEvent | null = null;

export function listenInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
    canInstall.set(true);
  });
  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    canInstall.set(false);
  });
}

export async function promptInstall(): Promise<void> {
  if (!deferredEvent) return;
  await deferredEvent.prompt();
  await deferredEvent.userChoice;
  deferredEvent = null;
  canInstall.set(false);
}

export function isInstallable(): boolean {
  return get(canInstall);
}
