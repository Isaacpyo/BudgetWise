import { describe, expect, it, vi } from 'vitest';
import { normalizeTransaction, PlaidProvider, type PlaidClient } from '../src/providers/plaid';

function plaidTx(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: 'tx_1',
    account_id: 'acc_1',
    amount: 12.34,
    iso_currency_code: 'USD',
    unofficial_currency_code: null,
    date: '2026-10-01',
    name: 'Starbucks',
    merchant_name: 'Starbucks',
    pending: false,
    logo_url: 'https://plaid-merchant-logos.plaid.com/starbucks.png',
    personal_finance_category: {
      primary: 'FOOD_AND_DRINK',
      detailed: 'FOOD_AND_DRINK_COFFEE',
      confidence_level: 'VERY_HIGH',
    },
    ...overrides,
  };
}

const account = {
  account_id: 'acc_1',
  name: 'Plaid Checking',
  official_name: 'Plaid Gold Standard 0% Interest Checking',
  mask: '0000',
  type: 'depository',
  subtype: 'checking',
  balances: {},
};

function stub(overrides: Partial<Record<keyof PlaidClient, unknown>>) {
  return overrides as unknown as PlaidClient;
}

describe('normalizeTransaction', () => {
  it('converts amounts to cents and keeps the personal finance category', () => {
    expect(normalizeTransaction(plaidTx() as never)).toEqual({
      id: 'tx_1',
      accountId: 'acc_1',
      name: 'Starbucks',
      merchantName: 'Starbucks',
      amountCents: 1234,
      currency: 'USD',
      date: '2026-10-01',
      pending: false,
      plaidCategory: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_COFFEE' },
      logoUrl: 'https://plaid-merchant-logos.plaid.com/starbucks.png',
    });
  });

  it('handles missing optional fields', () => {
    const t = normalizeTransaction(
      plaidTx({
        merchant_name: undefined,
        personal_finance_category: null,
        logo_url: undefined,
        iso_currency_code: null,
        unofficial_currency_code: 'BTC',
      }) as never,
    );
    expect(t.merchantName).toBeNull();
    expect(t.plaidCategory).toBeNull();
    expect(t.currency).toBe('BTC');
  });
});

describe('PlaidProvider', () => {
  it('creates sandbox link tokens for transactions, with Hosted Link for native', async () => {
    const linkTokenCreate = vi.fn().mockResolvedValue({
      data: {
        link_token: 'link-sandbox-1',
        expiration: '2026-10-10T13:00:00Z',
        hosted_link_url: 'https://hosted.plaid.com/link/x',
      },
    });
    const p = new PlaidProvider(stub({ linkTokenCreate }));

    const hosted = await p.createLinkToken({
      userId: 'alice',
      mode: 'hosted',
      completionRedirectUri: 'budgetwise://plaid',
    });
    expect(hosted).toEqual({
      linkToken: 'link-sandbox-1',
      expiration: '2026-10-10T13:00:00Z',
      hostedLinkUrl: 'https://hosted.plaid.com/link/x',
    });
    const req = linkTokenCreate.mock.calls[0]?.[0];
    expect(req.user).toEqual({ client_user_id: 'alice' });
    expect(req.products).toEqual(['transactions']);
    expect(req.hosted_link).toEqual({
      is_mobile_app: true,
      completion_redirect_uri: 'budgetwise://plaid',
    });

    await p.createLinkToken({ userId: 'alice', mode: 'web' });
    expect(linkTokenCreate.mock.calls[1]?.[0].hosted_link).toBeUndefined();
  });

  it('drains paginated syncs and reports NOT_READY', async () => {
    const transactionsSync = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          added: [plaidTx()],
          modified: [],
          removed: [],
          accounts: [account],
          next_cursor: 'c1',
          has_more: true,
          transactions_update_status: 'INITIAL_UPDATE_COMPLETE',
        },
      })
      .mockResolvedValueOnce({
        data: {
          added: [plaidTx({ transaction_id: 'tx_2' })],
          modified: [plaidTx({ transaction_id: 'tx_0' })],
          removed: [{ transaction_id: 'tx_old', account_id: 'acc_1' }],
          accounts: [],
          next_cursor: 'c2',
          has_more: false,
          transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
        },
      });
    const p = new PlaidProvider(stub({ transactionsSync }));
    const result = await p.syncTransactions('access-sandbox-1', 'c0');

    expect(transactionsSync.mock.calls.map((c) => c[0].cursor)).toEqual(['c0', 'c1']);
    expect(result.added.map((t) => t.id)).toEqual(['tx_1', 'tx_2']);
    expect(result.modified.map((t) => t.id)).toEqual(['tx_0']);
    expect(result.removedIds).toEqual(['tx_old']);
    expect(result.accounts).toEqual([
      {
        id: 'acc_1',
        name: 'Plaid Gold Standard 0% Interest Checking',
        mask: '0000',
        type: 'depository',
        subtype: 'checking',
      },
    ]);
    expect(result.nextCursor).toBe('c2');
    expect(result.ready).toBe(true);

    const notReady = new PlaidProvider(
      stub({
        transactionsSync: vi.fn().mockResolvedValue({
          data: {
            added: [],
            modified: [],
            removed: [],
            accounts: [],
            next_cursor: '',
            has_more: false,
            transactions_update_status: 'NOT_READY',
          },
        }),
      }),
    );
    expect((await notReady.syncTransactions('access', null)).ready).toBe(false);
  });

  it('restarts from the original cursor on mutation during pagination', async () => {
    const mutation = Object.assign(new Error('mutation'), {
      response: { data: { error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' } },
    });
    const page = {
      added: [plaidTx()],
      modified: [],
      removed: [],
      accounts: [],
      next_cursor: 'c9',
      has_more: false,
      transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE',
    };
    const transactionsSync = vi
      .fn()
      .mockRejectedValueOnce(mutation)
      .mockResolvedValueOnce({ data: page });
    const result = await new PlaidProvider(stub({ transactionsSync })).syncTransactions(
      'access',
      'c0',
    );
    expect(transactionsSync.mock.calls.map((c) => c[0].cursor)).toEqual(['c0', 'c0']);
    expect(result.nextCursor).toBe('c9');
  });

  it('reads Hosted Link results from link_sessions', async () => {
    const linkTokenGet = vi.fn().mockResolvedValue({
      data: {
        link_sessions: [
          {
            link_session_id: 's1',
            results: {
              item_add_results: [
                {
                  public_token: 'public-sandbox-9',
                  accounts: [],
                  institution: { name: 'First Platypus Bank', institution_id: 'ins_109508' },
                },
              ],
            },
          },
        ],
      },
    });
    expect(await new PlaidProvider(stub({ linkTokenGet })).getHostedLinkResult('link-1')).toEqual({
      publicToken: 'public-sandbox-9',
      institution: { id: 'ins_109508', name: 'First Platypus Bank' },
    });

    const unfinished = vi
      .fn()
      .mockResolvedValue({ data: { link_sessions: [{ link_session_id: 's1', results: null }] } });
    expect(
      await new PlaidProvider(stub({ linkTokenGet: unfinished })).getHostedLinkResult('link-1'),
    ).toBeNull();
  });

  it('exchanges public tokens and removes items', async () => {
    const itemPublicTokenExchange = vi
      .fn()
      .mockResolvedValue({ data: { access_token: 'access-sandbox-1', item_id: 'item_1' } });
    const itemRemove = vi.fn().mockResolvedValue({ data: {} });
    const p = new PlaidProvider(stub({ itemPublicTokenExchange, itemRemove }));
    expect(await p.exchangePublicToken('public-sandbox-1')).toEqual({
      accessToken: 'access-sandbox-1',
      itemId: 'item_1',
    });
    await p.removeItem('access-sandbox-1');
    expect(itemRemove).toHaveBeenCalledWith({ access_token: 'access-sandbox-1' });
  });
});
