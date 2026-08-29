<script lang="ts">
  import { transactions, reminders, customCategories } from '$lib/stores/data';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { getDisplayType } from '$lib/data/analytics';
  import { formatDate, formatRpC, todayStr } from '$lib/data/format';
  import { softDeleteRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import ReminderSheet from '$lib/components/ReminderSheet.svelte';

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const dowLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  let selectedDate: string | null = null;
  let reminderSheetOpen = false;

  function prevMonth() {
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  function nextMonth() {
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  $: monthLabel = `${monthNames[month]} ${year}`;
  $: from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  $: lastDay = new Date(year, month + 1, 0).getDate();
  $: to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  $: monthTxs = $transactions.filter((t) => (t.date as string) >= from && (t.date as string) <= to);
  $: monthRem = $reminders.filter((r) => (r.date as string) >= from && (r.date as string) <= to);
  $: mInc = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + (t.amount as number), 0);
  $: mExp = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount as number), 0);

  $: txByDate = (() => {
    const map: Record<string, { income: number; expense: number }> = {};
    monthTxs.forEach((t) => {
      const d = t.date as string;
      if (!map[d]) map[d] = { income: 0, expense: 0 };
      if (t.type === 'income') map[d].income += t.amount as number;
      if (t.type === 'expense') map[d].expense += t.amount as number;
    });
    return map;
  })();
  $: remByDate = (() => {
    const map: Record<string, number> = {};
    monthRem.forEach((r) => {
      const d = r.date as string;
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  })();

  $: firstDow = new Date(year, month, 1).getDay();
  $: daysInMonth = new Date(year, month + 1, 0).getDate();
  $: daysInPrev = new Date(year, month, 0).getDate();
  $: todayS = todayStr();

  $: cells = (() => {
    const arr: { label: number; date: string | null; otherMonth: boolean }[] = [];
    for (let i = firstDow - 1; i >= 0; i--) arr.push({ label: daysInPrev - i, date: null, otherMonth: true });
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ label: d, date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, otherMonth: false });
    }
    const total = firstDow + daysInMonth;
    const remainder = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let d = 1; d <= remainder; d++) arr.push({ label: d, date: null, otherMonth: true });
    return arr;
  })();

  function selectDate(date: string) {
    selectedDate = date;
  }

  $: dayTxs = selectedDate ? $transactions.filter((t) => t.date === selectedDate) : [];
  $: dayRems = selectedDate ? $reminders.filter((r) => r.date === selectedDate) : [];

  function catOf(t: (typeof dayTxs)[number]) {
    const dt = getDisplayType(t);
    const custom = $customCategories.filter((c) => c.type === dt) as unknown as Cat[];
    return getCatList(dt, custom).find((c) => c.id === t.cat_id) ?? { emoji: '💸', name: t.cat_id as string };
  }

  async function removeReminder(id: string) {
    await softDeleteRecord('reminders', id);
    showToast('Pengingat dihapus', 'info');
  }
</script>

<div class="p-4 flex flex-col gap-4 max-w-md mx-auto">
  <div class="flex items-center justify-between">
    <button on:click={prevMonth} class="w-8 h-8 flex items-center justify-center text-txt-secondary" aria-label="Bulan sebelumnya">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><polyline points="15 18 9 12 15 6" /></svg>
    </button>
    <p class="text-sm font-semibold text-txt-primary">{monthLabel}</p>
    <button on:click={nextMonth} class="w-8 h-8 flex items-center justify-center text-txt-secondary" aria-label="Bulan berikutnya">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  </div>

  <div class="grid grid-cols-3 gap-2">
    <div class="bg-base-card rounded-lg p-2.5 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Pemasukan</p>
      <p class="text-xs font-semibold mt-0.5" style="color: var(--income)">{formatRpC(mInc)}</p>
    </div>
    <div class="bg-base-card rounded-lg p-2.5 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Pengeluaran</p>
      <p class="text-xs font-semibold mt-0.5" style="color: var(--expense)">{formatRpC(mExp)}</p>
    </div>
    <div class="bg-base-card rounded-lg p-2.5 border border-border text-center">
      <p class="text-[10px] text-txt-secondary">Pengingat</p>
      <p class="text-xs font-semibold mt-0.5">{monthRem.length}</p>
    </div>
  </div>

  <div class="grid grid-cols-7 gap-1 text-center">
    {#each dowLabels as d (d)}
      <p class="text-[10px] text-txt-muted py-1">{d}</p>
    {/each}
    {#each cells as c, i (i)}
      {#if c.otherMonth}
        <div class="aspect-square"></div>
      {:else}
        {@const dayData = txByDate[c.date as string]}
        {@const hasRem = (remByDate[c.date as string] || 0) > 0}
        {@const isToday = c.date === todayS}
        {@const isSel = c.date === selectedDate}
        <button
          on:click={() => selectDate(c.date as string)}
          class="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs relative"
          style="background: {isSel ? 'var(--primary-bg)' : 'transparent'}; border: 1px solid {isToday
            ? 'var(--primary)'
            : isSel
              ? 'var(--primary)'
              : 'transparent'}; color: var(--txt-primary)"
        >
          <span>{c.label}</span>
          <span class="flex gap-0.5">
            {#if dayData?.income}<span class="w-1 h-1 rounded-full" style="background: var(--income)"></span>{/if}
            {#if dayData?.expense}<span class="w-1 h-1 rounded-full" style="background: var(--expense)"></span>{/if}
            {#if hasRem}<span class="w-1 h-1 rounded-full" style="background: var(--warn)"></span>{/if}
          </span>
        </button>
      {/if}
    {/each}
  </div>

  <section>
    <div class="flex items-center justify-between mb-2">
      <p class="text-xs font-medium text-txt-secondary">
        {selectedDate ? formatDate(selectedDate) : 'Pilih tanggal'}
      </p>
      {#if selectedDate}
        <button on:click={() => (reminderSheetOpen = true)} class="text-xs" style="color: var(--primary)">
          + Pengingat
        </button>
      {/if}
    </div>

    {#if !selectedDate}
      <p class="text-xs text-txt-secondary text-center py-10">Pilih tanggal di kalender untuk lihat agenda.</p>
    {:else if dayTxs.length === 0 && dayRems.length === 0}
      <p class="text-xs text-txt-secondary text-center py-10">
        Tidak ada agenda. Tap "+ Pengingat" atau catat transaksi lewat tab Transaksi.
      </p>
    {:else}
      <div class="flex flex-col gap-2">
        {#each dayRems as r (r.id)}
          <div class="flex items-center gap-3 bg-base-card rounded-lg p-3 border border-border">
            <span class="text-lg">🔔</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-txt-primary truncate">{r.title}</p>
              {#if r.amount}<p class="text-xs text-txt-secondary">{formatRpC(r.amount as number)}</p>{/if}
            </div>
            <button on:click={() => removeReminder(r.id)} aria-label="Hapus pengingat" class="text-txt-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
        {/each}
        {#each dayTxs as t (t.id)}
          {@const dt = getDisplayType(t)}
          {@const cat = catOf(t)}
          <div class="flex items-center gap-3 bg-base-card rounded-lg p-3 border border-border">
            <span class="text-lg">{cat.emoji}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-txt-primary truncate">{t.desc || 'Transaksi'}</p>
              <p class="text-xs text-txt-secondary">{cat.name}</p>
            </div>
            <p class="text-sm font-semibold shrink-0" style="color: {dt === 'income' ? 'var(--income)' : 'var(--expense)'}">
              {dt === 'income' ? '+' : '-'}{formatRpC(t.amount as number)}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<ReminderSheet open={reminderSheetOpen} date={selectedDate} onClose={() => (reminderSheetOpen = false)} />
