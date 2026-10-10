import type { Budget, CategoryId, Item, Rule, Transaction, UserProfile } from '@budgetwise/core';
import type { ItemSecret, LinkSession, Repo, TransactionPatch } from './types';

const clone = <T>(v: T): T => structuredClone(v);

interface UserData {
  profile: UserProfile | null;
  items: Map<string, Item>;
  transactions: Map<string, Transaction>;
  rules: Map<string, Rule>;
  budgets: Map<CategoryId, Budget>;
}

/** In-memory Repo for tests. Returns copies so callers can't mutate storage. */
export class MemoryRepo implements Repo {
  private users = new Map<string, UserData>();
  readonly secrets = new Map<string, ItemSecret>();
  readonly linkSessions = new Map<string, LinkSession>();

  private user(uid: string): UserData {
    let u = this.users.get(uid);
    if (!u) {
      u = {
        profile: null,
        items: new Map(),
        transactions: new Map(),
        rules: new Map(),
        budgets: new Map(),
      };
      this.users.set(uid, u);
    }
    return u;
  }

  async getUser(uid: string) {
    return clone(this.user(uid).profile);
  }
  async upsertUser(uid: string, patch: Partial<UserProfile>) {
    const u = this.user(uid);
    u.profile = {
      uid,
      email: null,
      isDemo: false,
      createdAt: new Date().toISOString(),
      lastSyncedAt: null,
      ...u.profile,
      ...clone(patch),
    };
  }

  async listItems(uid: string) {
    return [...this.user(uid).items.values()].map(clone);
  }
  async getItem(uid: string, itemId: string) {
    const item = this.user(uid).items.get(itemId);
    return item ? clone(item) : null;
  }
  async saveItem(uid: string, item: Item) {
    this.user(uid).items.set(item.id, clone(item));
  }
  async updateItem(uid: string, itemId: string, patch: Partial<Item>) {
    const items = this.user(uid).items;
    const item = items.get(itemId);
    if (item) items.set(itemId, { ...item, ...clone(patch) });
  }
  async deleteItem(uid: string, itemId: string) {
    this.user(uid).items.delete(itemId);
  }

  async getItemSecret(itemId: string) {
    const s = this.secrets.get(itemId);
    return s ? clone(s) : null;
  }
  async saveItemSecret(itemId: string, secret: ItemSecret) {
    this.secrets.set(itemId, clone(secret));
  }
  async deleteItemSecret(itemId: string) {
    this.secrets.delete(itemId);
  }

  async listTransactions(uid: string) {
    return [...this.user(uid).transactions.values()].map(clone);
  }
  async getTransactions(uid: string, ids: readonly string[]) {
    const all = this.user(uid).transactions;
    const out = new Map<string, Transaction>();
    for (const id of ids) {
      const t = all.get(id);
      if (t) out.set(id, clone(t));
    }
    return out;
  }
  async writeTransactions(
    uid: string,
    upserts: readonly Transaction[],
    deleteIds: readonly string[],
  ) {
    const all = this.user(uid).transactions;
    for (const t of upserts) all.set(t.id, clone(t));
    for (const id of deleteIds) all.delete(id);
  }
  async patchTransactions(uid: string, patches: readonly TransactionPatch[]) {
    const all = this.user(uid).transactions;
    for (const { id, ...patch } of patches) {
      const t = all.get(id);
      if (t) all.set(id, { ...t, ...patch });
    }
  }
  async deleteTransactionsForItem(uid: string, itemId: string) {
    const all = this.user(uid).transactions;
    let n = 0;
    for (const [id, t] of all) {
      if (t.itemId === itemId) {
        all.delete(id);
        n++;
      }
    }
    return n;
  }

  async listRules(uid: string) {
    return [...this.user(uid).rules.values()].map(clone);
  }
  async getRule(uid: string, id: string) {
    const r = this.user(uid).rules.get(id);
    return r ? clone(r) : null;
  }
  async saveRule(uid: string, rule: Rule) {
    this.user(uid).rules.set(rule.id, clone(rule));
  }
  async deleteRule(uid: string, id: string) {
    this.user(uid).rules.delete(id);
  }

  async listBudgets(uid: string) {
    return [...this.user(uid).budgets.values()].map(clone);
  }
  async saveBudget(uid: string, budget: Budget) {
    this.user(uid).budgets.set(budget.category, clone(budget));
  }
  async deleteBudget(uid: string, category: CategoryId) {
    this.user(uid).budgets.delete(category);
  }

  async saveLinkSession(key: string, session: LinkSession) {
    this.linkSessions.set(key, clone(session));
  }
  async getLinkSession(key: string) {
    const s = this.linkSessions.get(key);
    return s ? clone(s) : null;
  }
  async deleteLinkSession(key: string) {
    this.linkSessions.delete(key);
  }

  async deleteUserData(uid: string) {
    for (const [id, s] of this.secrets) if (s.uid === uid) this.secrets.delete(id);
    this.users.delete(uid);
  }
}
