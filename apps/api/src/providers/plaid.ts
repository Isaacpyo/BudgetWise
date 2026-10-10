import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
  TransactionsUpdateStatus,
  type AccountBase,
  type Transaction as PlaidTransaction,
} from 'plaid';
import { toCents, type Account } from '@budgetwise/core';
import type { BankProvider, HostedLinkResult, ProviderTransaction, SyncResult } from './types';

/** The subset of PlaidApi we use — lets tests pass a stub. */
export type PlaidClient = Pick<
  PlaidApi,
  'linkTokenCreate' | 'linkTokenGet' | 'itemPublicTokenExchange' | 'transactionsSync' | 'itemRemove'
>;

export function createPlaidClient(clientId: string, secret: string): PlaidClient {
  return new PlaidApi(
    new Configuration({
      // Sandbox only: this project never talks to Plaid production.
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret },
        timeout: 30_000,
      },
    }),
  );
}

const MAX_SYNC_PAGES = 50;

export function normalizeTransaction(t: PlaidTransaction): ProviderTransaction {
  const pfc = t.personal_finance_category;
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    name: t.name || t.merchant_name || 'Unknown',
    merchantName: t.merchant_name ?? null,
    amountCents: toCents(t.amount),
    currency: t.iso_currency_code ?? t.unofficial_currency_code ?? 'USD',
    date: t.date,
    pending: t.pending,
    plaidCategory: pfc ? { primary: pfc.primary, detailed: pfc.detailed } : null,
    logoUrl: t.logo_url ?? null,
  };
}

export function normalizeAccount(a: AccountBase): Account {
  return {
    id: a.account_id,
    name: a.official_name || a.name,
    mask: a.mask,
    type: String(a.type),
    subtype: a.subtype ? String(a.subtype) : null,
  };
}

export class PlaidProvider implements BankProvider {
  readonly name = 'plaid' as const;

  constructor(private readonly client: PlaidClient) {}

  async createLinkToken(input: {
    userId: string;
    mode: 'web' | 'hosted';
    completionRedirectUri?: string;
  }) {
    const { data } = await this.client.linkTokenCreate({
      client_name: 'BudgetWise',
      language: 'en',
      country_codes: [CountryCode.Us],
      user: { client_user_id: input.userId },
      products: [Products.Transactions],
      transactions: { days_requested: 180 },
      ...(input.mode === 'hosted'
        ? {
            hosted_link: {
              is_mobile_app: true,
              ...(input.completionRedirectUri
                ? { completion_redirect_uri: input.completionRedirectUri }
                : {}),
            },
          }
        : {}),
    });
    return {
      linkToken: data.link_token,
      expiration: data.expiration,
      hostedLinkUrl: data.hosted_link_url ?? null,
    };
  }

  async exchangePublicToken(publicToken: string) {
    const { data } = await this.client.itemPublicTokenExchange({ public_token: publicToken });
    return { accessToken: data.access_token, itemId: data.item_id };
  }

  async getHostedLinkResult(linkToken: string): Promise<HostedLinkResult | null> {
    const { data } = await this.client.linkTokenGet({ link_token: linkToken });
    for (const session of data.link_sessions ?? []) {
      const result = session.results?.item_add_results?.[0];
      if (result?.public_token) {
        const inst = result.institution;
        return {
          publicToken: result.public_token,
          institution: inst?.name ? { id: inst.institution_id ?? null, name: inst.name } : null,
        };
      }
      // Older sessions report through on_success.
      if (session.on_success?.public_token) {
        const inst = session.on_success.metadata?.institution;
        return {
          publicToken: session.on_success.public_token,
          institution: inst?.name ? { id: inst.institution_id ?? null, name: inst.name } : null,
        };
      }
    }
    return null;
  }

  /**
   * Drain /transactions/sync from `cursor`. If Plaid reports a mutation during
   * pagination we restart from the original cursor, as Plaid recommends.
   */
  async syncTransactions(accessToken: string, cursor: string | null): Promise<SyncResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.syncOnce(accessToken, cursor);
      } catch (err) {
        const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data
          ?.error_code;
        if (code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') throw err;
      }
    }
    throw new Error('Transactions changed repeatedly during sync; try again shortly');
  }

  private async syncOnce(accessToken: string, cursor: string | null): Promise<SyncResult> {
    const added: ProviderTransaction[] = [];
    const modified: ProviderTransaction[] = [];
    const removedIds: string[] = [];
    let accounts: Account[] = [];
    let next = cursor ?? undefined;
    let ready = true;

    for (let page = 0; page < MAX_SYNC_PAGES; page++) {
      const { data } = await this.client.transactionsSync({
        access_token: accessToken,
        ...(next ? { cursor: next } : {}),
        count: 500,
        options: { include_personal_finance_category: true },
      });
      added.push(...data.added.map(normalizeTransaction));
      modified.push(...data.modified.map(normalizeTransaction));
      removedIds.push(...data.removed.map((r) => r.transaction_id));
      if (data.accounts.length) accounts = data.accounts.map(normalizeAccount);
      ready = data.transactions_update_status !== TransactionsUpdateStatus.NotReady;
      next = data.next_cursor;
      if (!data.has_more) break;
    }

    return { added, modified, removedIds, accounts, nextCursor: next ?? '', ready };
  }

  async removeItem(accessToken: string) {
    await this.client.itemRemove({ access_token: accessToken });
  }
}
