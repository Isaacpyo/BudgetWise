import { isExpenseCategory, type CategoryId } from './categories';
import { dayOfMonth, daysInMonth } from './dates';
import type { Budget, Transaction } from './types';

export type BudgetStatus = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  category: CategoryId;
  limitCents: number;
  /** Net spend this month (purchases minus refunds), never below zero. */
  spentCents: number;
  remainingCents: number;
  /** spent / limit, uncapped (1.25 = 25% over). */
  ratio: number;
  status: BudgetStatus;
  /**
   * For the current month: the share of the limit you'd have used by today on
   * an even pace (0–1). Null for past months. The UI draws it as a tick.
   */
  paceRatio: number | null;
}

/** Status flips to "warning" at this share of the limit. */
export const BUDGET_WARNING_RATIO = 0.8;

/** Net spend per expense category for one month. */
export function spendByCategory(
  transactions: readonly Transaction[],
  month: string,
): Map<CategoryId, number> {
  const totals = new Map<CategoryId, number>();
  for (const tx of transactions) {
    if (tx.month !== month || !isExpenseCategory(tx.category)) continue;
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amountCents);
  }
  return totals;
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'over';
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

/**
 * Progress for every budget in `month`, worst first (highest ratio).
 * `today` (YYYY-MM-DD) enables the pace marker when it falls inside `month`.
 */
export function computeBudgetProgress(
  transactions: readonly Transaction[],
  budgets: readonly Budget[],
  month: string,
  today?: string,
): BudgetProgress[] {
  const spend = spendByCategory(transactions, month);
  const isCurrentMonth = today?.slice(0, 7) === month;
  const pace = isCurrentMonth && today ? dayOfMonth(today) / daysInMonth(month) : null;

  return budgets
    .filter((b) => b.limitCents > 0)
    .map((b) => {
      const spentCents = Math.max(0, spend.get(b.category) ?? 0);
      const ratio = spentCents / b.limitCents;
      return {
        category: b.category,
        limitCents: b.limitCents,
        spentCents,
        remainingCents: b.limitCents - spentCents,
        ratio,
        status: budgetStatus(ratio),
        paceRatio: pace,
      };
    })
    .sort((a, b) => b.ratio - a.ratio || a.category.localeCompare(b.category));
}

export interface BudgetTotals {
  limitCents: number;
  spentCents: number;
  ratio: number;
  overCount: number;
}

export function summarizeBudgets(progress: readonly BudgetProgress[]): BudgetTotals {
  const limitCents = progress.reduce((s, p) => s + p.limitCents, 0);
  const spentCents = progress.reduce((s, p) => s + p.spentCents, 0);
  return {
    limitCents,
    spentCents,
    ratio: limitCents > 0 ? spentCents / limitCents : 0,
    overCount: progress.filter((p) => p.status === 'over').length,
  };
}

/**
 * Suggest a monthly limit from history: the average of the last months' net
 * spend, rounded up to the next $10. Returns null with no history.
 */
export function suggestBudget(
  transactions: readonly Transaction[],
  category: CategoryId,
  months: readonly string[],
): number | null {
  if (months.length === 0) return null;
  const totals = months.map((m) =>
    Math.max(0, spendByCategory(transactions, m).get(category) ?? 0),
  );
  const avg = totals.reduce((s, v) => s + v, 0) / months.length;
  if (avg <= 0) return null;
  return Math.ceil(avg / 1000) * 1000;
}
