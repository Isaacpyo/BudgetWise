import type {
  ApiErrorBody,
  Budget,
  CategoryId,
  DemoSessionResponse,
  ExchangeRequest,
  ExchangeResponse,
  HealthResponse,
  LinkTokenRequest,
  LinkTokenResponse,
  Rule,
  RuleInput,
  RuleUpdate,
  SyncResponse,
  Transaction,
  TransactionPatch,
  UserProfile,
} from '@budgetwise/core';
import type { ApiStatusStore } from './api-status';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiClientDeps {
  baseUrl: string;
  /** Firebase ID token for the signed-in user, or null. */
  getToken: () => Promise<string | null>;
  status: ApiStatusStore;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Give up on a single attempt after this long (cold starts can take ~60s). */
  timeoutMs?: number;
}

/** Render answers 502/503/504 from its proxy while a sleeping service boots. */
const BOOTING_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 3;

export function createApiClient(deps: ApiClientDeps) {
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = deps.timeoutMs ?? 90_000;

  async function attempt(method: Method, path: string, body: unknown, token: string | null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(`${deps.baseUrl}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    return deps.status.track(async () => {
      const token = await deps.getToken();
      // Network errors are only retried when repeating the call is harmless.
      const idempotent = method !== 'POST' || path === '/health';
      for (let retry = 0; ; retry++) {
        let res: Response;
        try {
          res = await attempt(method, path, body, token);
        } catch (err) {
          if (idempotent && retry < MAX_RETRIES) {
            await sleep(1500 * (retry + 1));
            continue;
          }
          const aborted = (err as { name?: string })?.name === 'AbortError';
          throw new ApiError(
            0,
            aborted ? 'TIMEOUT' : 'NETWORK',
            aborted
              ? 'The server took too long to respond. Please try again.'
              : 'Could not reach the BudgetWise server. Check your connection and try again.',
          );
        }

        if (BOOTING_STATUSES.has(res.status) && retry < MAX_RETRIES) {
          await sleep(2000 * (retry + 1));
          continue;
        }
        if (res.status === 204) return undefined as T;

        const json = (await res.json().catch(() => null)) as unknown;
        if (!res.ok) {
          const error = (json as ApiErrorBody | null)?.error;
          throw new ApiError(
            res.status,
            error?.code ?? `HTTP_${res.status}`,
            error?.message ?? 'Something went wrong. Please try again.',
          );
        }
        return json as T;
      }
    });
  }

  return {
    health: () => request<HealthResponse>('GET', '/health'),
    demoSession: () => request<DemoSessionResponse>('POST', '/v1/demo/session'),
    session: () =>
      request<{ profile: UserProfile; provider: 'plaid' | 'mock' }>('POST', '/v1/session'),
    linkToken: (input: LinkTokenRequest) =>
      request<LinkTokenResponse>('POST', '/v1/plaid/link-token', input),
    exchange: (input: ExchangeRequest) =>
      request<ExchangeResponse>('POST', '/v1/plaid/exchange', input),
    completeHostedLink: (linkToken: string) =>
      request<ExchangeResponse>('POST', '/v1/plaid/hosted-link/complete', { linkToken }),
    sync: () => request<SyncResponse>('POST', '/v1/sync'),
    removeItem: (itemId: string) =>
      request<{ removedTransactions: number }>('DELETE', `/v1/items/${encodeURIComponent(itemId)}`),
    setTransactionCategory: (id: string, patch: TransactionPatch) =>
      request<{ transaction: Transaction; rule: Rule | null; recategorized: number }>(
        'PATCH',
        `/v1/transactions/${encodeURIComponent(id)}`,
        patch,
      ),
    createRule: (input: RuleInput) =>
      request<{ rule: Rule; recategorized: number }>('POST', '/v1/rules', input),
    updateRule: (id: string, patch: RuleUpdate) =>
      request<{ rule: Rule; recategorized: number }>(
        'PATCH',
        `/v1/rules/${encodeURIComponent(id)}`,
        patch,
      ),
    deleteRule: (id: string) =>
      request<{ recategorized: number }>('DELETE', `/v1/rules/${encodeURIComponent(id)}`),
    setBudget: (category: CategoryId, limitCents: number) =>
      request<{ budget: Budget }>('PUT', `/v1/budgets/${category}`, { limitCents }),
    deleteBudget: (category: CategoryId) => request<void>('DELETE', `/v1/budgets/${category}`),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** A short, user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}
