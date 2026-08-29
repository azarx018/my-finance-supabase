import { writable } from 'svelte/store';

export interface ToastMsg {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

export const toasts = writable<ToastMsg[]>([]);
let counter = 0;

export function showToast(text: string, kind: ToastMsg['kind'] = 'success'): void {
  const id = ++counter;
  toasts.update((t) => [...t, { id, text, kind }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((m) => m.id !== id));
  }, 2500);
}
