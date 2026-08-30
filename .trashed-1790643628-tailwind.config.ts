import type { Config } from 'tailwindcss';

// IMPORTANT: colors here all point to CSS custom properties (defined in
// src/app.css per `body[data-theme="..."]` block), not literal hex values.
// This is what makes theme switching a runtime attribute change instead of
// requiring a rebuild — Tailwind just emits `color: var(--primary)` etc.
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: ['selector', '.dark-mode'], // unused today (dark mode runs via CSS vars, not `dark:` utilities) — fixed for correctness in case that changes
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-light': 'var(--primary-light)',
        'primary-bg': 'var(--primary-bg)',
        income: 'var(--income)',
        'income-bg': 'var(--income-bg)',
        expense: 'var(--expense)',
        'expense-bg': 'var(--expense-bg)',
        warn: 'var(--warn)',
        'warn-bg': 'var(--warn-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        accent: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)',
          800: 'var(--accent-800)',
          900: 'var(--accent-900)'
        },
        base: {
          bg: 'var(--bg-base)',
          card: 'var(--bg-card)',
          card2: 'var(--bg-card2)',
          input: 'var(--bg-input)',
          pill: 'var(--bg-pill)',
          nav: 'var(--bg-nav)',
          sheet: 'var(--bg-sheet)'
        },
        txt: {
          primary: 'var(--txt-primary)',
          secondary: 'var(--txt-secondary)',
          muted: 'var(--txt-muted)'
        },
        border: 'var(--border)'
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)'
      },
      fontFamily: {
        main: ['Sora', 'sans-serif'],
        mono: ['DM Mono', 'monospace']
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)'
      }
    }
  },
  plugins: []
} satisfies Config;
