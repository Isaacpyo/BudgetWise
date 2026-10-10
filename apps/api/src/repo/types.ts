import type {
  Budget,
  CategoryId,
  Item,
  ItemProvider,
  Rule,
  Transaction,
  UserProfile,
} from '@budgetwise/core';

/** Server-only record at itemSecrets/{itemId}. Never readable by clients. */
export interface ItemSecret {
  uid: string;
  provider: ItemProvider;
  /** AES-256-GCM encrypted access token. */
  accessToken: string;
  cursor: string | null;
  createdAt: string;
}

/** Server-only record at linkSessions/{sha256(linkToken)}. */
export interface LinkSession {
  uid: string;
  provider: ItemProvider;
  mode: 'web' | 'hosted';
  createdAt: string;
}

export type TransactionPatch = { id: string } & Partial<
  Pick<Transaction, 'category' | 'categorySource' | 'ruleId' | 'updatedAt'>
>;

/**
 * Persistence boundary. FirestoreRepo is the real implementation; MemoryRepo
 * backs the route tests.
 */
export interface Repo {
  getUser(uid: string): Promise<UserProfile | null>;
  upsertUser(uid: string, patch: Partial<UserProfile>): Promise<void>;

  listItems(uid: string): Promise<Item[]>;
  getItem(uid: string, itemId: string): Promise<Item | null>;
  saveItem(uid: string, item: Item): Promise<void>;
  updateItem(uid: string, itemId: string, patch: Partial<Item>): Promise<void>;
  deleteItem(uid: string, itemId: string): Promise<void>;

  getItemSecret(itemId: string): Promise<ItemSecret | null>;
  saveItemSecret(itemId: string, secret: ItemSecret): Promise<void>;
  deleteItemSecret(itemId: string): Promise<void>;

  listTransactions(uid: string): Promise<Transaction[]>;
  getTransactions(uid: string, ids: readonly string[]): Promise<Map<string, Transaction>>;
  /** Batched upsert + delete. */
  writeTransactions(
    uid: string,
    upserts: readonly Transaction[],
    deleteIds: readonly string[],
  ): Promise<void>;
  patchTransactions(uid: string, patches: readonly TransactionPatch[]): Promise<void>;
  deleteTransactionsForItem(uid: string, itemId: string): Promise<number>;

  listRules(uid: string): Promise<Rule[]>;
  getRule(uid: string, id: string): Promise<Rule | null>;
  saveRule(uid: string, rule: Rule): Promise<void>;
  deleteRule(uid: string, id: string): Promise<void>;

  listBudgets(uid: string): Promise<Budget[]>;
  saveBudget(uid: string, budget: Budget): Promise<void>;
  deleteBudget(uid: string, category: CategoryId): Promise<void>;

  saveLinkSession(key: string, session: LinkSession): Promise<void>;
  getLinkSession(key: string): Promise<LinkSession | null>;
  deleteLinkSession(key: string): Promise<void>;

  /** Remove everything stored for a user (demo reset). */
  deleteUserData(uid: string): Promise<void>;
}
