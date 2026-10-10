import type { CategoryId } from './categories';

/** Where a transaction's category came from, in precedence order. */
export type CategorySource = 'manual' | 'rule' | 'plaid' | 'keyword' | 'default';

export interface PlaidCategory {
  /** e.g. FOOD_AND_DRINK */
  primary: string;
  /** e.g. FOOD_AND_DRINK_GROCERIES */
  detailed: string;
}

/**
 * A transaction as stored in Firestore at users/{uid}/transactions/{id}.
 *
 * `amountCents` follows Plaid's sign convention: positive = money leaving the
 * account (a purchase), negative = money coming in (salary, refund).
 */
export interface Transaction {
  id: string;
  itemId: string;
  accountId: string;
  /** Raw description from the bank. */
  name: string;
  /** Cleaned merchant name, when the provider knows it. */
  merchantName: string | null;
  amountCents: number;
  currency: string;
  /** Posting date, YYYY-MM-DD. */
  date: string;
  /** YYYY-MM, denormalised for month queries. */
  month: string;
  pending: boolean;
  plaidCategory: PlaidCategory | null;
  category: CategoryId;
  categorySource: CategorySource;
  ruleId: string | null;
  logoUrl: string | null;
  updatedAt: string;
}

export type RuleField = 'merchant' | 'description';
export type RuleOperator = 'contains' | 'equals' | 'startsWith';

/** A user-defined categorisation rule at users/{uid}/rules/{id}. */
export interface Rule {
  id: string;
  /** `merchant` matches the merchant name (falling back to the description). */
  field: RuleField;
  operator: RuleOperator;
  pattern: string;
  category: CategoryId;
  /** Optional inclusive bounds on the absolute amount, in cents. */
  minAmountCents: number | null;
  maxAmountCents: number | null;
  /** Lower runs first; the first matching rule wins. */
  priority: number;
  createdAt: string;
}

/** A recurring monthly limit at users/{uid}/budgets/{category}. */
export interface Budget {
  category: CategoryId;
  limitCents: number;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
}

export type ItemProvider = 'plaid' | 'mock';
export type ItemStatus = 'ok' | 'syncing' | 'error';

/** A linked bank at users/{uid}/items/{id}. Never contains secrets. */
export interface Item {
  id: string;
  provider: ItemProvider;
  institutionId: string | null;
  institutionName: string;
  accounts: Account[];
  status: ItemStatus;
  error: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  isDemo: boolean;
  createdAt: string;
  lastSyncedAt: string | null;
  seededAt?: string | null;
}
