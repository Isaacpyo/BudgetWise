import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8787),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Comma-separated list of browser origins allowed by CORS. */
    ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://localhost:3000'),

    /** "plaid" talks to Plaid's sandbox; "mock" uses the built-in sandbox bank. */
    PLAID_PROVIDER: z.enum(['plaid', 'mock']).default('mock'),
    PLAID_CLIENT_ID: z.string().optional(),
    PLAID_SECRET: z.string().optional(),
    /** Sandbox only, by design (see README "stack substitutions"). */
    PLAID_ENV: z.literal('sandbox').default('sandbox'),
    /** Deep-link prefixes Hosted Link may redirect back to. */
    HOSTED_LINK_REDIRECT_PREFIXES: z.string().default('budgetwise://,exp://,exps://'),

    FIREBASE_PROJECT_ID: z.string().default('demo-budgetwise'),
    /** Service-account JSON, raw or base64-encoded. Not needed with emulators. */
    FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),

    /** 32-byte key (base64 or hex) used to encrypt Plaid access tokens at rest. */
    TOKEN_ENCRYPTION_KEY: z.string().optional(),

    DEMO_UID: z.string().min(1).default('demo-user'),
    DEMO_RESEED_HOURS: z.coerce.number().min(0).default(6),
    SEED_DEMO_ON_START: bool,
  })
  .superRefine((env, ctx) => {
    if (env.PLAID_PROVIDER === 'plaid' && (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['PLAID_PROVIDER'],
        message: 'PLAID_CLIENT_ID and PLAID_SECRET are required when PLAID_PROVIDER=plaid',
      });
    }
    const usingEmulators = !!env.FIRESTORE_EMULATOR_HOST;
    if (env.NODE_ENV === 'production' && !usingEmulators) {
      if (!env.TOKEN_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['TOKEN_ENCRYPTION_KEY'],
          message: 'TOKEN_ENCRYPTION_KEY is required in production',
        });
      }
      if (!env.FIREBASE_SERVICE_ACCOUNT) {
        ctx.addIssue({
          code: 'custom',
          path: ['FIREBASE_SERVICE_ACCOUNT'],
          message: 'FIREBASE_SERVICE_ACCOUNT is required in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface Config {
  env: Env['NODE_ENV'];
  port: number;
  host: string;
  logLevel: Env['LOG_LEVEL'];
  allowedOrigins: string[];
  plaid: {
    provider: 'plaid' | 'mock';
    clientId: string | null;
    secret: string | null;
    hostedLinkRedirectPrefixes: string[];
  };
  firebase: {
    projectId: string;
    serviceAccount: string | null;
    usingEmulators: boolean;
  };
  tokenEncryptionKey: string | null;
  demo: { uid: string; reseedHours: number; seedOnStart: boolean };
}

const list = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    plaid: {
      provider: env.PLAID_PROVIDER,
      clientId: env.PLAID_CLIENT_ID ?? null,
      secret: env.PLAID_SECRET ?? null,
      hostedLinkRedirectPrefixes: list(env.HOSTED_LINK_REDIRECT_PREFIXES),
    },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      serviceAccount: env.FIREBASE_SERVICE_ACCOUNT ?? null,
      usingEmulators: !!env.FIRESTORE_EMULATOR_HOST,
    },
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY ?? null,
    demo: {
      uid: env.DEMO_UID,
      reseedHours: env.DEMO_RESEED_HOURS,
      seedOnStart: env.SEED_DEMO_ON_START,
    },
  };
}
