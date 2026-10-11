import type { Budget, CategoryId, Rule } from '@budgetwise/core';
import { syncItem } from './banking';
import type { Deps } from './deps';

export const DEMO_EMAIL = 'demo@budgetwise.app';
export const DEMO_INSTITUTION = 'First Platypus Bank (sandbox)';

const DEMO_BUDGETS: Array<[CategoryId, number]> = [
  ['groceries', 55_000],
  ['dining', 35_000],
  ['transport', 20_000],
  ['shopping', 25_000],
  ['subscriptions', 4_000],
  ['entertainment', 8_000],
];

function demoRules(createdAt: string): Rule[] {
  return [
    {
      // Plaid files this shop as general merchandise; the user knows better.
      id: 'demo-rule-bodega',
      field: 'merchant',
      operator: 'contains',
      pattern: 'Corner Bodega',
      category: 'groceries',
      minAmountCents: null,
      maxAmountCents: null,
      priority: 0,
      createdAt,
    },
    {
      // A personal choice: bike share counts as fitness, not transport.
      id: 'demo-rule-bikes',
      field: 'merchant',
      operator: 'equals',
      pattern: 'Bay Wheels',
      category: 'health',
      minAmountCents: null,
      maxAmountCents: null,
      priority: 1,
      createdAt,
    },
  ];
}

/**
 * Wipe and rebuild the shared demo account: one sandbox bank with six months
 * of deterministic transactions, two rules, six budgets and a manual override.
 */
export async function seedDemoUser(deps: Deps, uid = deps.config.demo.uid): Promise<void> {
  const { repo } = deps;
  const now = deps.now().toISOString();
  await repo.deleteUserData(uid);
  await repo.upsertUser(uid, {
    uid,
    email: DEMO_EMAIL,
    isDemo: true,
    createdAt: now,
    lastSyncedAt: null,
    seededAt: null,
  });

  for (const rule of demoRules(now)) await repo.saveRule(uid, rule);
  for (const [category, limitCents] of DEMO_BUDGETS) {
    const budget: Budget = { category, limitCents, updatedAt: now };
    await repo.saveBudget(uid, budget);
  }

  const itemId = `item-demo-${uid}`;
  await repo.saveItemSecret(itemId, {
    uid,
    provider: 'mock',
    // A fixed token makes the demo's transactions deterministic for a given day.
    accessToken: deps.secrets.encrypt(`access-mock-demo-${uid}`),
    cursor: null,
    createdAt: now,
  });
  await repo.saveItem(uid, {
    id: itemId,
    provider: 'mock',
    institutionId: 'ins_mock_platypus',
    institutionName: DEMO_INSTITUTION,
    accounts: [],
    status: 'syncing',
    error: null,
    lastSyncedAt: null,
    createdAt: now,
  });
  await syncItem(deps, uid, itemId);

  // Show a manual override: the latest Golden Dragon dinner was a birthday night out.
  const dinner = (await repo.listTransactions(uid))
    .filter((t) => t.merchantName === 'Golden Dragon')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (dinner) {
    await repo.patchTransactions(uid, [
      {
        id: dinner.id,
        category: 'entertainment',
        categorySource: 'manual',
        ruleId: null,
        updatedAt: now,
      },
    ]);
  }

  await repo.upsertUser(uid, { seededAt: now });
}

let reseeding: Promise<void> | null = null;

/** Re-seed the demo account if it was never seeded or is older than DEMO_RESEED_HOURS. */
export async function ensureDemoSeeded(deps: Deps): Promise<boolean> {
  const { uid, reseedHours } = deps.config.demo;
  const profile = await deps.repo.getUser(uid);
  const seededAt = profile?.seededAt ? Date.parse(profile.seededAt) : NaN;
  const stale = Number.isNaN(seededAt) || deps.now().getTime() - seededAt > reseedHours * 3_600_000;
  if (!stale) return false;

  // Serialise concurrent "Try the demo" clicks onto a single reseed.
  reseeding ??= seedDemoUser(deps).finally(() => {
    reseeding = null;
  });
  await reseeding;
  return true;
}

export async function createDemoSession(deps: Deps) {
  const reseeded = await ensureDemoSeeded(deps);
  const customToken = await deps.auth.createCustomToken(deps.config.demo.uid, { demo: true });
  return { customToken, reseeded };
}
