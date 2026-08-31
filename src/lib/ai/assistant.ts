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

export type AssistantAction =
  | { action: 'propose_budget'; args: ProposeBudgetArgs }
  | { action: 'propose_saving'; args: ProposeSavingArgs };

export type AssistantResponse = { type: 'text'; text: string } | { type: 'actions'; actions: AssistantAction[] };

export interface CategorySpend {
  cat_id: string;
  amount: number;
}

export interface SpendingSummary {
  total: number;
  by_category: CategorySpend[];
}

export interface AssistantContext {
  current_month: string;
  categories: Array<{ id: string; name: string }>;
  wallets: Array<{ id: string; name: string }>;
  salary_transaction: { amount: number; date: string; wallet_id: string | null } | null;
  avg_spending_last_3mo: Record<string, number>;
  existing_budget_this_month: Record<string, number>;
  spending_this_month: SpendingSummary;
  spending_last_month: SpendingSummary;
}

export function isAssistantConfigured(): boolean {
  return Boolean(PUBLIC_AI_WORKER_URL);
}

/**
 * Sends the latest message + prior turns (session-only, never persisted
 * — see the "Fase B/C" design discussion) plus locally-computed context
 * (never raw transactions — see analytics.ts's
 * getAverageSpendingByCategory/findSalaryTransaction/getExistingBudget)
 * to the Worker's /assistant endpoint.
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
