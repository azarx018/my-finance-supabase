import { writable } from 'svelte/store';
import { confetti } from '$lib/fx/confetti';

export interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

export const toasts = writable<ToastMsg[]>([]);
let counter = 0;

// Emoji di teks toast dibuang: ikonnya sekarang dari tampilan toast sendiri.
const EMOJI = /[\p{Extended_Pictographic}\uFE0F]/gu;

export function showToast(text: string, kind: ToastMsg['kind'] = 'success'): void {
  const id = ++counter;
  const clean = text.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
  toasts.update((t) => [...t, { id, text: clean, kind }]);
  if (kind === 'success') confetti();
  setTimeout(() => {
    toasts.update((t) => t.filter((m) => m.id !== id));
  }, 2600);
}
