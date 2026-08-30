<script lang="ts">
  import { onMount } from 'svelte';
  import { transactions, customCategories, budgets } from '$lib/stores/data';
  import { session } from '$lib/stores/session';
  import { getCatList, type Cat } from '$lib/data/categories';
  import { getBudgetMonth } from '$lib/data/budget';
  import {
    getAverageSpendingByCategory,
    findSalaryTransaction,
    getExistingBudget
  } from '$lib/data/analytics';
  import { askAssistant, isAssistantConfigured, type ChatTurn, type ProposeBudgetArgs } from '$lib/ai/assistant';
  import { upsertRecord } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import BudgetProposalCard from '$lib/components/BudgetProposalCard.svelte';

  interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    action?: { type: 'propose_budget'; args: ProposeBudgetArgs; applied: boolean };
  }

  let messages: ChatMessage[] = [];
  let draft = '';
  let counter = 0;
  let sending = false;

  const assistantConfigured = isAssistantConfigured();

  // Same reasoning as TxSheet's OCR button: only the parts that
  // genuinely need Gemini require being online. This page never locks
  // the input for that reason. There's no local-only fallback wired up
  // yet (that's a later phase), but the online tracker stays so that
  // logic has an obvious place to plug in without touching the rest of
  // this page.
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

  $: expenseCats = getCatList('expense', $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[]);

  // History sent to the Worker each turn — kept as plain text turns
  // (not persisted anywhere, resets on page leave per the "sementara"
  // decision). An action message is represented by its reasoning +
  // allocations so the model still remembers what it already proposed
  // if the person asks to adjust it ("tabungan minimal 500rb").
  function toApiHistory(msgs: ChatMessage[]): ChatTurn[] {
    return msgs.map((m) => ({
      role: m.role,
      text: m.action
        ? `Usulan budget ${m.action.args.month}: ${m.action.args.allocations
            .map((a) => `${a.category_id}=Rp${a.amount}`)
            .join(', ')}. Alasan: ${m.action.args.reasoning}`
        : m.text
    }));
  }

  async function send(text?: string) {
    const value = (text ?? draft).trim();
    if (!value || sending) return;
    const token = $session?.access_token;
    if (!token) {
      showToast('Sesi login tidak ditemukan, coba login ulang', 'error');
      return;
    }

    const history = toApiHistory(messages);
    messages = [...messages, { id: ++counter, role: 'user', text: value }];
    draft = '';
    sending = true;

    try {
      const month = getBudgetMonth();
      const result = await askAssistant(
        value,
        history,
        {
          current_month: month,
          categories: expenseCats.map((c) => ({ id: c.id, name: c.name })),
          salary_transaction: findSalaryTransaction($transactions, month),
          avg_spending_last_3mo: getAverageSpendingByCategory($transactions, 3),
          existing_budget_this_month: getExistingBudget($budgets, month)
        },
        token
      );

      if (result.type === 'action' && result.action === 'propose_budget') {
        messages = [
          ...messages,
          {
            id: ++counter,
            role: 'assistant',
            text: '',
            action: { type: 'propose_budget', args: result.args, applied: false }
          }
        ];
      } else if (result.type === 'text') {
        messages = [...messages, { id: ++counter, role: 'assistant', text: result.text }];
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Asisten lagi nggak bisa diakses, coba lagi nanti';
      messages = [...messages, { id: ++counter, role: 'assistant', text: `⚠️ ${errText}` }];
    } finally {
      sending = false;
    }
  }

  async function applyBudget(messageId: number, allocations: Array<{ category_id: string; amount: number }>) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.action) return;
    const month = msg.action.args.month;
    try {
      for (const alloc of allocations) {
        // Reuse the existing row's id when this category already has a
        // budget for this month (→ update), otherwise let upsertRecord
        // generate a new one (→ insert). `budgets` has a
        // unique(user_id, cat_id, month) constraint — guessing wrong
        // here is exactly the kind of bug that caused the sync issues
        // fixed earlier, so this mirrors BudgetSheet.svelte's own logic
        // rather than reinventing it.
        const existing = $budgets.find((b) => b.month === month && b.cat_id === alloc.category_id);
        await upsertRecord('budgets', {
          id: existing?.id,
          cat_id: alloc.category_id,
          limit_amount: alloc.amount,
          month
        });
      }
      messages = messages.map((m) =>
        m.id === messageId && m.action ? { ...m, action: { ...m.action, applied: true } } : m
      );
      showToast('Budget diterapkan');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menerapkan budget', 'error');
    }
  }

  function dismissBudget(messageId: number) {
    messages = messages.filter((m) => m.id !== messageId);
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
    {#if !assistantConfigured}
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
        <p class="text-sm font-semibold text-txt-primary">Asisten AI belum dikonfigurasi</p>
        <p class="text-xs text-txt-secondary max-w-[260px]">
          Set <code class="text-[10px]">PUBLIC_AI_WORKER_URL</code> di <code class="text-[10px]">.env</code> supaya fitur
          ini aktif.
        </p>
      </div>
    {:else if messages.length === 0}
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
          Tanya soal keuanganmu, atau minta dibuatkan budget bulanan — cukup ketik kayak ngobrol biasa.
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
          {#if m.action?.type === 'propose_budget'}
            <BudgetProposalCard
              args={m.action.args}
              categories={$customCategories.filter((c) => c.type === 'expense') as unknown as Cat[]}
              availableIncome={null}
              applied={m.action.applied}
              onApply={(allocations) => applyBudget(m.id, allocations)}
              onDismiss={() => dismissBudget(m.id)}
            />
          {:else}
            <div
              class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm {m.role === 'user'
                ? 'text-white rounded-br-sm'
                : 'bg-base-card border border-border text-txt-primary rounded-bl-sm'}"
              style={m.role === 'user' ? 'background: var(--primary)' : ''}
            >
              {m.text}
            </div>
          {/if}
        </div>
      {/each}
      {#if sending}
        <div class="flex justify-start">
          <div class="bg-base-card border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-txt-muted">
            Mengetik…
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if !online}
    <p class="px-4 pb-1 text-[10px] text-center" style="color: var(--warn)">
      Sedang offline — asisten butuh koneksi buat menjawab.
    </p>
  {/if}

  <div class="p-3 border-t border-border bg-base-nav flex items-end gap-2">
    <textarea
      bind:value={draft}
      on:keydown={onKeydown}
      rows="1"
      placeholder="Tanya sesuatu…"
      disabled={!assistantConfigured || sending}
      class="flex-1 resize-none rounded-lg bg-base-input border border-border px-3.5 py-2.5 text-sm text-txt-primary max-h-24 disabled:opacity-60"
    ></textarea>
    <button
      on:click={() => send()}
      disabled={!draft.trim() || !assistantConfigured || sending || !online}
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
