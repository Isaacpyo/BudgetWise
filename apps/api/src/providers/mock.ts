import { randomUUID } from 'node:crypto';
import { addDays, addMonths, isIsoDate, monthBounds, monthOf, toIsoDate } from '@budgetwise/core';
import { AppError } from '../errors';
import { generateDay, MOCK_ACCOUNTS } from './mock-data';
import type { BankProvider, ProviderTransaction, SyncResult } from './types';

export const MOCK_PUBLIC_TOKEN_PREFIX = 'public-mock-';
const ACCESS_PREFIX = 'access-mock-';

export interface MockProviderOptions {
  /**
   * Days of history returned by the first sync. Defaults to six whole
   * calendar months (the current one included), matching the app's charts.
   */
  historyDays?: number;
  /** Injectable clock for tests. */
  now?: () => Date;
}

/**
 * A sandbox bank that needs no keys. It mirrors Plaid's contract closely:
 * opaque link/public/access tokens, cursor-based incremental sync, pending
 * transactions that post on a later sync.
 */
export class MockProvider implements BankProvider {
  readonly name = 'mock' as const;
  private readonly historyDays: number | null;
  private readonly now: () => Date;

  constructor(opts: MockProviderOptions = {}) {
    this.historyDays = opts.historyDays ?? null;
    this.now = opts.now ?? (() => new Date());
  }

  async createLinkToken() {
    return {
      linkToken: `link-mock-${randomUUID()}`,
      expiration: new Date(this.now().getTime() + 30 * 60_000).toISOString(),
      // The app renders its own sandbox-bank sheet for mock link tokens.
      hostedLinkUrl: null,
    };
  }

  async exchangePublicToken(publicToken: string) {
    if (!publicToken.startsWith(MOCK_PUBLIC_TOKEN_PREFIX)) {
      throw new AppError(
        400,
        'INVALID_PUBLIC_TOKEN',
        'That public token was not issued by the sandbox bank',
      );
    }
    const id = randomUUID();
    return { accessToken: `${ACCESS_PREFIX}${id}`, itemId: `item-mock-${id}` };
  }

  async getHostedLinkResult() {
    return null;
  }

  /**
   * Cursor = the last calendar day already delivered. The previous two days
   * are re-sent as `modified` so pending transactions can post.
   */
  async syncTransactions(accessToken: string, cursor: string | null): Promise<SyncResult> {
    this.assertAccessToken(accessToken);
    const today = toIsoDate(this.now());
    const pendingFrom = addDays(today, -1);

    const added: ProviderTransaction[] = [];
    const modified: ProviderTransaction[] = [];

    const validCursor = cursor && isIsoDate(cursor) ? cursor : null;
    const historyStart =
      this.historyDays != null
        ? addDays(today, -this.historyDays + 1)
        : monthBounds(addMonths(monthOf(today), -5)).start;
    const firstNewDay = validCursor ? addDays(validCursor, 1) : historyStart;
    const refreshFrom = validCursor ? addDays(validCursor, -1) : firstNewDay;

    for (let date = refreshFrom; date <= today; date = addDays(date, 1)) {
      const txs = generateDay(accessToken, date, { pending: date >= pendingFrom });
      (date < firstNewDay ? modified : added).push(...txs);
    }

    return {
      added,
      modified,
      removedIds: [],
      accounts: MOCK_ACCOUNTS,
      nextCursor: today,
      ready: true,
    };
  }

  async removeItem(accessToken: string) {
    this.assertAccessToken(accessToken);
  }

  private assertAccessToken(accessToken: string) {
    if (!accessToken.startsWith(ACCESS_PREFIX)) {
      throw new AppError(400, 'INVALID_ACCESS_TOKEN', 'Unknown sandbox access token');
    }
  }
}
