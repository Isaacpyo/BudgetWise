import type { Config } from '../config';
import type { SecretBox } from '../crypto';
import type { Providers } from '../providers';
import type { Repo } from '../repo/types';

export interface AuthService {
  verifyIdToken(token: string): Promise<{ uid: string; email: string | null }>;
  createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string>;
}

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** Everything the services need, injected so tests can swap any piece. */
export interface Deps {
  config: Config;
  repo: Repo;
  providers: Providers;
  secrets: SecretBox;
  auth: AuthService;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: Logger;
}

export const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
