<script lang="ts">
  import { goto } from '$app/navigation';

  const items = [
    { path: '/dompet', label: 'Dompet', emoji: '👛', desc: 'Kelola saldo & rekening' },
    { path: '/hutang', label: 'Hutang & Piutang', emoji: '💳', desc: 'Catat pinjaman & tagihan' },
    { path: '/kalender', label: 'Kalender', emoji: '📅', desc: 'Pengingat & histori harian' },
    { path: '/settings', label: 'Pengaturan', emoji: '⚙️', desc: 'Tema, mode gelap, akun' }
  ];
</script>

<div class="p-4 flex flex-col gap-3 max-w-md mx-auto">
  {#each items as item (item.path)}
    <button
      on:click={() => goto(item.path)}
      class="flex items-center gap-3 bg-base-card rounded-lg p-4 border border-border text-left"
    >
      <span class="text-2xl">{item.emoji}</span>
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
