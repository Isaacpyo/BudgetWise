import type { Account, ItemProvider, PlaidCategory } from '@budgetwise/core';

/** A transaction normalised from any provider (amount in cents, Plaid sign). */
export interface ProviderTransaction {
  id: string;
  accountId: string;
  name: string;
  merchantName: string | null;
  amountCents: number;
  currency: string;
  date: string;
  pending: boolean;
  plaidCategory: PlaidCategory | null;
  logoUrl: string | null;
}

export interface SyncResult {
  added: ProviderTransaction[];
  modified: ProviderTransaction[];
  removedIds: string[];
  accounts: Account[];
  nextCursor: string;
  /** False while the institution is still preparing data (Plaid NOT_READY). */
  ready: boolean;
}

export interface LinkTokenResult {
  linkToken: string;
  expiration: string;
  hostedLinkUrl: string | null;
}

export interface HostedLinkResult {
  publicToken: string;
  institution: { id: string | null; name: string } | null;
}

/**
 * The seam between BudgetWise and a bank-data aggregator. Implemented by the
 * real Plaid sandbox client and by a deterministic mock.
 */
export interface BankProvider {
  readonly name: ItemProvider;
  createLinkToken(input: {
    userId: string;
    mode: 'web' | 'hosted';
    completionRedirectUri?: string;
  }): Promise<LinkTokenResult>;
  exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }>;
  /** Hosted Link: fetch the public token once the user finishes. Null if not finished. */
  getHostedLinkResult(linkToken: string): Promise<HostedLinkResult | null>;
  syncTransactions(accessToken: string, cursor: string | null): Promise<SyncResult>;
  removeItem(accessToken: string): Promise<void>;
}
