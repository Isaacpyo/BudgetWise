/**
 * The fixed category taxonomy. Plaid's personal-finance categories, built-in
 * keywords and user rules all resolve to one of these ids.
 */
export const CATEGORY_IDS = [
  'groceries',
  'dining',
  'transport',
  'shopping',
  'housing',
  'bills',
  'subscriptions',
  'entertainment',
  'travel',
  'health',
  'personal',
  'fees',
  'other',
  'income',
  'transfer',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** expense: counts towards spending and budgets. income/transfer: never do. */
export type CategoryKind = 'expense' | 'income' | 'transfer';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  kind: CategoryKind;
  /** Ionicons glyph name (rendered by @expo/vector-icons in the app). */
  icon: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  groceries: { id: 'groceries', label: 'Groceries', kind: 'expense', icon: 'cart-outline' },
  dining: { id: 'dining', label: 'Dining out', kind: 'expense', icon: 'restaurant-outline' },
  transport: { id: 'transport', label: 'Transport', kind: 'expense', icon: 'car-outline' },
  shopping: { id: 'shopping', label: 'Shopping', kind: 'expense', icon: 'bag-handle-outline' },
  housing: { id: 'housing', label: 'Rent & housing', kind: 'expense', icon: 'home-outline' },
  bills: { id: 'bills', label: 'Bills & utilities', kind: 'expense', icon: 'flash-outline' },
  subscriptions: {
    id: 'subscriptions',
    label: 'Subscriptions',
    kind: 'expense',
    icon: 'repeat-outline',
  },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    kind: 'expense',
    icon: 'film-outline',
  },
  travel: { id: 'travel', label: 'Travel', kind: 'expense', icon: 'airplane-outline' },
  health: { id: 'health', label: 'Health & fitness', kind: 'expense', icon: 'fitness-outline' },
  personal: { id: 'personal', label: 'Personal care', kind: 'expense', icon: 'sparkles-outline' },
  fees: { id: 'fees', label: 'Fees & charges', kind: 'expense', icon: 'alert-circle-outline' },
  other: { id: 'other', label: 'Other', kind: 'expense', icon: 'ellipsis-horizontal-circle-outline' },
  income: { id: 'income', label: 'Income', kind: 'income', icon: 'cash-outline' },
  transfer: { id: 'transfer', label: 'Transfers', kind: 'transfer', icon: 'swap-horizontal-outline' },
};

export const EXPENSE_CATEGORY_IDS: readonly CategoryId[] = CATEGORY_IDS.filter(
  (id) => CATEGORIES[id].kind === 'expense',
);

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES[id].label;
}

export function isExpenseCategory(id: CategoryId): boolean {
  return CATEGORIES[id].kind === 'expense';
}
