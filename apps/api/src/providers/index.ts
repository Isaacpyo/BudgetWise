import type { ItemProvider } from '@budgetwise/core';
import type { Config } from '../config';
import { MockProvider } from './mock';
import { createPlaidClient, PlaidProvider } from './plaid';
import type { BankProvider } from './types';

export interface Providers {
  /** The provider new links use (PLAID_PROVIDER). */
  active: BankProvider;
  /** The provider an existing item was created with. */
  get(name: ItemProvider): BankProvider;
}

export function createProviders(
  config: Config,
  overrides: Partial<Record<ItemProvider, BankProvider>> = {},
): Providers {
  const mock = overrides.mock ?? new MockProvider();
  let plaid: BankProvider | null = overrides.plaid ?? null;
  if (!plaid && config.plaid.clientId && config.plaid.secret) {
    plaid = new PlaidProvider(createPlaidClient(config.plaid.clientId, config.plaid.secret));
  }

  const get = (name: ItemProvider): BankProvider => {
    if (name === 'mock') return mock;
    if (!plaid) throw new Error('Plaid is not configured (set PLAID_CLIENT_ID and PLAID_SECRET)');
    return plaid;
  };

  return { active: get(config.plaid.provider), get };
}

export type { BankProvider } from './types';
