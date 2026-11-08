import { writable } from 'svelte/store';

// Single source of truth for theme + dark mode. Both Header (dark-mode
// toggle) and Settings (full ThemeSwitcher) read/write the same stores,
// so there's no prop-drilling and no two places that can disagree about
// what's currently active.
//
// BUGFIX: these used to be plain in-memory writables with no
// persistence at all, so EVERY reload (not just after going offline —
// that was just when it was most noticeable) silently reset the user
// back to the emerald/light default. Now backed by localStorage, read
// synchronously at module init so there's no flash of the wrong theme.
const THEME_KEY = 'my-finance:theme';
const DARK_KEY = 'my-finance:dark-mode';

type ThemeId = 'emerald' | 'pink' | 'ocean';
const VALID_THEMES: ThemeId[] = ['emerald', 'pink', 'ocean'];

function readStoredTheme(): ThemeId {
  if (typeof localStorage === 'undefined') return 'emerald';
  const v = localStorage.getItem(THEME_KEY);
  return (VALID_THEMES as string[]).includes(v ?? '') ? (v as ThemeId) : 'emerald';
}
function readStoredDarkMode(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(DARK_KEY) === '1';
}

export const theme = writable<ThemeId>(readStoredTheme());
export const darkMode = writable<boolean>(readStoredDarkMode());

// BUGFIX: the OS/browser status bar color (the <meta name="theme-color">
// tag) used to be a hardcoded "#22c55e" (emerald green) in app.html,
// completely ignoring whichever theme + light/dark mode the user actually
// picked — so a pink-theme user still got a green status bar. --bg-nav is
// the CSS var the in-app header itself is painted with, so reading it
// straight from computed style (instead of hand-duplicating the hex
// values here) guarantees the status bar always matches whatever's
// actually at the top of the screen, even if the palette changes later.
function syncThemeColorMeta(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bgNav = getComputedStyle(document.body).getPropertyValue('--bg-nav').trim();
  if (bgNav) meta.setAttribute('content', bgNav);
}

if (typeof document !== 'undefined') {
  theme.subscribe((t) => {
    document.body.setAttribute('data-theme', t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage unavailable (private mode, quota, etc.) — theme still works for this session */
    }
    syncThemeColorMeta();
  });
  darkMode.subscribe((v) => {
    document.body.classList.toggle('dark-mode', v);
    try {
      localStorage.setItem(DARK_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
    syncThemeColorMeta();
  });
}
