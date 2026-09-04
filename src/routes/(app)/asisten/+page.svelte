<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { transactions, customCategories, budgets, wallets, debts, assistantMemory } from '$lib/stores/data';
  import { session, getUserId } from '$lib/stores/session';
  import { getCatList, type Cat, WALLET_EMOJIS } from '$lib/data/categories';
  import { getBudgetMonth } from '$lib/data/budget';
  import { computeWalletStats } from '$lib/data/wallets';
  import { todayStr } from '$lib/data/format';
  import {
    getAverageSpendingByCategory,
    findSalaryTransaction,
    getExistingBudget,
    getSpendingSummary,
    getPreviousMonth,
    getActiveDebts,
    type ActiveDebtInfo
  } from '$lib/data/analytics';
  import {
    askAssistant,
    isAssistantConfigured,
    type ChatTurn,
    type AssistantAction,
    type ProposeBudgetArgs,
    type ProposeSavingArgs,
    type ProposeWalletArgs,
    type ProposeTransactionArgs,
    type ProposeDebtArgs,
    type ProposeDebtPaymentArgs,
    type RememberFactArgs
  } from '$lib/ai/assistant';
  import { loadHistory, appendHistory, updateHistoryAction, deleteHistoryMessage } from '$lib/ai/chatHistory';
  import { upsertRecord, atomic, newId } from '$lib/db/repo';
  import { showToast } from '$lib/stores/toast';
  import BudgetProposalCard from '$lib/components/BudgetProposalCard.svelte';
  import SavingProposalCard from '$lib/components/SavingProposalCard.svelte';
  import WalletProposalCard from '$lib/components/WalletProposalCard.svelte';
  import TransactionProposalCard from '$lib/components/TransactionProposalCard.svelte';
  import DebtProposalCard from '$lib/components/DebtProposalCard.svelte';
  import DebtPaymentProposalCard from '$lib/components/DebtPaymentProposalCard.svelte';
  import RememberFactCard from '$lib/components/RememberFactCard.svelte';

  type ChatAction =
    | { kind: 'propose_budget'; args: ProposeBudgetArgs; applied: boolean }
    | { kind: 'propose_saving'; args: ProposeSavingArgs; applied: boolean }
    | { kind: 'propose_wallet'; args: ProposeWalletArgs; applied: boolean }
    | { kind: 'propose_transaction'; args: ProposeTransactionArgs; applied: boolean }
    | { kind: 'propose_debt'; args: ProposeDebtArgs; applied: boolean }
    | { kind: 'propose_debt_payment'; args: ProposeDebtPaymentArgs; applied: boolean }
    | { kind: 'remember_fact'; args: RememberFactArgs; applied: boolean };

  interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    action?: ChatAction;
    batchId?: string | null;
  }

  let messages: ChatMessage[] = [];
  let draft = '';
  let sending = false;
  let historyLoaded = false;
  let scrollContainer: HTMLDivElement;
  let textareaEl: HTMLTextAreaElement;
  // Tracks the amount the person last confirmed as "available" (from
  // salary or stated manually) so BudgetProposalCard's "sisa belum
  // dialokasikan" row has something to compare against. Best-effort: we
  // only reliably know this when it comes from the detected salary
  // transaction: a manually-typed number in free text isn't parsed here.
  let lastKnownIncome: number | null = null;

  const assistantConfigured = isAssistantConfigured();

  let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
  onMount(() => {
    const goOnline = () => (online = true);
    const goOffline = () => (online = false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Level A memory: reload the last ~20 messages for this device so
    // reopening the page (or the whole app being killed and reopened —
    // technically indistinguishable once this is on disk, see
    // chatHistory.ts) doesn't start from a blank slate every time.
    const userId = getUserId();
    if (userId) {
      loadHistory(userId).then((rows) => {
        messages = rows.map((r) => ({
          id: r.id,
          role: r.role,
          text: r.text,
          action: r.actionJson ? JSON.parse(r.actionJson) : undefined,
          batchId: r.batchId
        }));
        historyLoaded = true;
      });
    } else {
      historyLoaded = true;
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  });

  const SUGGESTIONS = [
    'Bikinin budget dari gaji bulan ini',
    'Catetin: makan siang 20rb, ngopi 15rb',
    'Pengeluaran terbesar bulan ini apa?'
  ];

  $: expenseCatsList = getCatList('expense', $customCategories.filter((c) => c.type === 'expense') as unknown as Cat[]);
  $: incomeCatsList = getCatList('income', $customCategories.filter((c) => c.type === 'income') as unknown as Cat[]);
  $: walletStats = computeWalletStats($wallets, $transactions);
  $: walletBalances = Object.fromEntries($wallets.map((w) => [w.id, walletStats[w.id]?.balance ?? 0]));
  $: activeDebts = getActiveDebts($debts);
  $: month = getBudgetMonth();
  $: existingBudgetThisMonth = getExistingBudget($budgets, month);
  $: spendingThisMonth = getSpendingSummary($transactions, month);
  $: spentByCategory = Object.fromEntries(spendingThisMonth.by_category.map((c) => [c.cat_id, c.amount]));
  $: memoryList = $assistantMemory.map((m) => m.content as string);

  // Auto-scroll: whenever the message list changes (new user message, AI
  // reply, an action card, or the "Mengetik…" indicator appearing) or
  // history finishes loading on open, snap to the bottom. `tick()`
  // waits for Svelte to actually paint the new content first —
  // otherwise `scrollHeight` would still reflect the shorter, pre-update
  // layout and the scroll would land short.
  async function scrollToBottom() {
    await tick();
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
  $: messages, sending, historyLoaded, scrollToBottom();

  // Grows the input with what's typed instead of staying pinned at one
  // line — reset to 'auto' first so shrinking (e.g. after deleting text)
  // isn't stuck at the tallest height it ever reached. `max-h-24` in the
  // markup below still caps how tall this can get before it scrolls
  // internally instead of growing forever.
  function autoResizeTextarea() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = `${textareaEl.scrollHeight}px`;
  }

  function persist(m: ChatMessage) {
    const userId = getUserId();
    if (!userId) return;
    void appendHistory({
      id: m.id,
      userId,
      role: m.role,
      text: m.text,
      actionJson: m.action ? JSON.stringify(m.action) : null,
      batchId: m.batchId ?? null,
      createdAt: Date.now()
    });
  }

  function toApiHistory(msgs: ChatMessage[]): ChatTurn[] {
    return msgs.map((m) => {
      if (!m.action) return { role: m.role, text: m.text };
      const a = m.action;
      switch (a.kind) {
        case 'propose_budget':
          return {
            role: m.role,
            text: `Usulan budget ${a.args.month}: ${a.args.allocations.map((x) => `${x.category_id}=Rp${x.amount}`).join(', ')}. Alasan: ${a.args.reasoning}`
          };
        case 'propose_saving':
          return { role: m.role, text: `Usulan tabungan "${a.args.name}": Rp${a.args.amount}. Alasan: ${a.args.reasoning}` };
        case 'propose_wallet':
          return { role: m.role, text: `Usulan dompet baru "${a.args.name}" saldo awal Rp${a.args.initial_balance}.` };
        case 'propose_transaction':
          return {
            role: m.role,
            text: `Usulan transaksi ${a.args.type}: ${a.args.description} Rp${a.args.amount} (${a.args.category_id}, ${a.args.date}).`
          };
        case 'propose_debt':
          return { role: m.role, text: `Usulan ${a.args.dtype} "${a.args.name}" Rp${a.args.amount}. Alasan: ${a.args.reasoning}` };
        case 'propose_debt_payment':
          return { role: m.role, text: `Usulan bayar hutang id ${a.args.debt_id} Rp${a.args.amount}. Alasan: ${a.args.reasoning}` };
        case 'remember_fact':
          return { role: m.role, text: `Usulan diingat: "${a.args.content}"` };
      }
    });
  }

  function actionToChatAction(a: AssistantAction): ChatAction {
    switch (a.action) {
      case 'propose_budget':
        return { kind: 'propose_budget', args: a.args, applied: false };
      case 'propose_saving':
        return { kind: 'propose_saving', args: a.args, applied: false };
      case 'propose_wallet':
        return { kind: 'propose_wallet', args: a.args, applied: false };
      case 'propose_transaction':
        return { kind: 'propose_transaction', args: a.args, applied: false };
      case 'propose_debt':
        return { kind: 'propose_debt', args: a.args, applied: false };
      case 'propose_debt_payment':
        return { kind: 'propose_debt_payment', args: a.args, applied: false };
      case 'remember_fact':
        return { kind: 'remember_fact', args: a.args, applied: false };
    }
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
    const userMsg: ChatMessage = { id: newId(), role: 'user', text: value };
    messages = [...messages, userMsg];
    persist(userMsg);
    draft = '';
    if (textareaEl) textareaEl.style.height = 'auto'; // programmatic clear doesn't fire 'input', so the grown height wouldn't otherwise reset
    sending = true;

    try {
      const salary = findSalaryTransaction($transactions, month);
      if (salary) lastKnownIncome = salary.amount;

      const result = await askAssistant(
        value,
        history,
        {
          today: todayStr(),
          current_month: month,
          expense_categories: expenseCatsList.map((c) => ({ id: c.id, name: c.name })),
          income_categories: incomeCatsList.map((c) => ({ id: c.id, name: c.name })),
          wallets: $wallets.map((w) => ({ id: w.id, name: w.name as string })),
          debts: activeDebts,
          memory: memoryList,
          salary_transaction: salary ? { amount: salary.amount, date: salary.date, wallet_id: salary.walletId } : null,
          avg_spending_last_3mo: getAverageSpendingByCategory($transactions, 3),
          existing_budget_this_month: existingBudgetThisMonth,
          spending_this_month: spendingThisMonth,
          spending_last_month: getSpendingSummary($transactions, getPreviousMonth(month))
        },
        token
      );

      if (result.type === 'actions') {
        // Only tag a batchId when there's actually more than one action
        // to group — a single action never needs a "Terapkan Semua"
        // button next to its own individual one.
        const batchId = result.actions.length > 1 ? newId() : null;
        const newMessages: ChatMessage[] = result.actions.map((a) => ({
          id: newId(),
          role: 'assistant',
          text: '',
          action: actionToChatAction(a),
          batchId
        }));
        messages = [...messages, ...newMessages];
        newMessages.forEach(persist);
      } else {
        const replyMsg: ChatMessage = { id: newId(), role: 'assistant', text: result.text };
        messages = [...messages, replyMsg];
        persist(replyMsg);
      }
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Asisten lagi nggak bisa diakses, coba lagi nanti';
      const errMsg: ChatMessage = { id: newId(), role: 'assistant', text: `⚠️ ${errText}` };
      messages = [...messages, errMsg];
      persist(errMsg);
    } finally {
      sending = false;
    }
  }

  function markApplied(messageId: string) {
    messages = messages.map((m) =>
      m.id === messageId && m.action ? { ...m, action: { ...m.action, applied: true } } : m
    );
    const updated = messages.find((m) => m.id === messageId);
    if (updated?.action) void updateHistoryAction(messageId, JSON.stringify(updated.action));
  }

  async function applyBudget(messageId: string, allocations: Array<{ category_id: string; amount: number }>) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.action || msg.action.kind !== 'propose_budget') return;
    const budgetMonth = msg.action.args.month;
    try {
      // BUGFIX (audit #2, atomicity): each budget row is independent
      // (unlike saving/debt, they don't reference each other), but a
      // partial apply — say 3 of 5 categories written before an error —
      // would still leave the person with a half-applied budget and no
      // clean way to tell which categories got the AI's numbers and
      // which didn't. Atomic here means "Terapkan" either fully
      // succeeds or the budget stays exactly as it was before.
      await atomic(['budgets'], async () => {
        for (const alloc of allocations) {
          const existing = $budgets.find((b) => b.month === budgetMonth && b.cat_id === alloc.category_id);
          await upsertRecord('budgets', {
            id: existing?.id,
            cat_id: alloc.category_id,
            limit_amount: alloc.amount,
            month: budgetMonth
          });
        }
      });
      markApplied(messageId);
      showToast('Budget diterapkan');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menerapkan budget', 'error');
    }
  }

  /**
   * Creates an ACTUAL active savings goal — not a budget line (see the
   * SAVINGS_CATEGORY_ID note in the Worker's assistant.ts for why this
   * exists as its own action). Mirrors BucketSheet.svelte +
   * SavingTxSheet.svelte's own submit logic exactly.
   */
  async function applySaving(messageId: string, data: { name: string; amount: number; walletId: string }) {
    const balance = walletStats[data.walletId]?.balance ?? 0;
    if (balance < data.amount) {
      showToast('Saldo dompet tidak cukup', 'error');
      return;
    }
    try {
      await atomic(['saving_buckets', 'saving_txs', 'transactions'], async () => {
        const bucket = await upsertRecord('saving_buckets', {
          name: data.name,
          emoji: '🐷',
          target: 0,
          status: 'active'
        });
        await upsertRecord('saving_txs', {
          bucket_id: bucket.id,
          wallet_id: data.walletId,
          type: 'deposit',
          amount: data.amount,
          date: todayStr(),
          note: 'Dibuat dari Asisten AI'
        });
        await upsertRecord('transactions', {
          type: 'saving_transfer',
          direction: 'deposit',
          amount: data.amount,
          cat_id: 'saving_transfer',
          description: `Tabung → ${data.name}`,
          date: todayStr(),
          wallet_id: data.walletId,
          note: 'Dibuat dari Asisten AI',
          photo: null,
          bucket_id: bucket.id
        });
      });
      markApplied(messageId);
      showToast(`Tabungan "${data.name}" dibuat`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat tabungan', 'error');
    }
  }

  async function applyWallet(messageId: string, data: { name: string; emoji: string; initialBalance: number }) {
    try {
      await upsertRecord('wallets', { name: data.name, emoji: data.emoji, initial_balance: data.initialBalance });
      markApplied(messageId);
      showToast(`Dompet "${data.name}" dibuat`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal membuat dompet', 'error');
    }
  }

  async function applyTransaction(
    messageId: string,
    data: { type: 'income' | 'expense'; amount: number; description: string; categoryId: string; date: string; walletId: string }
  ) {
    try {
      await upsertRecord('transactions', {
        type: data.type,
        amount: data.amount,
        description: data.description,
        cat_id: data.categoryId,
        date: data.date,
        wallet_id: data.walletId,
        note: 'Dibuat dari Asisten AI',
        photo: null
      });
      markApplied(messageId);
      showToast('Transaksi dicatat');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mencatat transaksi', 'error');
    }
  }

  /** Mirrors DebtSheet.svelte's create-new-debt flow exactly (2 tables, atomic). */
  async function applyDebt(
    messageId: string,
    data: { dtype: 'borrowed' | 'lent'; name: string; amount: number; dueDate: string; walletId: string }
  ) {
    try {
      await atomic(['debts', 'transactions'], async () => {
        const debt = await upsertRecord('debts', {
          name: data.name,
          amount: data.amount,
          due_date: data.dueDate,
          note: '',
          dtype: data.dtype,
          wallet_id: data.walletId,
          paid: false,
          paid_date: null,
          paid_amount: 0
        });
        const direction = data.dtype === 'borrowed' ? 'in' : 'out';
        await upsertRecord('transactions', {
          type: 'debt_transfer',
          direction,
          amount: data.amount,
          description: data.dtype === 'borrowed' ? `Hutang dari ${data.name}` : `Pinjaman ke ${data.name}`,
          date: todayStr(),
          wallet_id: data.walletId,
          cat_id: 'debt_transfer',
          note: '[Otomatis] Dibuat dari Asisten AI',
          photo: null,
          debt_ref: debt.id
        });
      });
      markApplied(messageId);
      showToast(data.dtype === 'borrowed' ? 'Hutang dicatat' : 'Piutang dicatat');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mencatat hutang', 'error');
    }
  }

  /** Mirrors PaymentSheet.svelte's payment flow exactly (3 tables, atomic). */
  async function applyDebtPayment(messageId: string, debt: ActiveDebtInfo, data: { amount: number; walletId: string }) {
    const fullDebt = $debts.find((d) => d.id === debt.id);
    if (!fullDebt) {
      showToast('Hutang ini sudah tidak ditemukan', 'error');
      return;
    }
    try {
      const total = fullDebt.amount as number;
      const paidSoFar = (fullDebt.paid_amount as number) || 0;
      const isLent = debt.dtype === 'lent';

      await atomic(['debt_payments', 'debts', 'transactions'], async () => {
        await upsertRecord('debt_payments', {
          debt_id: debt.id,
          amount: data.amount,
          date: todayStr(),
          note: 'Dibuat dari Asisten AI',
          wallet_id: data.walletId
        });

        const newPaidAmount = paidSoFar + data.amount;
        const nowFullyPaid = newPaidAmount >= total;
        await upsertRecord('debts', {
          id: debt.id,
          paid_amount: newPaidAmount,
          paid: nowFullyPaid,
          paid_date: nowFullyPaid ? todayStr() : ((fullDebt.paid_date as string) ?? null)
        });

        const direction = isLent ? 'in' : 'out';
        await upsertRecord('transactions', {
          type: 'debt_transfer',
          direction,
          amount: data.amount,
          description: isLent ? `Terima kembali dari ${debt.name}` : `Bayar hutang ke ${debt.name}`,
          date: todayStr(),
          wallet_id: data.walletId,
          cat_id: 'debt_transfer',
          note: '[Cicilan] Dibuat dari Asisten AI',
          photo: null,
          debt_ref: debt.id
        });
      });
      markApplied(messageId);
      showToast('Pembayaran dicatat');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mencatat pembayaran', 'error');
    }
  }

  async function applyRememberFact(messageId: string, content: string) {
    try {
      await upsertRecord('assistant_memory', { content });
      markApplied(messageId);
      showToast('Diinget!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menyimpan memori', 'error');
    }
  }

  function dismissAction(messageId: string) {
    messages = messages.filter((m) => m.id !== messageId);
    void deleteHistoryMessage(messageId);
  }

  // Whether `m` is the LAST message rendered from its batch — the
  // "Terapkan Semua" button renders once, right after that one, rather
  // than after every card in the group.
  function isLastOfBatch(m: ChatMessage): boolean {
    if (m.batchId == null) return false;
    const batchMsgs = messages.filter((x) => x.batchId === m.batchId);
    return batchMsgs[batchMsgs.length - 1]?.id === m.id;
  }

  function batchUnappliedCount(batchId: string): number {
    return messages.filter((x) => x.batchId === batchId && x.action && !x.action.applied).length;
  }

  /**
   * Applies every not-yet-applied card in a batch using the AI's
   * ORIGINAL proposed values — deliberately not whatever a person may
   * have half-edited into an individual card's inputs, since this
   * button is the "I trust all of these as-is, just do it" shortcut.
   * Anyone who wants to tweak one specific item first can still just
   * edit that one card and apply it individually instead of using this
   * button — both paths stay available side by side.
   */
  async function applyBatch(batchId: string) {
    const batchMsgs = messages.filter((m) => m.batchId === batchId && m.action && !m.action.applied);
    for (const m of batchMsgs) {
      if (!m.action) continue;
      const a = m.action;
      switch (a.kind) {
        case 'propose_budget':
          await applyBudget(m.id, a.args.allocations);
          break;
        case 'propose_saving': {
          const walletId = a.args.wallet_id ?? $wallets[0]?.id;
          if (!walletId) {
            showToast(`Tidak ada dompet untuk tabungan "${a.args.name}"`, 'error');
            continue;
          }
          await applySaving(m.id, { name: a.args.name, amount: a.args.amount, walletId });
          break;
        }
        case 'propose_wallet':
          await applyWallet(m.id, { name: a.args.name, emoji: WALLET_EMOJIS[0], initialBalance: a.args.initial_balance });
          break;
        case 'propose_transaction':
          await applyTransaction(m.id, {
            type: a.args.type,
            amount: a.args.amount,
            description: a.args.description,
            categoryId: a.args.category_id,
            date: a.args.date,
            walletId: a.args.wallet_id
          });
          break;
        case 'propose_debt':
          await applyDebt(m.id, {
            dtype: a.args.dtype,
            name: a.args.name,
            amount: a.args.amount,
            dueDate: a.args.due_date ?? todayStr(),
            walletId: a.args.wallet_id
          });
          break;
        case 'propose_debt_payment': {
          const matchedDebt = activeDebts.find((d) => d.id === a.args.debt_id);
          if (!matchedDebt) {
            showToast('Salah satu hutang di batch ini sudah tidak ditemukan', 'error');
            continue;
          }
          await applyDebtPayment(m.id, matchedDebt, { amount: a.args.amount, walletId: a.args.wallet_id });
          break;
        }
        case 'remember_fact':
          await applyRememberFact(m.id, a.args.content);
          break;
      }
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="flex flex-col h-[calc(100vh-3.5rem-6rem)] max-w-md mx-auto">
  <div bind:this={scrollContainer} class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
    {#if !assistantConfigured}
      <div class="flex-1 flex flex-col items-center justify-center text-center gap-2 py-10">
        <p class="text-sm font-semibold text-txt-primary">Asisten AI belum dikonfigurasi</p>
        <p class="text-xs text-txt-secondary max-w-[260px]">
          Set <code class="text-[10px]">PUBLIC_AI_WORKER_URL</code> di <code class="text-[10px]">.env</code> supaya fitur
          ini aktif.
        </p>
      </div>
    {:else if !historyLoaded}
      <div class="flex-1"></div>
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
          Tanya soal keuanganmu, minta dibuatkan budget/tabungan, catat transaksi/hutang, atau bayar hutang — cukup
          ketik kayak ngobrol biasa.
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
          {#if m.action?.kind === 'propose_budget'}
            <BudgetProposalCard
              args={m.action.args}
              categories={$customCategories.filter((c) => c.type === 'expense') as unknown as Cat[]}
              availableIncome={lastKnownIncome}
              applied={m.action.applied}
              onApply={(allocations) => applyBudget(m.id, allocations)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'propose_saving'}
            <SavingProposalCard
              args={m.action.args}
              wallets={$wallets}
              {walletBalances}
              applied={m.action.applied}
              onApply={(data) => applySaving(m.id, data)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'propose_wallet'}
            <WalletProposalCard
              args={m.action.args}
              applied={m.action.applied}
              onApply={(data) => applyWallet(m.id, data)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'propose_transaction'}
            <TransactionProposalCard
              args={m.action.args}
              expenseCategories={expenseCatsList}
              incomeCategories={incomeCatsList}
              wallets={$wallets}
              {walletBalances}
              existingBudget={existingBudgetThisMonth}
              spentThisMonth={spentByCategory}
              applied={m.action.applied}
              onApply={(data) => applyTransaction(m.id, data)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'propose_debt'}
            <DebtProposalCard
              args={m.action.args}
              wallets={$wallets}
              {walletBalances}
              applied={m.action.applied}
              onApply={(data) => applyDebt(m.id, data)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'propose_debt_payment'}
            {@const matchedDebt = activeDebts.find((d) => d.id === m.action?.args.debt_id)}
            <DebtPaymentProposalCard
              args={m.action.args}
              debts={activeDebts}
              wallets={$wallets}
              {walletBalances}
              applied={m.action.applied}
              onApply={(data) => matchedDebt && applyDebtPayment(m.id, matchedDebt, data)}
              onDismiss={() => dismissAction(m.id)}
            />
          {:else if m.action?.kind === 'remember_fact'}
            <RememberFactCard
              args={m.action.args}
              applied={m.action.applied}
              onApply={() => applyRememberFact(m.id, m.action.args.content)}
              onDismiss={() => dismissAction(m.id)}
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
        {#if isLastOfBatch(m) && m.batchId != null && batchUnappliedCount(m.batchId) > 1}
          <div class="flex justify-start">
            <button
              on:click={() => applyBatch(m.batchId ?? '')}
              class="text-xs font-medium py-2 px-4 rounded-lg text-white"
              style="background: var(--primary)"
            >
              ✅ Terapkan Semua ({batchUnappliedCount(m.batchId)})
            </button>
          </div>
        {/if}
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
      bind:this={textareaEl}
      bind:value={draft}
      on:input={autoResizeTextarea}
      on:keydown={onKeydown}
      rows="1"
      placeholder="Tanya sesuatu…"
      disabled={!assistantConfigured || sending}
      class="flex-1 resize-none rounded-lg bg-base-input border border-border px-3.5 py-2.5 text-sm text-txt-primary max-h-24 overflow-y-auto disabled:opacity-60"
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
