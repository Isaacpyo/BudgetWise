import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createSecretBox } from '../src/crypto';
import { createProviders } from '../src/providers';
import { MockProvider } from '../src/providers/mock';
import type { BankProvider } from '../src/providers/types';
import { MemoryRepo } from '../src/repo/memory';
import type { Deps } from '../src/services/deps';

export const FIXED_NOW = new Date('2026-10-10T12:00:00.000Z');

export const silentLog = { info() {}, warn() {}, error() {} };

/** Fake Firebase auth: a bearer token "uid:<uid>" authenticates as <uid>. */
export const fakeAuth = {
  async verifyIdToken(token: string) {
    if (!token.startsWith('uid:')) throw new Error('bad token');
    const uid = token.slice(4);
    return { uid, email: `${uid}@example.com` };
  },
  async createCustomToken(uid: string, claims?: Record<string, unknown>) {
    return `custom:${uid}:${JSON.stringify(claims ?? {})}`;
  },
};

export function makeDeps(
  overrides: { env?: Record<string, string>; plaid?: BankProvider; now?: () => Date } = {},
) {
  const now = overrides.now ?? (() => FIXED_NOW);
  const config = loadConfig({
    NODE_ENV: 'test',
    PLAID_PROVIDER: overrides.plaid ? 'plaid' : 'mock',
    ...(overrides.plaid ? { PLAID_CLIENT_ID: 'test', PLAID_SECRET: 'test' } : {}),
    ALLOWED_ORIGINS: 'http://localhost:8081',
    ...overrides.env,
  });
  const repo = new MemoryRepo();
  const deps: Deps = {
    config,
    repo,
    providers: createProviders(config, {
      mock: new MockProvider({ now, historyDays: 90 }),
      ...(overrides.plaid ? { plaid: overrides.plaid } : {}),
    }),
    secrets: createSecretBox(randomBytes(32)),
    auth: fakeAuth,
    now,
    sleep: async () => {},
    log: silentLog,
  };
  return { deps, repo };
}

export async function makeApp(overrides: Parameters<typeof makeDeps>[0] = {}) {
  const { deps, repo } = makeDeps(overrides);
  const app = await buildApp(deps, { logger: false, rateLimitMax: 1000 });
  return { app, deps, repo };
}

export const auth = (uid = 'alice') => ({ authorization: `Bearer uid:${uid}` });
