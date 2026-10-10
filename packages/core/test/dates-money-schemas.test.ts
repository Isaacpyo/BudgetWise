import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  budgetInputSchema,
  daysInMonth,
  formatDay,
  formatMoney,
  formatMonth,
  formatTransactionAmount,
  isIsoDate,
  isMonthKey,
  lastMonths,
  monthBounds,
  parseMoneyInput,
  ruleInputSchema,
  toCents,
  transactionPatchSchema,
} from '../src';

describe('dates', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-10', -14)).toBe('2025-08');
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(monthBounds('2026-04')).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('lists trailing months oldest first', () => {
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('adds days and validates formats', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
  });

  it('formats months and days', () => {
    expect(formatMonth('2026-10')).toBe('Oct 2026');
    expect(formatMonth('2026-10', { short: true })).toBe('Oct');
    expect(formatDay('2026-10-04')).toBe('4 Oct');
  });
});

describe('money', () => {
  it('converts decimals to cents without float drift', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(-4.335)).toBe(-433);
    expect(() => toCents(Number.NaN)).toThrow();
  });

  it('formats currency', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(-500)).toBe('-$5.00');
    expect(formatMoney(150000, 'USD', { compact: true })).toBe('$1.5K');
  });

  it('shows purchases as negative, income as positive', () => {
    expect(formatTransactionAmount(1250)).toBe('-$12.50');
    expect(formatTransactionAmount(-300000)).toBe('+$3,000.00');
  });

  it('parses user input', () => {
    expect(parseMoneyInput('1,250.5')).toBe(125050);
    expect(parseMoneyInput('$300')).toBe(30000);
    expect(parseMoneyInput('12.345')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('')).toBeNull();
  });
});

describe('schemas', () => {
  it('validates and normalises rule input', () => {
    const parsed = ruleInputSchema.parse({
      field: 'merchant',
      operator: 'contains',
      pattern: '  Lyft ',
      category: 'transport',
    });
    expect(parsed).toEqual({
      field: 'merchant',
      operator: 'contains',
      pattern: 'Lyft',
      category: 'transport',
      minAmountCents: null,
      maxAmountCents: null,
    });
  });

  it('rejects bad rules', () => {
    expect(
      ruleInputSchema.safeParse({
        field: 'merchant',
        operator: 'contains',
        pattern: 'x',
        category: 'transport',
      }).success,
    ).toBe(false);
    expect(
      ruleInputSchema.safeParse({
        field: 'merchant',
        operator: 'contains',
        pattern: 'lyft',
        category: 'nope',
      }).success,
    ).toBe(false);
    expect(
      ruleInputSchema.safeParse({
        field: 'merchant',
        operator: 'contains',
        pattern: 'lyft',
        category: 'transport',
        minAmountCents: 500,
        maxAmountCents: 100,
      }).success,
    ).toBe(false);
  });

  it('validates budgets and transaction patches', () => {
    expect(budgetInputSchema.safeParse({ limitCents: 50 }).success).toBe(false);
    expect(budgetInputSchema.safeParse({ limitCents: 10.5 }).success).toBe(false);
    expect(budgetInputSchema.parse({ limitCents: 40000 })).toEqual({ limitCents: 40000 });
    expect(transactionPatchSchema.parse({ category: null })).toEqual({
      category: null,
      createRule: false,
    });
  });
});
