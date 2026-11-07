<script lang="ts">
  import { isAssistantConfigured } from '$lib/ai/assistant';

  /** Dipanggil dengan kalimat chip, atau '' kalau yang ditekan kolom "Tanya…". */
  export let onAsk: (prompt: string) => void = () => {};
  export let title = 'Asisten AI';
  export let subtitle = 'Minta dibantu, atau tanya apa saja';
  export let placeholder = 'Tanya asisten…';
  export let chips: string[] = [];
  /** true = kolom ketik sungguhan (catat cepat): Enter/kirim membuka panel dan langsung mengirim kalimatnya. */
  export let quick = false;

  let draft = '';
  function submitQuick() {
    const text = draft.trim();
    if (!text) return;
    draft = '';
    onAsk(text);
  }

  const configured = isAssistantConfigured();
</script>

<!-- Pintu masuk asisten di halaman lain. Tidak tampil kalau asisten belum dikonfigurasi (PUBLIC_AI_WORKER_URL kosong). -->
{#if configured}
  <section
    class="rounded-xl p-3.5 span-all flex flex-col gap-2.5"
    style="background: var(--bg-card2); border: 2px solid var(--line); box-shadow: var(--shadow-sm)"
  >
    <div class="flex items-center gap-2.5">
      <span
        class="w-9 h-9 rounded-full grid place-items-center shrink-0"
        style="background: var(--coin); border: 2px solid var(--line)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#12151f" stroke-width="2.2" stroke-linejoin="round" class="w-[18px] h-[18px]" aria-hidden="true">
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        </svg>
      </span>
      <div class="min-w-0">
        <p class="text-sm font-extrabold text-txt-primary">{title}</p>
        {#if subtitle}<p class="text-xs text-txt-secondary">{subtitle}</p>{/if}
      </div>
    </div>
    {#if quick}
      <form on:submit|preventDefault={submitQuick} class="flex gap-2">
        <input
          bind:value={draft}
          {placeholder}
          enterkeyhint="send"
          autocomplete="off"
          class="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl text-base text-txt-primary"
          style="background: var(--bg-card); border: 2px solid var(--line)"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Kirim"
          class="w-11 h-11 shrink-0 rounded-xl grid place-items-center disabled:opacity-40"
          style="background: var(--coin); border: 2px solid var(--line)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#12151f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    {:else}
    <button
      on:click={() => onAsk('')}
      class="flex items-center justify-between w-full min-h-[44px] px-3.5 rounded-xl text-left text-sm text-txt-secondary"
      style="background: var(--bg-card); border: 2px solid var(--line)"
    >
      {placeholder}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-[18px] h-[18px] text-txt-primary" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
    {/if}
    {#if chips.length > 0}
      <div class="flex flex-wrap gap-2">
        {#each chips as chip}
          <button
            on:click={() => onAsk(chip)}
            class="min-h-[44px] px-3 rounded-full text-xs font-bold text-txt-primary"
            style="background: var(--bg-card); border: 2px solid var(--line)"
          >
            {chip}
          </button>
        {/each}
      </div>
    {/if}
  </section>
{/if}
