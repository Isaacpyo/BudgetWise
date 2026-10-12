import type { Rule, Transaction } from '../src';

let seq = 0;

export function tx(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  const date = overrides.date ?? '2026-10-05';
  return {
    id: `tx_${seq}`,
    itemId: 'item_1',
    accountId: 'acc_1',
    name: 'Something',
    merchantName: null,
    amountCents: 1000,
    currency: 'USD',
    date,
    month: date.slice(0, 7),
    pending: false,
    plaidCategory: null,
    category: 'other',
    categorySource: 'default',
    ruleId: null,
    logoUrl: null,
    updatedAt: '2026-10-05T00:00:00.000Z',
    ...overrides,
  };
}

export function rule(overrides: Partial<Rule> = {}): Rule {
  seq += 1;
  return {
    id: `rule_${seq}`,
    field: 'merchant',
    operator: 'contains',
    pattern: 'coffee',
    category: 'dining',
    minAmountCents: null,
    maxAmountCents: null,
    priority: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
