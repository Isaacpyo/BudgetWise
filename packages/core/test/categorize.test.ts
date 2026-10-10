import { describe, expect, it } from 'vitest';
import {
  categorize,
  countRuleMatches,
  mapPlaidCategory,
  matchKeyword,
  recategorize,
  ruleDraftFromTransaction,
  ruleMatches,
  sortRules,
} from '../src';
import { rule, tx } from './fixtures';

describe('ruleMatches', () => {
  it('matches merchant name case- and whitespace-insensitively', () => {
    const r = rule({ pattern: '  Blue  Bottle ' });
    expect(ruleMatches(r, tx({ merchantName: 'BLUE BOTTLE COFFEE' }))).toBe(true);
    expect(ruleMatches(r, tx({ merchantName: 'Starbucks' }))).toBe(false);
  });

  it('falls back to the description when there is no merchant name', () => {
    const r = rule({ pattern: 'gym' });
    expect(ruleMatches(r, tx({ merchantName: null, name: 'CITY GYM 0042' }))).toBe(true);
  });

  it('description rules ignore the merchant name', () => {
    const r = rule({ field: 'description', pattern: 'venmo' });
    expect(ruleMatches(r, tx({ merchantName: 'Venmo', name: 'PAYMENT 123' }))).toBe(false);
    expect(ruleMatches(r, tx({ merchantName: null, name: 'VENMO PAYMENT 123' }))).toBe(true);
  });

  it('supports equals and startsWith', () => {
    expect(ruleMatches(rule({ operator: 'equals', pattern: 'uber' }), tx({ merchantName: 'Uber' }))).toBe(true);
    expect(ruleMatches(rule({ operator: 'equals', pattern: 'uber' }), tx({ merchantName: 'Uber Eats' }))).toBe(false);
    expect(ruleMatches(rule({ operator: 'startsWith', pattern: 'uber' }), tx({ merchantName: 'Uber Eats' }))).toBe(true);
    expect(ruleMatches(rule({ operator: 'startsWith', pattern: 'eats' }), tx({ merchantName: 'Uber Eats' }))).toBe(false);
  });

  it('applies inclusive amount bounds to the absolute amount', () => {
    const r = rule({ pattern: 'amazon', minAmountCents: 10_000, maxAmountCents: 50_000 });
    expect(ruleMatches(r, tx({ merchantName: 'Amazon', amountCents: 9_999 }))).toBe(false);
    expect(ruleMatches(r, tx({ merchantName: 'Amazon', amountCents: 10_000 }))).toBe(true);
    expect(ruleMatches(r, tx({ merchantName: 'Amazon', amountCents: -50_000 }))).toBe(true);
    expect(ruleMatches(r, tx({ merchantName: 'Amazon', amountCents: 50_001 }))).toBe(false);
  });

  it('never matches an empty pattern', () => {
    expect(ruleMatches(rule({ pattern: '   ' }), tx({ merchantName: 'Anything' }))).toBe(false);
  });
});

describe('sortRules', () => {
  it('orders by priority, then creation time, then id', () => {
    const a = rule({ id: 'b', priority: 1, createdAt: '2026-01-01' });
    const b = rule({ id: 'a', priority: 1, createdAt: '2026-01-01' });
    const c = rule({ id: 'c', priority: 0, createdAt: '2026-06-01' });
    const d = rule({ id: 'd', priority: 1, createdAt: '2025-01-01' });
    expect(sortRules([a, b, c, d]).map((r) => r.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('mapPlaidCategory', () => {
  it('prefers detailed mappings over primary ones', () => {
    expect(mapPlaidCategory({ primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' })).toBe('groceries');
    expect(mapPlaidCategory({ primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' })).toBe('dining');
    expect(mapPlaidCategory({ primary: 'RENT_AND_UTILITIES', detailed: 'RENT_AND_UTILITIES_RENT' })).toBe('housing');
    expect(mapPlaidCategory({ primary: 'LOAN_PAYMENTS', detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' })).toBe('transfer');
  });

  it('returns null for unknown or missing categories', () => {
    expect(mapPlaidCategory(null)).toBeNull();
    expect(mapPlaidCategory({ primary: 'SOMETHING_NEW', detailed: 'SOMETHING_NEW_X' })).toBeNull();
  });
});

describe('matchKeyword', () => {
  it('matches specific phrases before general ones', () => {
    expect(matchKeyword(tx({ merchantName: 'Uber Eats' }))).toBe('dining');
    expect(matchKeyword(tx({ merchantName: 'Uber', name: 'UBER *TRIP' }))).toBe('transport');
  });

  it('respects word boundaries', () => {
    expect(matchKeyword(tx({ name: 'RENT PAYMENT OCT' }))).toBe('housing');
    expect(matchKeyword(tx({ name: 'CURRENT ACCOUNT INTEREST' }))).toBeNull();
  });
});

describe('categorize', () => {
  it('uses precedence rule > keyword > plaid > default', () => {
    const plaid = { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_OTHER' };
    const coffee = tx({ merchantName: 'Starbucks', plaidCategory: plaid });

    expect(categorize(coffee, [rule({ id: 'r1', pattern: 'starbucks', category: 'entertainment' })])).toEqual({
      category: 'entertainment',
      source: 'rule',
      ruleId: 'r1',
    });
    expect(categorize(coffee, [])).toEqual({ category: 'dining', source: 'keyword', ruleId: null });
    expect(categorize(tx({ merchantName: 'Local Shop', plaidCategory: plaid }), [])).toEqual({
      category: 'shopping',
      source: 'plaid',
      ruleId: null,
    });
    expect(categorize(tx({ merchantName: 'Mystery' }), [])).toEqual({
      category: 'other',
      source: 'default',
      ruleId: null,
    });
  });

  it('first matching rule wins in sorted order', () => {
    const rules = sortRules([
      rule({ id: 'late', pattern: 'amazon', category: 'shopping', priority: 5 }),
      rule({ id: 'early', pattern: 'amazon', category: 'groceries', priority: 1 }),
    ]);
    expect(categorize(tx({ merchantName: 'Amazon Fresh' }), rules).ruleId).toBe('early');
  });
});

describe('recategorize', () => {
  it('returns only changed, non-manual transactions', () => {
    const manual = tx({ merchantName: 'Blue Bottle', category: 'groceries', categorySource: 'manual' });
    const auto = tx({ merchantName: 'Blue Bottle', category: 'other', categorySource: 'default' });
    const unchanged = tx({ merchantName: 'Starbucks', category: 'dining', categorySource: 'keyword' });
    const r = rule({ id: 'bb', pattern: 'blue bottle', category: 'dining' });

    const changes = recategorize([manual, auto, unchanged], [r]);
    expect(changes).toEqual([{ id: auto.id, category: 'dining', source: 'rule', ruleId: 'bb' }]);
  });

  it('reverts rule-assigned transactions when their rule is deleted', () => {
    const t = tx({ merchantName: 'Starbucks', category: 'entertainment', categorySource: 'rule', ruleId: 'gone' });
    expect(recategorize([t], [])).toEqual([{ id: t.id, category: 'dining', source: 'keyword', ruleId: null }]);
  });
});

describe('rule drafts', () => {
  it('uses the merchant name when available', () => {
    expect(ruleDraftFromTransaction(tx({ merchantName: 'Blue Bottle', name: 'BLUE BOTTLE #22' }), 'dining').pattern).toBe(
      'Blue Bottle',
    );
  });

  it('strips trailing reference numbers from descriptions', () => {
    expect(ruleDraftFromTransaction(tx({ merchantName: null, name: 'CITY PARKING #4421 0099' }), 'transport').pattern).toBe(
      'CITY PARKING',
    );
  });

  it('counts matches for previews', () => {
    const txs = [tx({ merchantName: 'Lyft' }), tx({ merchantName: 'Lyft' }), tx({ merchantName: 'Uber' })];
    expect(countRuleMatches(rule({ pattern: 'lyft' }), txs)).toBe(2);
  });
});
