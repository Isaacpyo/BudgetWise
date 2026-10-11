import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@budgetwise/core';
import { sha256 } from '../src/crypto';
import type { BankProvider } from '../src/providers/types';
import type { MemoryRepo } from '../src/repo/memory';
import { auth, makeApp } from './helpers';

let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});

async function linkMockBank(a: FastifyInstance, uid = 'alice') {
  const token = await a.inject({
    method: 'POST',
    url: '/v1/plaid/link-token',
    headers: auth(uid),
    payload: {},
  });
  expect(token.statusCode).toBe(200);
  const res = await a.inject({
    method: 'POST',
    url: '/v1/plaid/exchange',
    headers: auth(uid),
    payload: {
      publicToken: 'public-mock-platypus-123',
      institution: { id: 'ins_mock', name: 'First Platypus Bank' },
    },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { item: { id: string }; sync: { added: number } };
}

const byMerchant = (txs: Transaction[], merchant: string) =>
  txs.filter((t) => t.merchantName === merchant);

describe('public endpoints', () => {
  it('reports health and the active provider', async () => {
    ({ app } = await makeApp());
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, provider: 'mock' });
  });

  it('rejects unauthenticated and badly authenticated requests', async () => {
    ({ app } = await makeApp());
    const none = await app.inject({ method: 'POST', url: '/v1/sync' });
    expect(none.statusCode).toBe(401);
    expect(none.json().error.code).toBe('UNAUTHORIZED');
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: { authorization: 'Bearer nope' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('only allows configured browser origins', async () => {
    ({ app } = await makeApp());
    const ok = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:8081' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const evil = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('session bootstrap', () => {
  it('creates the profile once', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const res = await app.inject({ method: 'POST', url: '/v1/session', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile).toMatchObject({
      uid: 'alice',
      email: 'alice@example.com',
      isDemo: false,
    });
    const createdAt = (await repo.getUser('alice'))?.createdAt;
    await app.inject({ method: 'POST', url: '/v1/session', headers: auth() });
    expect((await repo.getUser('alice'))?.createdAt).toBe(createdAt);
  });
});

describe('linking and syncing', () => {
  it('exchanges a public token, encrypts the access token and imports categorised transactions', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const { item, sync } = await linkMockBank(app);

    expect(sync.added).toBeGreaterThan(50);
    const stored = await repo.getItem('alice', item.id);
    expect(stored).toMatchObject({
      institutionName: 'First Platypus Bank',
      status: 'ok',
      provider: 'mock',
    });
    expect(stored?.accounts).toHaveLength(2);
    expect(JSON.stringify(stored)).not.toContain('access-mock');

    const secret = await repo.getItemSecret(item.id);
    expect(secret?.uid).toBe('alice');
    expect(secret?.accessToken).not.toContain('access-mock');
    expect(secret?.cursor).toBe('2026-10-10');

    const txs = await repo.listTransactions('alice');
    expect(txs.length).toBe(sync.added);
    expect(txs.every((t) => t.itemId === item.id && t.month === t.date.slice(0, 7))).toBe(true);
    expect(txs.find((t) => t.name === 'GREENVIEW APARTMENTS RENT')?.category).toBe('housing');
    expect(txs.find((t) => t.merchantName === 'Netflix')).toMatchObject({
      category: 'subscriptions',
      categorySource: 'keyword',
    });
  });

  it('records link sessions by hash, never the raw token', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/link-token',
      headers: auth(),
      payload: { mode: 'web' },
    });
    const { linkToken, provider } = res.json();
    expect(provider).toBe('mock');
    expect(repo.linkSessions.has(sha256(linkToken))).toBe(true);
    expect([...repo.linkSessions.keys()]).not.toContain(linkToken);
  });

  it('rejects redirect URIs that are not app deep links', async () => {
    ({ app } = await makeApp());
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/link-token',
      headers: auth(),
      payload: { mode: 'hosted', completionRedirectUri: 'https://evil.example/steal' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REDIRECT');
  });

  it('validates exchange input', async () => {
    ({ app } = await makeApp());
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/exchange',
      headers: auth(),
      payload: { publicToken: 'x' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    const malformed = await app.inject({
      method: 'POST',
      url: '/v1/plaid/exchange',
      headers: { ...auth(), 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(malformed.statusCode).toBe(400);
  });

  it('re-syncs idempotently and preserves manual overrides', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    await linkMockBank(app);
    const before = await repo.listTransactions('alice');
    const target = before.find((t) => t.date >= '2026-10-09')!;
    await app.inject({
      method: 'PATCH',
      url: `/v1/transactions/${target.id}`,
      headers: auth(),
      payload: { category: 'travel' },
    });

    const res = await app.inject({ method: 'POST', url: '/v1/sync', headers: auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0]).toMatchObject({ ok: true, added: 0 });
    const after = await repo.listTransactions('alice');
    expect(after).toHaveLength(before.length);
    expect(after.find((t) => t.id === target.id)).toMatchObject({
      category: 'travel',
      categorySource: 'manual',
    });
  });

  it('keeps users isolated', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const { item } = await linkMockBank(app, 'alice');
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/items/${item.id}`,
      headers: auth('mallory'),
    });
    expect(res.statusCode).toBe(404);
    expect(await repo.getItem('alice', item.id)).not.toBeNull();
    expect(await repo.listTransactions('mallory')).toEqual([]);
  });

  it('unlinks a bank and removes its transactions and secret', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const { item, sync } = await linkMockBank(app);
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/items/${item.id}`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ removedTransactions: sync.added });
    expect(await repo.getItem('alice', item.id)).toBeNull();
    expect(await repo.getItemSecret(item.id)).toBeNull();
    expect(await repo.listTransactions('alice')).toEqual([]);
  });
});

describe('hosted link (Expo Go)', () => {
  function fakePlaid(publicToken: string | null): BankProvider {
    return {
      name: 'plaid',
      createLinkToken: vi.fn().mockResolvedValue({
        linkToken: 'link-sandbox-abc',
        expiration: 'x',
        hostedLinkUrl: 'https://hosted.plaid.com/x',
      }),
      exchangePublicToken: vi
        .fn()
        .mockResolvedValue({ accessToken: 'access-sandbox-1', itemId: 'item-plaid-1' }),
      getHostedLinkResult: vi
        .fn()
        .mockResolvedValue(
          publicToken ? { publicToken, institution: { id: 'ins_1', name: 'Tartan Bank' } } : null,
        ),
      syncTransactions: vi.fn().mockResolvedValue({
        added: [],
        modified: [],
        removedIds: [],
        accounts: [],
        nextCursor: 'c1',
        ready: true,
      }),
      removeItem: vi.fn(),
    };
  }

  it('completes a finished session for its owner only', async () => {
    let repo: MemoryRepo;
    const plaid = fakePlaid('public-sandbox-1');
    ({ app, repo } = await makeApp({ plaid }));
    const token = await app.inject({
      method: 'POST',
      url: '/v1/plaid/link-token',
      headers: auth(),
      payload: {
        mode: 'hosted',
        completionRedirectUri: 'exp://192.168.1.2:8081/--/plaid-complete',
      },
    });
    expect(token.json()).toMatchObject({
      provider: 'plaid',
      hostedLinkUrl: 'https://hosted.plaid.com/x',
    });

    const stolen = await app.inject({
      method: 'POST',
      url: '/v1/plaid/hosted-link/complete',
      headers: auth('mallory'),
      payload: { linkToken: 'link-sandbox-abc' },
    });
    expect(stolen.statusCode).toBe(404);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/hosted-link/complete',
      headers: auth(),
      payload: { linkToken: 'link-sandbox-abc' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().item).toMatchObject({
      id: 'item-plaid-1',
      institutionName: 'Tartan Bank',
      provider: 'plaid',
    });
    expect(plaid.exchangePublicToken).toHaveBeenCalledWith('public-sandbox-1');
    expect(repo.linkSessions.size).toBe(0);
  });

  it('reports an unfinished session without consuming it', async () => {
    ({ app } = await makeApp({ plaid: fakePlaid(null) }));
    await app.inject({
      method: 'POST',
      url: '/v1/plaid/link-token',
      headers: auth(),
      payload: { mode: 'hosted' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/hosted-link/complete',
      headers: auth(),
      payload: { linkToken: 'link-sandbox-abc' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('LINK_NOT_COMPLETED');
  });

  it('surfaces Plaid errors with their display message', async () => {
    const plaid = fakePlaid(null);
    plaid.createLinkToken = vi.fn().mockRejectedValue(
      Object.assign(new Error('400'), {
        response: {
          data: {
            error_code: 'INVALID_API_KEYS',
            error_message: 'invalid client_id or secret',
            display_message: null,
          },
        },
      }),
    );
    ({ app } = await makeApp({ plaid }));
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plaid/link-token',
      headers: auth(),
      payload: {},
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toEqual({
      code: 'PLAID_INVALID_API_KEYS',
      message: 'invalid client_id or secret',
    });
  });
});

describe('rules and overrides', () => {
  it('creating a rule recategorises matching transactions and deleting it reverts them', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    await linkMockBank(app);
    const lyft = byMerchant(await repo.listTransactions('alice'), 'Lyft');
    expect(lyft.length).toBeGreaterThan(0);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/rules',
      headers: auth(),
      payload: { field: 'merchant', operator: 'equals', pattern: 'lyft', category: 'travel' },
    });
    expect(created.statusCode).toBe(201);
    const { rule, recategorized } = created.json();
    expect(recategorized).toBe(lyft.length);
    expect(
      byMerchant(await repo.listTransactions('alice'), 'Lyft').every(
        (t) => t.category === 'travel' && t.ruleId === rule.id,
      ),
    ).toBe(true);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/rules/${rule.id}`,
      headers: auth(),
    });
    expect(del.json()).toEqual({ recategorized: lyft.length });
    expect(
      byMerchant(await repo.listTransactions('alice'), 'Lyft').every(
        (t) => t.category === 'transport',
      ),
    ).toBe(true);
  });

  it('new rules take precedence over older ones', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    await linkMockBank(app);
    const post = (category: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/rules',
        headers: auth(),
        payload: { field: 'merchant', operator: 'contains', pattern: 'uber', category },
      });
    await post('travel');
    await post('entertainment');
    const ubers = (await repo.listTransactions('alice')).filter((t) =>
      t.merchantName?.startsWith('Uber'),
    );
    expect(ubers.every((t) => t.category === 'entertainment')).toBe(true);
  });

  it('updates rules with validation', async () => {
    ({ app } = await makeApp());
    const { rule } = (
      await app.inject({
        method: 'POST',
        url: '/v1/rules',
        headers: auth(),
        payload: {
          field: 'merchant',
          operator: 'contains',
          pattern: 'amazon',
          category: 'shopping',
          minAmountCents: 1000,
        },
      })
    ).json();
    const bad = await app.inject({
      method: 'PATCH',
      url: `/v1/rules/${rule.id}`,
      headers: auth(),
      payload: { maxAmountCents: 500 },
    });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({
      method: 'PATCH',
      url: `/v1/rules/${rule.id}`,
      headers: auth(),
      payload: { category: 'groceries' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().rule).toMatchObject({
      id: rule.id,
      category: 'groceries',
      minAmountCents: 1000,
    });
    const missing = await app.inject({
      method: 'PATCH',
      url: '/v1/rules/nope',
      headers: auth(),
      payload: { category: 'groceries' },
    });
    expect(missing.statusCode).toBe(404);
  });

  it('a transaction can be overridden, turned into a rule, and reset to automatic', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    await linkMockBank(app);
    const sweetgreen = byMerchant(await repo.listTransactions('alice'), 'Sweetgreen');
    expect(sweetgreen.length).toBeGreaterThan(1);
    const [first] = sweetgreen;

    const withRule = await app.inject({
      method: 'PATCH',
      url: `/v1/transactions/${first!.id}`,
      headers: auth(),
      payload: { category: 'groceries', createRule: true },
    });
    expect(withRule.statusCode).toBe(200);
    expect(withRule.json().rule).toMatchObject({ pattern: 'Sweetgreen', category: 'groceries' });
    expect(withRule.json().transaction).toMatchObject({
      category: 'groceries',
      categorySource: 'rule',
    });
    expect(
      byMerchant(await repo.listTransactions('alice'), 'Sweetgreen').every(
        (t) => t.category === 'groceries',
      ),
    ).toBe(true);

    const reset = await app.inject({
      method: 'PATCH',
      url: `/v1/transactions/${first!.id}`,
      headers: auth(),
      payload: { category: null },
    });
    expect(reset.json().transaction).toMatchObject({
      category: 'groceries',
      categorySource: 'rule',
    });

    const manual = await app.inject({
      method: 'PATCH',
      url: `/v1/transactions/${first!.id}`,
      headers: auth(),
      payload: { category: 'health' },
    });
    expect(manual.json().transaction).toMatchObject({
      category: 'health',
      categorySource: 'manual',
      ruleId: null,
    });

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/v1/transactions/${first!.id}`,
      headers: auth(),
      payload: { category: 'bitcoin' },
    });
    expect(invalid.statusCode).toBe(400);
  });
});

describe('budgets', () => {
  it('sets, validates and clears monthly budgets', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const put = await app.inject({
      method: 'PUT',
      url: '/v1/budgets/groceries',
      headers: auth(),
      payload: { limitCents: 40000 },
    });
    expect(put.statusCode).toBe(200);
    expect(await repo.listBudgets('alice')).toEqual([
      { category: 'groceries', limitCents: 40000, updatedAt: '2026-10-10T12:00:00.000Z' },
    ]);

    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/v1/budgets/groceries',
          headers: auth(),
          payload: { limitCents: -5 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/v1/budgets/spaceships',
          headers: auth(),
          payload: { limitCents: 500 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/v1/budgets/groceries',
          headers: auth(),
          payload: { limitCents: '400' },
        })
      ).statusCode,
    ).toBe(400);

    const del = await app.inject({
      method: 'DELETE',
      url: '/v1/budgets/groceries',
      headers: auth(),
    });
    expect(del.statusCode).toBe(204);
    expect(await repo.listBudgets('alice')).toEqual([]);
  });
});

describe('demo session', () => {
  it('seeds the demo account once and returns a custom token', async () => {
    let repo: MemoryRepo;
    ({ app, repo } = await makeApp());
    const first = await app.inject({ method: 'POST', url: '/v1/demo/session' });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ customToken: 'custom:demo-user:{"demo":true}', reseeded: true });

    const txs = await repo.listTransactions('demo-user');
    expect(txs.length).toBeGreaterThan(100); // 90 days of history in tests
    expect(await repo.listBudgets('demo-user')).toHaveLength(6);
    expect(await repo.listRules('demo-user')).toHaveLength(2);
    expect(
      byMerchant(txs, 'Corner Bodega').every(
        (t) => t.category === 'groceries' && t.categorySource === 'rule',
      ),
    ).toBe(true);
    expect(txs.some((t) => t.categorySource === 'manual')).toBe(true);
    expect((await repo.getUser('demo-user'))?.isDemo).toBe(true);

    const second = await app.inject({ method: 'POST', url: '/v1/demo/session' });
    expect(second.json().reseeded).toBe(false);
  });

  it('re-seeds when stale, discarding visitor changes', async () => {
    let repo: MemoryRepo;
    let clock = new Date('2026-10-10T12:00:00.000Z');
    ({ app, repo } = await makeApp({ now: () => clock }));
    await app.inject({ method: 'POST', url: '/v1/demo/session' });
    await app.inject({
      method: 'DELETE',
      url: '/v1/budgets/groceries',
      headers: auth('demo-user'),
    });
    expect(await repo.listBudgets('demo-user')).toHaveLength(5);

    clock = new Date('2026-10-10T19:00:00.000Z');
    const res = await app.inject({ method: 'POST', url: '/v1/demo/session' });
    expect(res.json().reseeded).toBe(true);
    expect(await repo.listBudgets('demo-user')).toHaveLength(6);
  });
});
