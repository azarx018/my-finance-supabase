export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconPath: string; // raw <svg> inner markup, trusted/static (not user input)
}

// The 5 bottom-nav tabs, ported 1:1 from the original bottom-nav markup
// (same icons, same order, same labels).
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Home',
    path: '/dashboard',
    iconPath:
      '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
  },
  {
    id: 'tabungan',
    label: 'Tabungan',
    path: '/tabungan',
    iconPath:
      '<path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h2v-4h-2z"/>'
  },
  {
    id: 'riwayat',
    label: 'Transaksi',
    path: '/riwayat',
    iconPath:
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'
  },
  {
    id: 'analitik',
    label: 'Analitik',
    path: '/analitik',
    iconPath: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'
  },
  {
    id: 'budget',
    label: 'Budget',
    path: '/budget',
    iconPath: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
  }
];

// Menu lengkap untuk sidebar (tampilan desktop): 5 tab utama + halaman-halaman
// yang di HP diakses lewat menu "Lainnya" / ikon header.
export const SIDEBAR_ITEMS: NavItem[] = [
  ...NAV_ITEMS,
  {
    id: 'dompet',
    label: 'Dompet',
    path: '/dompet',
    iconPath: '<path d="M3 6h18v14H3z"/><path d="M3 10h18"/><path d="M16 15h2"/>'
  },
  {
    id: 'hutang',
    label: 'Hutang',
    path: '/hutang',
    iconPath: '<path d="M2 5h20v14H2z"/><path d="M2 10h20"/><path d="M6 15h4"/>'
  },
  {
    id: 'kalender',
    label: 'Kalender',
    path: '/kalender',
    iconPath: '<path d="M4 5h16v16H4z"/><path d="M4 10h16M8 3v4M16 3v4"/>'
  },
  {
    id: 'asisten',
    label: 'Asisten AI',
    path: '/asisten',
    iconPath: '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>'
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    path: '/settings',
    iconPath: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
  }
];

// Accessed via the ✨ icon in the header (not a bottom-nav tab — it's
// reachable from every page, not just one), so it gets a back button
// like the other SUB_PAGES below rather than sitting in NAV_ITEMS.
export const ASSISTANT_PAGE_ID = 'asisten';

// Ported from nav.js's `titles` map.
export const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  analitik: 'Analitik',
  riwayat: 'Transaksi',
  dompet: 'Dompet',
  lainnya: 'Lainnya',
  tabungan: 'Tabungan',
  hutang: 'Hutang',
  settings: 'Pengaturan',
  budget: 'Budget',
  kalender: 'Kalender',
  dev: 'Dev — Sync Test',
  asisten: 'Asisten AI'
};

// Ported from nav.js's SUB_PAGES — these show a back button instead of
// the logo, and (per the original's highlight logic) never light up a
// bottom-nav tab since none of them has a matching nav item.
export const SUB_PAGES = ['dompet', 'hutang', 'settings', 'kalender', 'dev', 'asisten'];

// FAB shows on every page where "+" starts a meaningful add-flow, and
// hides only where there's nothing sensible to add (analitik is
// read-only charts/reports, settings/lainnya are just menus).
export const FAB_VISIBLE_PAGES = ['dashboard', 'riwayat', 'dompet', 'hutang', 'tabungan', 'budget', 'kalender'];
export const FAB_VARIANT: Record<string, 'wallet' | 'expense'> = {
  dompet: 'wallet',
  hutang: 'expense'
};
