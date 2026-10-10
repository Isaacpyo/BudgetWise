import { describe, expect, it } from 'vitest';
import {
  categoryBreakdown,
  computeBudgetProgress,
  cumulativeDailySpend,
  monthlyTotals,
  monthSummary,
  spendingPace,
  suggestBudget,
  summarizeBudgets,
  type Budget,
} from '../src';
import { tx } from './fixtures';

const budget = (category: Budget['category'], limitCents: number): Budget => ({
  category,
  limitCents,
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const october = [
  tx({ date: '2026-10-02', category: 'groceries', amountCents: 12_000 }),
  tx({ date: '2026-10-09', category: 'groceries', amountCents: 9_000 }),
  tx({ date: '2026-10-10', category: 'groceries', amountCents: -1_000 }), // refund
  tx({ date: '2026-10-03', category: 'dining', amountCents: 4_500 }),
  tx({ date: '2026-10-01', category: 'income', amountCents: -300_000 }),
  tx({ date: '2026-10-04', category: 'transfer', amountCents: 50_000 }),
  tx({ date: '2026-09-15', category: 'groceries', amountCents: 30_000 }),
  tx({ date: '2026-09-20', category: 'dining', amountCents: 10_000 }),
];

describe('computeBudgetProgress', () => {
  it('nets refunds, ignores other months and sorts worst first', () => {
    const progress = computeBudgetProgress(
      october,
      [budget('dining', 5_000), budget('groceries', 25_000), budget('travel', 20_000)],
      '2026-10',
    );
    expect(progress.map((p) => [p.category, p.spentCents, p.status])).toEqual([
      ['dining', 4_500, 'warning'],
      ['groceries', 20_000, 'warning'],
      ['travel', 0, 'ok'],
    ]);
    expect(progress[1]?.remainingCents).toBe(5_000);
    expect(progress[0]?.paceRatio).toBeNull();
  });

  it('flags over-budget categories and computes pace for the current month', () => {
    const [p] = computeBudgetProgress(october, [budget('groceries', 15_000)], '2026-10', '2026-10-10');
    expect(p?.status).toBe('over');
    expect(p?.ratio).toBeCloseTo(20_000 / 15_000);
    expect(p?.paceRatio).toBeCloseTo(10 / 31);
  });

  it('never reports negative spend when refunds exceed purchases', () => {
    const [p] = computeBudgetProgress(
      [tx({ date: '2026-10-01', category: 'shopping', amountCents: -5_000 })],
      [budget('shopping', 10_000)],
      '2026-10',
    );
    expect(p?.spentCents).toBe(0);
    expect(p?.ratio).toBe(0);
  });

  it('summarises totals', () => {
    const progress = computeBudgetProgress(october, [budget('dining', 4_000), budget('groceries', 25_000)], '2026-10');
    expect(summarizeBudgets(progress)).toEqual({
      limitCents: 29_000,
      spentCents: 24_500,
      ratio: 24_500 / 29_000,
      overCount: 1,
    });
  });
});

describe('insights', () => {
  it('computes month totals excluding transfers', () => {
    expect(monthlyTotals(october, ['2026-09', '2026-10'])).toEqual([
      { month: '2026-09', spendingCents: 40_000, incomeCents: 0 },
      { month: '2026-10', spendingCents: 24_500, incomeCents: 300_000 },
    ]);
  });

  it('summarises a month against the previous one', () => {
    const s = monthSummary(october, '2026-10');
    expect(s.netCents).toBe(300_000 - 24_500);
    expect(s.spendingChange).toBeCloseTo((24_500 - 40_000) / 40_000);
    expect(s.topCategory).toBe('groceries');
    expect(s.transactionCount).toBe(6);
    expect(monthSummary(october, '2026-09').spendingChange).toBeNull();
  });

  it('breaks spending down by category with shares', () => {
    const b = categoryBreakdown(october, '2026-10');
    expect(b.map((s) => s.category)).toEqual(['groceries', 'dining']);
    expect(b[0]?.share).toBeCloseTo(20_000 / 24_500);
  });

  it('builds cumulative daily spend', () => {
    const daily = cumulativeDailySpend(october, '2026-10');
    expect(daily).toHaveLength(31);
    expect(daily[0]).toBe(0);
    expect(daily[1]).toBe(12_000);
    expect(daily[2]).toBe(16_500);
    expect(daily[30]).toBe(24_500);
  });

  it('builds the pace series and stops the current month at today', () => {
    const pace = spendingPace(october, '2026-10', '2026-10-05');
    expect(pace).toHaveLength(31);
    expect(pace[4]).toEqual({ day: 5, current: 165, previous: 0 });
    expect(pace[5]?.current).toBeNull();
    expect(pace[29]?.previous).toBe(400);
    expect(pace[30]?.previous).toBeNull(); // September has 30 days
  });
});

describe('suggestBudget', () => {
  it('rounds the average up to the next $10', () => {
    expect(suggestBudget(october, 'groceries', ['2026-09', '2026-10'])).toBe(25_000);
    expect(suggestBudget(october, 'travel', ['2026-09'])).toBeNull();
    expect(suggestBudget(october, 'groceries', [])).toBeNull();
  });
});
