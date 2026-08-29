import { writable } from 'svelte/store';

// Single source of truth for theme + dark mode. Both Header (dark-mode
// toggle) and Settings (full ThemeSwitcher) read/write the same stores,
// so there's no prop-drilling and no two places that can disagree about
// what's currently active. Persisting these to the user's row (so it
// survives reinstall/other devices) is a Settings-page task for a later
// sprint — for now they reset to defaults on reload, same as before any
// settings page existed.
export const theme = writable<'emerald' | 'pink' | 'ocean'>('emerald');
export const darkMode = writable(false);

if (typeof document !== 'undefined') {
  theme.subscribe((t) => document.body.setAttribute('data-theme', t));
  darkMode.subscribe((v) => document.body.classList.toggle('dark-mode', v));
}
