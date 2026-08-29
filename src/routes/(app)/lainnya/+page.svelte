<script lang="ts">
  import { goto } from '$app/navigation';

  // Replaced emoji icons with line-SVG to match the app's icon system
  // elsewhere (bottom nav, header) — keeps this menu visually consistent
  // instead of mixing emoji glyphs with vector icons.
  const items = [
    {
      path: '/dompet',
      label: 'Dompet',
      desc: 'Kelola saldo & rekening',
      icon: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/>'
    },
    {
      path: '/hutang',
      label: 'Hutang & Piutang',
      desc: 'Catat pinjaman & tagihan',
      icon: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="9" x2="23" y2="9"/><line x1="5" y1="14" x2="10" y2="14"/>'
    },
    {
      path: '/kalender',
      label: 'Kalender',
      desc: 'Pengingat & histori harian',
      icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
    },
    {
      path: '/settings',
      label: 'Pengaturan',
      desc: 'Tema, mode gelap, akun',
      icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>'
    }
  ];
</script>

<div class="p-4 flex flex-col gap-3 max-w-md mx-auto">
  {#each items as item (item.path)}
    <button
      on:click={() => goto(item.path)}
      class="flex items-center gap-3 bg-base-card rounded-xl p-4 border border-border shadow-sm text-left active:scale-[0.98] transition-transform"
    >
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style="background: var(--primary-bg); color: var(--primary)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          {@html item.icon}
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-txt-primary">{item.label}</p>
        <p class="text-xs text-txt-secondary">{item.desc}</p>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-txt-muted shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  {/each}
</div>
