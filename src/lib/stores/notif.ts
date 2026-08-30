import { writable } from 'svelte/store';

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof localStorage === 'undefined') return fallback;
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === 'true';
}
function loadStr(key: string, fallback: string): string {
  if (typeof localStorage === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export const notifEnabled = writable<boolean>(loadBool('mf_notif_enabled', false));
export const notifTime = writable<string>(loadStr('mf_notif_time', '20:00'));

if (typeof localStorage !== 'undefined') {
  notifEnabled.subscribe((v) => localStorage.setItem('mf_notif_enabled', String(v)));
  notifTime.subscribe((v) => localStorage.setItem('mf_notif_time', v));
}
