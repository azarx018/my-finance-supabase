<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import AssistantChat from './AssistantChat.svelte';

  export let open = false;
  export let onClose: () => void = () => {};
  export let title = 'Asisten AI';
  /** Halaman asal, dikirim ke worker agar jawaban fokus ke konteks halaman. */
  export let screen: string | undefined = undefined;
  export let suggestions: string[] | undefined = undefined;
  /** Kalimat yang langsung dikirim saat panel terbuka (opsional). */
  export let initialPrompt = '';
</script>

<!-- BottomSheet hanya merender isinya saat open, jadi chat dibuat baru tiap dibuka dan dibuang saat ditutup
     (tidak ada dua chat aktif sekaligus; riwayat tetap dibaca dari penyimpanan lokal yang sama). -->
<BottomSheet {open} {onClose}>
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-base font-extrabold text-txt-primary flex items-center gap-2">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" class="w-5 h-5" aria-hidden="true">
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      </svg>
      {title}
    </h2>
    <button
      on:click={onClose}
      aria-label="Tutup"
      class="w-11 h-11 rounded-full grid place-items-center border border-border text-txt-primary"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="w-4 h-4" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
  <AssistantChat embedded {screen} {suggestions} {initialPrompt} />
</BottomSheet>
