import { PUBLIC_AI_WORKER_URL } from '$env/static/public';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ProposeBudgetArgs {
  month: string;
  reasoning: string;
  allocations: Array<{ category_id: string; amount: number }>;
}

export interface ProposeSavingArgs {
  name: string;
  amount: number;
  reasoning: string;
  wallet_id: string | null;
}

export interface ProposeWalletArgs {
  name: string;
  initial_balance: number;
  reasoning: string;
}

export interface ProposeTransactionArgs {
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: string;
  date: string;
  wallet_id: string;
}

export interface ProposeDebtArgs {
  dtype: 'borrowed' | 'lent';
  name: string;
  amount: number;
  due_date: string | null;
  wallet_id: string;
  reasoning: string;
}

export interface ProposeDebtPaymentArgs {
  debt_id: string;
  amount: number;
  wallet_id: string;
  reasoning: string;
}

export interface RememberFactArgs {
  content: string;
}

export type AssistantAction =
  | { action: 'propose_budget'; args: ProposeBudgetArgs }
  | { action: 'propose_saving'; args: ProposeSavingArgs }
  | { action: 'propose_wallet'; args: ProposeWalletArgs }
  | { action: 'propose_transaction'; args: ProposeTransactionArgs }
  | { action: 'propose_debt'; args: ProposeDebtArgs }
  | { action: 'propose_debt_payment'; args: ProposeDebtPaymentArgs }
  | { action: 'remember_fact'; args: RememberFactArgs };

export type AssistantResponse = { type: 'text'; text: string } | { type: 'actions'; actions: AssistantAction[] };

export interface AssistantContext {
  today: string; // YYYY-MM-DD
  current_month: string;
  expense_categories: Array<{ id: string; name: string }>;
  income_categories: Array<{ id: string; name: string }>;
  wallets: Array<{ id: string; name: string }>;
  debts: Array<{ id: string; name: string; dtype: 'borrowed' | 'lent'; remaining: number }>;
  memory: string[];
  salary_transaction: { amount: number; date: string; wallet_id: string | null } | null;
  avg_spending_last_3mo: Record<string, number>;
  existing_budget_this_month: Record<string, number>;
  spending_this_month: { total: number; by_category: Array<{ cat_id: string; amount: number }> };
  spending_last_month: { total: number; by_category: Array<{ cat_id: string; amount: number }> };
}

export function isAssistantConfigured(): boolean {
  return Boolean(PUBLIC_AI_WORKER_URL);
}

/**
 * Sends the latest message + prior turns (session-only, never persisted
 * — see the "Fase B/C" design discussion) plus locally-computed context
 * (never raw transactions — see analytics.ts's context-building
 * functions) to the Worker's /assistant endpoint.
 */
export async function askAssistant(
  message: string,
  history: ChatTurn[],
  context: AssistantContext,
  accessToken: string
): Promise<AssistantResponse> {
  if (!PUBLIC_AI_WORKER_URL) {
    throw new Error('Asisten AI belum dikonfigurasi (PUBLIC_AI_WORKER_URL kosong)');
  }

  const res = await fetch(`${PUBLIC_AI_WORKER_URL}/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ message, history, ...context })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Asisten gagal merespons (${res.status})`);
  }

  return res.json();
}
