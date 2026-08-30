<script lang="ts">
  import { onMount } from 'svelte';

  interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    text: string;
  }

  let messages: ChatMessage[] = [];
  let draft = '';
  let counter = 0;

  // NOT the same as "disable everything when offline" like the OCR
  // button — by design, once the real backend exists, plenty of
  // questions ("berapa pengeluaran bulan ini?", "budget makanan
  // berapa?") can be answered purely from what's already mirrored in
  // Dexie, with zero network/AI call needed. Only requests that
  // genuinely need Gemini (open-ended analysis, generating a new
  // budget draft) should require being online. This page never fully
  // locks the input for that reason — it's tracked here so that logic
  // has an obvious place to plug into later.
  let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  onMount(() => {
    const goOnline = () => (online = true);
    const goOffline = () => (online = false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  });

  const SUGGESTIONS = [
    'Bikinin budget dari gaji bulan ini',
    'Pengeluaran terbesar bulan ini apa?',
    'Kenapa pengeluaran gue naik?'
  ];

  function send(text?: string) {
    const value = (text ?? draft).trim();
    if (!value) return;
    messages = [...messages, { id: ++counter, role: 'user', text: value }];
    draft = '';

    // Placeholder reply only — no Worker/Gemini call wired up yet.
    // Kept here (rather than a static banner) so the eventual real
    // reply just replaces this one function's body.
    const reply = online
      ? '🚧 Asisten AI masih dalam pengembangan. Nanti di sini bisa tanya-jawab soal keuanganmu dan bikinin usulan budget otomatis — tunggu update berikutnya!'
      : '🚧 Asisten AI masih dalam pengembangan. Kamu lagi offline — nanti pertanyaan yang cukup dijawab dari data di HP (misalnya rekap pengeluaran) tetap bisa jalan offline, cuma analisa/usulan dari AI yang perlu online.';
    setTimeout(() => {
      messages = [...messages, { id: ++counter, role: 'assistant', text: reply }];
    }, 300);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="flex flex-col h-[calc(100vh-3.5rem-6rem)] max-w-md mx-auto">
  <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
    {#if messages.length === 0}
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          style="background: var(--primary-bg, rgba(0,0,0,0.05))"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" class="w-7 h-7">
            <path
              d="M9.94 15.5a2 2 0 00-1.44-1.44L2.36 12.48a.5.5 0 010-.96l6.14-1.58A2 2 0 009.94 8.5l1.58-6.14a.5.5 0 01.96 0L14.06 8.5a2 2 0 001.44 1.44l6.14 1.58a.5.5 0 010 .96l-6.14 1.58a2 2 0 00-1.44 1.44l-1.58 6.14a.5.5 0 01-.96 0z"
            />
            <path d="M20 3v4" />
            <path d="M22 5h-4" />
            <path d="M4 17v2" />
            <path d="M5 18H3" />
          </svg>
        </div>
        <p class="text-sm font-semibold text-txt-primary">Asisten AI</p>
        <p class="text-xs text-txt-secondary max-w-[260px]">
          Masih dalam pengembangan. Nanti kamu bisa tanya soal keuanganmu, minta dibuatkan budget bulanan,
          sampai analisa pengeluaran — cukup ketik kayak ngobrol biasa.
        </p>
        <div class="flex flex-col gap-2 w-full mt-2">
          {#each SUGGESTIONS as s}
            <button
              on:click={() => send(s)}
              class="text-xs text-left px-3 py-2 rounded-lg border border-border text-txt-secondary bg-base-card"
            >
              {s}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      {#each messages as m (m.id)}
        <div class="flex {m.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div
            class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm {m.role === 'user'
              ? 'text-white rounded-br-sm'
              : 'bg-base-card border border-border text-txt-primary rounded-bl-sm'}"
            style={m.role === 'user' ? 'background: var(--primary)' : ''}
          >
            {m.text}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if !online}
    <p class="px-4 pb-1 text-[10px] text-center" style="color: var(--warn)">
      Sedang offline — pertanyaan yang butuh AI (analisa, bikin budget) baru bisa dijawab setelah online lagi.
    </p>
  {/if}

  <div class="p-3 border-t border-border bg-base-nav flex items-end gap-2">
    <textarea
      bind:value={draft}
      on:keydown={onKeydown}
      rows="1"
      placeholder="Tanya sesuatu…"
      class="flex-1 resize-none rounded-lg bg-base-input border border-border px-3.5 py-2.5 text-sm text-txt-primary max-h-24"
    ></textarea>
    <button
      on:click={() => send()}
      disabled={!draft.trim()}
      aria-label="Kirim"
      class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-white disabled:opacity-40"
      style="background: var(--primary)"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  </div>
</div>
