import type { Budget, CategoryId, Item, Rule, Transaction, UserProfile } from '@budgetwise/core';
import type { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import type { ItemSecret, LinkSession, Repo, TransactionPatch } from './types';

/** gRPC status code Firestore uses for a missing document. */
const NOT_FOUND = 5;

/** Firestore caps a batch at 500 writes; stay comfortably under it. */
const BATCH_LIMIT = 400;

/** Firestore implementation of {@link Repo} (Admin SDK, bypasses security rules). */
export class FirestoreRepo implements Repo {
  constructor(private readonly db: Firestore) {}

  private userDoc(uid: string) {
    return this.db.collection('users').doc(uid);
  }
  private items(uid: string) {
    return this.userDoc(uid).collection('items');
  }
  private transactions(uid: string) {
    return this.userDoc(uid).collection('transactions');
  }
  private rules(uid: string) {
    return this.userDoc(uid).collection('rules');
  }
  private budgets(uid: string) {
    return this.userDoc(uid).collection('budgets');
  }

  private async inBatches<T>(values: readonly T[], apply: (batch: WriteBatch, value: T) => void) {
    for (let i = 0; i < values.length; i += BATCH_LIMIT) {
      const batch = this.db.batch();
      for (const v of values.slice(i, i + BATCH_LIMIT)) apply(batch, v);
      await batch.commit();
    }
  }

  async getUser(uid: string) {
    const snap = await this.userDoc(uid).get();
    return snap.exists ? (snap.data() as UserProfile) : null;
  }
  async upsertUser(uid: string, patch: Partial<UserProfile>) {
    await this.userDoc(uid).set({ uid, ...patch }, { merge: true });
  }

  async listItems(uid: string) {
    const snap = await this.items(uid).get();
    return snap.docs.map((d) => d.data() as Item);
  }
  async getItem(uid: string, itemId: string) {
    const snap = await this.items(uid).doc(itemId).get();
    return snap.exists ? (snap.data() as Item) : null;
  }
  async saveItem(uid: string, item: Item) {
    await this.items(uid).doc(item.id).set(item);
  }
  async updateItem(uid: string, itemId: string, patch: Partial<Item>) {
    try {
      // update() (not set/merge) so a sync racing an unlink can't resurrect a
      // half-empty item document.
      await this.items(uid).doc(itemId).update(patch);
    } catch (err) {
      if ((err as { code?: number }).code === NOT_FOUND) return;
      throw err;
    }
  }
  async deleteItem(uid: string, itemId: string) {
    await this.items(uid).doc(itemId).delete();
  }

  async getItemSecret(itemId: string) {
    const snap = await this.db.collection('itemSecrets').doc(itemId).get();
    return snap.exists ? (snap.data() as ItemSecret) : null;
  }
  async saveItemSecret(itemId: string, secret: ItemSecret) {
    await this.db.collection('itemSecrets').doc(itemId).set(secret);
  }
  async deleteItemSecret(itemId: string) {
    await this.db.collection('itemSecrets').doc(itemId).delete();
  }

  async listTransactions(uid: string) {
    const snap = await this.transactions(uid).get();
    return snap.docs.map((d) => d.data() as Transaction);
  }
  async getTransactions(uid: string, ids: readonly string[]) {
    const out = new Map<string, Transaction>();
    const col = this.transactions(uid);
    for (let i = 0; i < ids.length; i += 300) {
      const refs: DocumentReference[] = ids.slice(i, i + 300).map((id) => col.doc(id));
      if (refs.length === 0) continue;
      const snaps = await this.db.getAll(...refs);
      for (const s of snaps) if (s.exists) out.set(s.id, s.data() as Transaction);
    }
    return out;
  }
  async writeTransactions(
    uid: string,
    upserts: readonly Transaction[],
    deleteIds: readonly string[],
  ) {
    const col = this.transactions(uid);
    type Op = { kind: 'set'; tx: Transaction } | { kind: 'delete'; id: string };
    const ops: Op[] = [
      ...upserts.map((tx) => ({ kind: 'set' as const, tx })),
      ...deleteIds.map((id) => ({ kind: 'delete' as const, id })),
    ];
    await this.inBatches(ops, (batch, op) => {
      if (op.kind === 'set') batch.set(col.doc(op.tx.id), op.tx);
      else batch.delete(col.doc(op.id));
    });
  }
  async patchTransactions(uid: string, patches: readonly TransactionPatch[]) {
    const col = this.transactions(uid);
    await this.inBatches(patches, (batch, { id, ...patch }) => batch.update(col.doc(id), patch));
  }
  async deleteTransactionsForItem(uid: string, itemId: string) {
    const snap = await this.transactions(uid).where('itemId', '==', itemId).get();
    await this.inBatches(snap.docs, (batch, d) => batch.delete(d.ref));
    return snap.size;
  }

  async listRules(uid: string) {
    const snap = await this.rules(uid).get();
    return snap.docs.map((d) => d.data() as Rule);
  }
  async getRule(uid: string, id: string) {
    const snap = await this.rules(uid).doc(id).get();
    return snap.exists ? (snap.data() as Rule) : null;
  }
  async saveRule(uid: string, rule: Rule) {
    await this.rules(uid).doc(rule.id).set(rule);
  }
  async deleteRule(uid: string, id: string) {
    await this.rules(uid).doc(id).delete();
  }

  async listBudgets(uid: string) {
    const snap = await this.budgets(uid).get();
    return snap.docs.map((d) => d.data() as Budget);
  }
  async saveBudget(uid: string, budget: Budget) {
    await this.budgets(uid).doc(budget.category).set(budget);
  }
  async deleteBudget(uid: string, category: CategoryId) {
    await this.budgets(uid).doc(category).delete();
  }

  async saveLinkSession(key: string, session: LinkSession) {
    await this.db.collection('linkSessions').doc(key).set(session);
  }
  async getLinkSession(key: string) {
    const snap = await this.db.collection('linkSessions').doc(key).get();
    return snap.exists ? (snap.data() as LinkSession) : null;
  }
  async deleteLinkSession(key: string) {
    await this.db.collection('linkSessions').doc(key).delete();
  }

  async deleteUserData(uid: string) {
    const secrets = await this.db.collection('itemSecrets').where('uid', '==', uid).get();
    await this.inBatches(secrets.docs, (batch, d) => batch.delete(d.ref));
    await this.db.recursiveDelete(this.userDoc(uid));
  }
}
