import { randomUUID } from 'node:crypto';
import {
  categorize,
  recategorize,
  ruleDraftFromTransaction,
  ruleInputSchema,
  ruleMatches,
  sortRules,
  type Rule,
  type RuleInput,
  type RuleUpdate,
  type Transaction,
  type TransactionPatch as TransactionCategoryPatch,
} from '@budgetwise/core';
import { AppError, notFound } from '../errors';
import type { Deps } from './deps';

export const MAX_RULES_PER_USER = 100;

/** Re-run the rule engine over all of a user's transactions; returns how many changed. */
export async function recategorizeAll(deps: Deps, uid: string): Promise<number> {
  const [transactions, rules] = await Promise.all([
    deps.repo.listTransactions(uid),
    deps.repo.listRules(uid),
  ]);
  const changes = recategorize(transactions, rules);
  const updatedAt = deps.now().toISOString();
  await deps.repo.patchTransactions(
    uid,
    changes.map((c) => ({
      id: c.id,
      category: c.category,
      categorySource: c.source,
      ruleId: c.ruleId,
      updatedAt,
    })),
  );
  return changes.length;
}

export async function createRule(
  deps: Deps,
  uid: string,
  input: RuleInput,
): Promise<{ rule: Rule; recategorized: number }> {
  const parsed = ruleInputSchema.parse(input);
  const existing = await deps.repo.listRules(uid);
  if (existing.length >= MAX_RULES_PER_USER) {
    throw new AppError(409, 'RULE_LIMIT', `You can have at most ${MAX_RULES_PER_USER} rules`);
  }
  const rule: Rule = {
    id: randomUUID(),
    ...parsed,
    // New rules run first: the most recent decision wins.
    priority: existing.length ? Math.min(...existing.map((r) => r.priority)) - 1 : 0,
    createdAt: deps.now().toISOString(),
  };
  await deps.repo.saveRule(uid, rule);
  return { rule, recategorized: await recategorizeAll(deps, uid) };
}

export async function updateRule(
  deps: Deps,
  uid: string,
  id: string,
  patch: RuleUpdate,
): Promise<{ rule: Rule; recategorized: number }> {
  const current = await deps.repo.getRule(uid, id);
  if (!current) throw notFound('Rule');
  const next = { ...current, ...patch };
  // Re-validate the merged rule so cross-field constraints still hold.
  const checked = ruleInputSchema.parse(next);
  const rule: Rule = { ...next, ...checked };
  await deps.repo.saveRule(uid, rule);
  return { rule, recategorized: await recategorizeAll(deps, uid) };
}

export async function deleteRule(
  deps: Deps,
  uid: string,
  id: string,
): Promise<{ recategorized: number }> {
  const current = await deps.repo.getRule(uid, id);
  if (!current) throw notFound('Rule');
  await deps.repo.deleteRule(uid, id);
  return { recategorized: await recategorizeAll(deps, uid) };
}

/**
 * Manually recategorise one transaction. With `createRule`, a merchant rule is
 * created instead so every past and future match follows. `category: null`
 * hands the transaction back to automatic categorisation.
 */
export async function setTransactionCategory(
  deps: Deps,
  uid: string,
  txId: string,
  patch: Required<TransactionCategoryPatch>,
): Promise<{ transaction: Transaction; rule: Rule | null; recategorized: number }> {
  const tx = (await deps.repo.getTransactions(uid, [txId])).get(txId);
  if (!tx) throw notFound('Transaction');
  const updatedAt = deps.now().toISOString();

  if (patch.category === null) {
    const auto = categorize(tx, sortRules(await deps.repo.listRules(uid)));
    await deps.repo.patchTransactions(uid, [
      {
        id: txId,
        category: auto.category,
        categorySource: auto.source,
        ruleId: auto.ruleId,
        updatedAt,
      },
    ]);
  } else if (patch.createRule) {
    // Create the rule first: if that fails (validation, rule limit) nothing
    // about this transaction has changed yet.
    const { rule, recategorized } = await createRule(
      deps,
      uid,
      ruleDraftFromTransaction(tx, patch.category),
    );
    // Recategorisation skips manual overrides, so settle this one explicitly.
    // The rule is derived from it and runs first, so it normally matches.
    await deps.repo.patchTransactions(uid, [
      ruleMatches(rule, tx)
        ? { id: txId, category: rule.category, categorySource: 'rule', ruleId: rule.id, updatedAt }
        : { id: txId, category: patch.category, categorySource: 'manual', ruleId: null, updatedAt },
    ]);
    const transaction = (await deps.repo.getTransactions(uid, [txId])).get(txId) ?? tx;
    return { transaction, rule, recategorized };
  } else {
    await deps.repo.patchTransactions(uid, [
      { id: txId, category: patch.category, categorySource: 'manual', ruleId: null, updatedAt },
    ]);
  }

  const transaction = (await deps.repo.getTransactions(uid, [txId])).get(txId) ?? tx;
  return { transaction, rule: null, recategorized: 0 };
}
