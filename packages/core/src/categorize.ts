import type { CategoryId } from './categories';
import type { CategorySource, PlaidCategory, Rule, Transaction } from './types';

/** The fields categorisation looks at. */
export type CategorizableTransaction = Pick<
  Transaction,
  'name' | 'merchantName' | 'amountCents' | 'plaidCategory'
>;

export interface CategoryAssignment {
  category: CategoryId;
  source: Exclude<CategorySource, 'manual'>;
  ruleId: string | null;
}

/** What the rule engine needs from a rule (drafts from the UI have no id yet). */
export type RuleMatcher = Pick<
  Rule,
  'field' | 'operator' | 'pattern' | 'minAmountCents' | 'maxAmountCents'
>;

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function ruleMatches(rule: RuleMatcher, tx: CategorizableTransaction): boolean {
  const pattern = normalizeText(rule.pattern);
  if (!pattern) return false;

  const source = rule.field === 'merchant' ? (tx.merchantName ?? tx.name) : tx.name;
  const text = normalizeText(source);
  const textMatches =
    rule.operator === 'equals'
      ? text === pattern
      : rule.operator === 'startsWith'
        ? text.startsWith(pattern)
        : text.includes(pattern);
  if (!textMatches) return false;

  const abs = Math.abs(tx.amountCents);
  if (rule.minAmountCents != null && abs < rule.minAmountCents) return false;
  if (rule.maxAmountCents != null && abs > rule.maxAmountCents) return false;
  return true;
}

/** Evaluation order: priority ascending, then oldest first, then id for determinism. */
export function sortRules<T extends Pick<Rule, 'priority' | 'createdAt' | 'id'>>(
  rules: readonly T[],
): T[] {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Curated, high-precision merchant keywords. Order matters: the first match
 * wins, so specific phrases ("uber eats") come before general ones ("uber").
 */
export const KEYWORD_RULES: ReadonlyArray<readonly [keyword: string, category: CategoryId]> = [
  ['uber eats', 'dining'],
  ['doordash', 'dining'],
  ['grubhub', 'dining'],
  ['deliveroo', 'dining'],
  ['starbucks', 'dining'],
  ['mcdonald', 'dining'],
  ['chipotle', 'dining'],
  ['sweetgreen', 'dining'],
  ['netflix', 'subscriptions'],
  ['spotify', 'subscriptions'],
  ['hulu', 'subscriptions'],
  ['disney+', 'subscriptions'],
  ['apple.com/bill', 'subscriptions'],
  ['icloud', 'subscriptions'],
  ['youtube premium', 'subscriptions'],
  ['uber', 'transport'],
  ['lyft', 'transport'],
  ['shell', 'transport'],
  ['chevron', 'transport'],
  ['exxon', 'transport'],
  ['metro transit', 'transport'],
  ['whole foods', 'groceries'],
  ['trader joe', 'groceries'],
  ['safeway', 'groceries'],
  ['kroger', 'groceries'],
  ['tesco', 'groceries'],
  ['sainsbury', 'groceries'],
  ['costco', 'groceries'],
  ['amazon', 'shopping'],
  ['target', 'shopping'],
  ['walmart', 'shopping'],
  ['ikea', 'shopping'],
  ['airbnb', 'travel'],
  ['united airlines', 'travel'],
  ['delta air', 'travel'],
  ['marriott', 'travel'],
  ['comcast', 'bills'],
  ['verizon', 'bills'],
  ['at&t', 'bills'],
  ['pg&e', 'bills'],
  ['con edison', 'bills'],
  ['rent', 'housing'],
  ['cvs', 'health'],
  ['walgreens', 'health'],
  ['equinox', 'health'],
  ['planet fitness', 'health'],
  ['payroll', 'income'],
  ['salary', 'income'],
  ['direct dep', 'income'],
  ['overdraft', 'fees'],
  ['atm fee', 'fees'],
  ['venmo', 'transfer'],
  ['zelle', 'transfer'],
];

const keywordPatterns = KEYWORD_RULES.map(([keyword, category]) => ({
  // Word-ish boundaries so "rent" does not match "parentheses" or "current".
  re: new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`),
  category,
}));

export function matchKeyword(tx: Pick<Transaction, 'name' | 'merchantName'>): CategoryId | null {
  const text = normalizeText(`${tx.merchantName ?? ''} ${tx.name}`);
  for (const { re, category } of keywordPatterns) {
    if (re.test(text)) return category;
  }
  return null;
}

const PLAID_DETAILED: Readonly<Record<string, CategoryId>> = {
  FOOD_AND_DRINK_GROCERIES: 'groceries',
  RENT_AND_UTILITIES_RENT: 'housing',
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: 'housing',
  LOAN_PAYMENTS_CAR_PAYMENT: 'transport',
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: 'transfer',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: 'health',
  GENERAL_MERCHANDISE_PHARMACIES_AND_SUPPLEMENTS: 'health',
};

const PLAID_PRIMARY: Readonly<Record<string, CategoryId>> = {
  INCOME: 'income',
  TRANSFER_IN: 'transfer',
  TRANSFER_OUT: 'transfer',
  LOAN_PAYMENTS: 'bills',
  BANK_FEES: 'fees',
  ENTERTAINMENT: 'entertainment',
  FOOD_AND_DRINK: 'dining',
  GENERAL_MERCHANDISE: 'shopping',
  HOME_IMPROVEMENT: 'housing',
  MEDICAL: 'health',
  PERSONAL_CARE: 'personal',
  GENERAL_SERVICES: 'bills',
  GOVERNMENT_AND_NON_PROFIT: 'other',
  TRANSPORTATION: 'transport',
  TRAVEL: 'travel',
  RENT_AND_UTILITIES: 'bills',
};

/** Map Plaid's personal_finance_category onto our taxonomy. */
export function mapPlaidCategory(pfc: PlaidCategory | null): CategoryId | null {
  if (!pfc) return null;
  return PLAID_DETAILED[pfc.detailed] ?? PLAID_PRIMARY[pfc.primary] ?? null;
}

/**
 * Categorise one transaction (ignoring manual overrides, which callers keep).
 * Precedence: user rules → curated merchant keywords → Plaid category → Other.
 * `rules` must already be sorted with {@link sortRules}.
 */
export function categorize(
  tx: CategorizableTransaction,
  sortedRules: readonly Rule[],
): CategoryAssignment {
  for (const rule of sortedRules) {
    if (ruleMatches(rule, tx)) return { category: rule.category, source: 'rule', ruleId: rule.id };
  }
  const keyword = matchKeyword(tx);
  if (keyword) return { category: keyword, source: 'keyword', ruleId: null };
  const plaid = mapPlaidCategory(tx.plaidCategory);
  if (plaid) return { category: plaid, source: 'plaid', ruleId: null };
  return { category: 'other', source: 'default', ruleId: null };
}

export interface CategoryChange extends CategoryAssignment {
  id: string;
}

/**
 * Re-run categorisation across stored transactions after rules change.
 * Manual overrides are never touched. Returns only the transactions whose
 * assignment actually changed, so callers write the minimum.
 */
export function recategorize(
  transactions: readonly Transaction[],
  rules: readonly Rule[],
): CategoryChange[] {
  const sorted = sortRules(rules);
  const changes: CategoryChange[] = [];
  for (const tx of transactions) {
    if (tx.categorySource === 'manual') continue;
    const next = categorize(tx, sorted);
    if (
      next.category !== tx.category ||
      next.source !== tx.categorySource ||
      next.ruleId !== tx.ruleId
    ) {
      changes.push({ id: tx.id, ...next });
    }
  }
  return changes;
}

/** Count how many transactions a draft rule would capture (for the rule editor preview). */
export function countRuleMatches(
  rule: RuleMatcher,
  transactions: readonly CategorizableTransaction[],
): number {
  return transactions.reduce((n, tx) => (ruleMatches(rule, tx) ? n + 1 : n), 0);
}

/**
 * Turn "Always categorise this merchant as X" into a rule draft. Uses the
 * merchant name when present, otherwise the description minus trailing
 * reference numbers ("CHECKCARD 1004 #4421" → "CHECKCARD").
 */
export function ruleDraftFromTransaction(
  tx: Pick<Transaction, 'name' | 'merchantName'>,
  category: CategoryId,
): Pick<Rule, 'field' | 'operator' | 'pattern' | 'category' | 'minAmountCents' | 'maxAmountCents'> {
  const pattern = (tx.merchantName ?? tx.name.replace(/[\s#*-]*[\d][\d\s#*-]*$/, '')).trim();
  return {
    field: 'merchant',
    operator: 'contains',
    pattern: pattern || tx.name.trim(),
    category,
    minAmountCents: null,
    maxAmountCents: null,
  };
}
