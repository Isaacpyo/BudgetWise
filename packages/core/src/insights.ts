import { CATEGORIES, isExpenseCategory, type CategoryId } from './categories';
import { addMonths, dayOfMonth, daysInMonth } from './dates';
import { spendByCategory } from './budgets';
import type { Transaction } from './types';

export interface MonthTotals {
  month: string;
  /** Net spend on expense categories (refunds reduce it), floored at 0. */
  spendingCents: number;
  /** Money in on income categories. */
  incomeCents: number;
}

function totalsFor(transactions: readonly Transaction[], month: string): MonthTotals {
  let spending = 0;
  let income = 0;
  for (const tx of transactions) {
    if (tx.month !== month) continue;
    const kind = CATEGORIES[tx.category].kind;
    if (kind === 'expense') spending += tx.amountCents;
    else if (kind === 'income') income -= tx.amountCents;
  }
  return { month, spendingCents: Math.max(0, spending), incomeCents: Math.max(0, income) };
}

/** One row per month, in the order given (for the monthly column chart). */
export function monthlyTotals(
  transactions: readonly Transaction[],
  months: readonly string[],
): MonthTotals[] {
  return months.map((m) => totalsFor(transactions, m));
}

export interface MonthSummary extends MonthTotals {
  netCents: number;
  transactionCount: number;
  previousSpendingCents: number;
  /** (this − previous) / previous; null when last month had no spend. */
  spendingChange: number | null;
  topCategory: CategoryId | null;
}

export function monthSummary(transactions: readonly Transaction[], month: string): MonthSummary {
  const current = totalsFor(transactions, month);
  const previous = totalsFor(transactions, addMonths(month, -1));
  const breakdown = categoryBreakdown(transactions, month);
  return {
    ...current,
    netCents: current.incomeCents - current.spendingCents,
    transactionCount: transactions.filter((t) => t.month === month).length,
    previousSpendingCents: previous.spendingCents,
    spendingChange:
      previous.spendingCents > 0
        ? (current.spendingCents - previous.spendingCents) / previous.spendingCents
        : null,
    topCategory: breakdown[0]?.category ?? null,
  };
}

export interface CategorySlice {
  category: CategoryId;
  cents: number;
  /** Share of the month's total spend, 0–1. */
  share: number;
}

/** Expense categories with positive net spend, largest first. */
export function categoryBreakdown(
  transactions: readonly Transaction[],
  month: string,
): CategorySlice[] {
  const totals = [...spendByCategory(transactions, month)].filter(([, cents]) => cents > 0);
  const sum = totals.reduce((s, [, cents]) => s + cents, 0);
  return totals
    .map(([category, cents]) => ({ category, cents, share: sum > 0 ? cents / sum : 0 }))
    .sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
}

/** Running total of expense spend for each day of the month (index 0 = day 1). */
export function cumulativeDailySpend(transactions: readonly Transaction[], month: string): number[] {
  const perDay = new Array<number>(daysInMonth(month)).fill(0);
  for (const tx of transactions) {
    if (tx.month !== month || !isExpenseCategory(tx.category)) continue;
    const i = dayOfMonth(tx.date) - 1;
    perDay[i] = (perDay[i] ?? 0) + tx.amountCents;
  }
  let running = 0;
  return perDay.map((v) => (running += v));
}

export interface PacePoint {
  day: number;
  /** Cumulative spend in dollars for the selected month; null after today. */
  current: number | null;
  /** Cumulative spend in dollars for the month before. */
  previous: number | null;
}

/**
 * Series for the "spending pace" line chart: this month vs last month, by day.
 * Values are dollars (charts read better without a cents scale).
 */
export function spendingPace(
  transactions: readonly Transaction[],
  month: string,
  today?: string,
): PacePoint[] {
  const current = cumulativeDailySpend(transactions, month);
  const previous = cumulativeDailySpend(transactions, addMonths(month, -1));
  const lastDay = today?.slice(0, 7) === month && today ? dayOfMonth(today) : current.length;
  const length = Math.max(current.length, previous.length);
  return Array.from({ length }, (_, i) => ({
    day: i + 1,
    current: i < lastDay && i < current.length ? (current[i] ?? 0) / 100 : null,
    previous: i < previous.length ? (previous[i] ?? 0) / 100 : null,
  }));
}
