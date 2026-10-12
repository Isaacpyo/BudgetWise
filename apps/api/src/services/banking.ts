import {
  categorize,
  monthOf,
  sortRules,
  type CategoryAssignment,
  type Item,
  type LinkTokenResponse,
  type Rule,
  type SyncSummary,
  type Transaction,
} from '@budgetwise/core';
import { sha256 } from '../crypto';
import { AppError, fromPlaidError, notFound } from '../errors';
import type { ProviderTransaction } from '../providers/types';
import type { Deps } from './deps';

const LINK_SESSION_TTL_MS = 60 * 60_000;
const NOT_READY_RETRIES = 4;
const NOT_READY_DELAY_MS = 1500;

/** Turn a provider transaction into the stored shape, keeping manual overrides. */
export function toStoredTransaction(
  pt: ProviderTransaction,
  itemId: string,
  sortedRules: readonly Rule[],
  existing: Transaction | undefined,
  updatedAt: string,
): Transaction {
  const base = {
    id: pt.id,
    itemId,
    accountId: pt.accountId,
    name: pt.name,
    merchantName: pt.merchantName,
    amountCents: pt.amountCents,
    currency: pt.currency,
    date: pt.date,
    month: monthOf(pt.date),
    pending: pt.pending,
    plaidCategory: pt.plaidCategory,
    logoUrl: pt.logoUrl,
    updatedAt,
  };
  const assignment: CategoryAssignment | null =
    existing?.categorySource === 'manual' ? null : categorize(base, sortedRules);
  return assignment
    ? {
        ...base,
        category: assignment.category,
        categorySource: assignment.source,
        ruleId: assignment.ruleId,
      }
    : { ...base, category: existing!.category, categorySource: 'manual', ruleId: null };
}

async function getOwnedSecret(deps: Deps, uid: string, itemId: string) {
  const secret = await deps.repo.getItemSecret(itemId);
  if (!secret || secret.uid !== uid) throw notFound('Linked bank');
  return secret;
}

/** Pull new/changed/removed transactions for one item via the provider's sync cursor. */
export async function syncItem(deps: Deps, uid: string, itemId: string): Promise<SyncSummary> {
  const secret = await getOwnedSecret(deps, uid, itemId);
  const provider = deps.providers.get(secret.provider);
  const accessToken = deps.secrets.decrypt(secret.accessToken);
  await deps.repo.updateItem(uid, itemId, { status: 'syncing' });

  try {
    const result = await provider.syncTransactions(accessToken, secret.cursor);
    const changed = [...result.added, ...result.modified];
    const [rules, existing] = await Promise.all([
      deps.repo.listRules(uid),
      deps.repo.getTransactions(
        uid,
        changed.map((t) => t.id),
      ),
    ]);
    const sorted = sortRules(rules);
    const now = deps.now().toISOString();
    const upserts = changed.map((pt) =>
      toStoredTransaction(pt, itemId, sorted, existing.get(pt.id), now),
    );

    await deps.repo.writeTransactions(uid, upserts, result.removedIds);
    // Plaid returns an empty cursor while NOT_READY; keep the old one then.
    await deps.repo.saveItemSecret(itemId, {
      ...secret,
      cursor: result.nextCursor || secret.cursor,
    });
    await deps.repo.updateItem(uid, itemId, {
      status: 'ok',
      error: null,
      lastSyncedAt: now,
      ...(result.accounts.length ? { accounts: result.accounts } : {}),
    });
    await deps.repo.upsertUser(uid, { lastSyncedAt: now });

    return {
      added: result.added.length,
      modified: result.modified.length,
      removed: result.removedIds.length,
      ready: result.ready,
    };
  } catch (err) {
    const appErr = fromPlaidError(err) ?? (err instanceof AppError ? err : null);
    await deps.repo.updateItem(uid, itemId, {
      status: 'error',
      error: appErr?.message ?? 'Sync failed. Try again in a moment.',
    });
    throw appErr ?? err;
  }
}

export async function syncAll(deps: Deps, uid: string) {
  const items = await deps.repo.listItems(uid);
  const results = [];
  for (const item of items) {
    try {
      results.push({
        itemId: item.id,
        ok: true,
        error: null,
        ...(await syncItem(deps, uid, item.id)),
      });
    } catch (err) {
      deps.log.warn({ err, itemId: item.id }, 'item sync failed');
      results.push({
        itemId: item.id,
        ok: false,
        error: err instanceof AppError ? err.message : 'Sync failed',
        added: 0,
        modified: 0,
        removed: 0,
        ready: false,
      });
    }
  }
  return { items: results };
}

function validateRedirect(deps: Deps, uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const allowed = deps.config.plaid.hostedLinkRedirectPrefixes;
  if (!allowed.some((prefix) => uri.startsWith(prefix))) {
    throw new AppError(
      400,
      'INVALID_REDIRECT',
      'completionRedirectUri is not an allowed app deep link',
    );
  }
  return uri;
}

export async function createLinkToken(
  deps: Deps,
  uid: string,
  input: { mode: 'web' | 'hosted'; completionRedirectUri?: string },
): Promise<LinkTokenResponse> {
  const provider = deps.providers.active;
  const completionRedirectUri = validateRedirect(deps, input.completionRedirectUri);
  try {
    const result = await provider.createLinkToken({
      userId: uid,
      mode: input.mode,
      completionRedirectUri,
    });
    await deps.repo.saveLinkSession(sha256(result.linkToken), {
      uid,
      provider: provider.name,
      mode: input.mode,
      createdAt: deps.now().toISOString(),
    });
    return { provider: provider.name, ...result };
  } catch (err) {
    throw fromPlaidError(err) ?? err;
  }
}

/** Exchange a public token, store the encrypted access token and run the first sync. */
export async function exchangePublicToken(
  deps: Deps,
  uid: string,
  publicToken: string,
  institution: { id?: string | null; name: string } | null | undefined,
  provider = deps.providers.active,
): Promise<{ item: Item; sync: SyncSummary }> {
  let exchanged: { accessToken: string; itemId: string };
  try {
    exchanged = await provider.exchangePublicToken(publicToken);
  } catch (err) {
    throw fromPlaidError(err) ?? err;
  }

  const now = deps.now().toISOString();
  await deps.repo.saveItemSecret(exchanged.itemId, {
    uid,
    provider: provider.name,
    accessToken: deps.secrets.encrypt(exchanged.accessToken),
    cursor: null,
    createdAt: now,
  });
  await deps.repo.saveItem(uid, {
    id: exchanged.itemId,
    provider: provider.name,
    institutionId: institution?.id ?? null,
    institutionName: institution?.name?.trim() || 'Linked bank',
    accounts: [],
    status: 'syncing',
    error: null,
    lastSyncedAt: null,
    createdAt: now,
  });

  // Fresh Plaid items can report NOT_READY for a few seconds; retry briefly.
  let sync = await syncItem(deps, uid, exchanged.itemId);
  for (let i = 0; i < NOT_READY_RETRIES && !sync.ready && sync.added === 0; i++) {
    await deps.sleep(NOT_READY_DELAY_MS);
    sync = await syncItem(deps, uid, exchanged.itemId);
  }

  const item = await deps.repo.getItem(uid, exchanged.itemId);
  return { item: item!, sync };
}

/** Finish a Hosted Link session (Expo Go): look up the public token server-side. */
export async function completeHostedLink(deps: Deps, uid: string, linkToken: string) {
  const key = sha256(linkToken);
  const session = await deps.repo.getLinkSession(key);
  if (!session || session.uid !== uid) throw notFound('Link session');
  if (deps.now().getTime() - Date.parse(session.createdAt) > LINK_SESSION_TTL_MS) {
    await deps.repo.deleteLinkSession(key);
    throw new AppError(
      410,
      'LINK_SESSION_EXPIRED',
      'That bank-linking session expired. Please start again.',
    );
  }

  const provider = deps.providers.get(session.provider);
  let result;
  try {
    result = await provider.getHostedLinkResult(linkToken);
  } catch (err) {
    throw fromPlaidError(err) ?? err;
  }
  if (!result) {
    throw new AppError(409, 'LINK_NOT_COMPLETED', 'Linking was not completed. You can try again.');
  }
  await deps.repo.deleteLinkSession(key);
  return exchangePublicToken(deps, uid, result.publicToken, result.institution, provider);
}

export async function removeItem(deps: Deps, uid: string, itemId: string) {
  const secret = await getOwnedSecret(deps, uid, itemId);
  try {
    await deps.providers.get(secret.provider).removeItem(deps.secrets.decrypt(secret.accessToken));
  } catch (err) {
    // Unlinking locally must still succeed if the provider already forgot the item.
    deps.log.warn({ err, itemId }, 'provider item removal failed; removing locally');
  }
  const removedTransactions = await deps.repo.deleteTransactionsForItem(uid, itemId);
  await deps.repo.deleteItem(uid, itemId);
  await deps.repo.deleteItemSecret(itemId);
  return { removedTransactions };
}
