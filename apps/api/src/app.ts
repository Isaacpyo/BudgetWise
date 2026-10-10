import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  budgetInputSchema,
  categoryIdSchema,
  exchangeRequestSchema,
  hostedLinkCompleteSchema,
  linkTokenRequestSchema,
  ruleInputSchema,
  ruleUpdateSchema,
  transactionPatchSchema,
  type ApiErrorBody,
  type HealthResponse,
} from '@budgetwise/core';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';
import { AppError, unauthorized } from './errors';
import {
  completeHostedLink,
  createLinkToken,
  exchangePublicToken,
  removeItem,
  syncAll,
} from './services/banking';
import {
  createRule,
  deleteRule,
  setTransactionCategory,
  updateRule,
} from './services/categorisation';
import { createDemoSession } from './services/demo';
import type { Deps } from './services/deps';

export const API_VERSION = '0.1.0';

declare module 'fastify' {
  interface FastifyRequest {
    user: { uid: string; email: string | null } | null;
  }
}

const idParam = z.object({ id: z.string().min(1).max(200) });
const categoryParam = z.object({ category: categoryIdSchema });

function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function requireUser(req: FastifyRequest) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export interface BuildAppOptions {
  /** Disable logging (tests). */
  logger?: boolean;
  /** Override rate limits (tests use generous limits). */
  rateLimitMax?: number;
}

export async function buildApp(deps: Deps, opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: deps.config.logLevel,
            redact: ['req.headers.authorization', 'body.publicToken', 'body.linkToken'],
          },
    trustProxy: true, // Render terminates TLS in front of us.
    bodyLimit: 32 * 1024,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Native apps and curl send no Origin; browsers must be allow-listed.
      if (!origin || deps.config.allowedOrigins.includes(origin)) cb(null, true);
      else cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  const max = opts.rateLimitMax ?? 120;
  // Keyed by client IP (trustProxy makes that the real client behind Render).
  await app.register(rateLimit, { max, timeWindow: '1 minute' });

  app.decorateRequest('user', null);

  app.setErrorHandler((err, req, reply) => {
    let status = 500;
    let body: ApiErrorBody = { error: { code: 'INTERNAL', message: 'Something went wrong' } };

    if (err instanceof ZodError) {
      status = 400;
      body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues[0]?.message ?? 'Invalid request',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      };
    } else if (err instanceof AppError) {
      status = err.statusCode;
      body = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      };
    } else if (
      typeof (err as { statusCode?: number }).statusCode === 'number' &&
      (err as { statusCode: number }).statusCode < 500
    ) {
      // Fastify's own 4xx errors (bad JSON, payload too large, rate limit).
      const e = err as { statusCode: number; code?: string; message: string };
      status = e.statusCode;
      body = { error: { code: e.code ?? 'BAD_REQUEST', message: e.message } };
    }

    if (status >= 500) req.log.error({ err }, 'request failed');
    void reply.status(status).send(body);
  });

  app.get('/health', async (): Promise<HealthResponse> => ({
    ok: true,
    provider: deps.config.plaid.provider,
    version: API_VERSION,
  }));

  // Everything under /v1 needs a Firebase ID token, except the demo login.
  await app.register(
    async (v1) => {
      v1.addHook('onRequest', async (req) => {
        if (req.routeOptions.config && (req.routeOptions.config as { public?: boolean }).public)
          return;
        const token = bearerToken(req);
        if (!token) throw unauthorized();
        try {
          req.user = await deps.auth.verifyIdToken(token);
        } catch {
          throw unauthorized('Your session has expired. Please sign in again.');
        }
      });

      v1.post(
        '/demo/session',
        { config: { public: true, rateLimit: { max: Math.min(max, 10), timeWindow: '1 minute' } } },
        async () => createDemoSession(deps),
      );

      v1.post('/session', async (req) => {
        const user = requireUser(req);
        const existing = await deps.repo.getUser(user.uid);
        if (!existing) {
          await deps.repo.upsertUser(user.uid, {
            uid: user.uid,
            email: user.email,
            isDemo: user.uid === deps.config.demo.uid,
            createdAt: deps.now().toISOString(),
            lastSyncedAt: null,
          });
        }
        return { profile: await deps.repo.getUser(user.uid), provider: deps.config.plaid.provider };
      });

      v1.post(
        '/plaid/link-token',
        { config: { rateLimit: { max: Math.min(max, 20), timeWindow: '1 minute' } } },
        async (req) => {
          const user = requireUser(req);
          return createLinkToken(deps, user.uid, linkTokenRequestSchema.parse(req.body ?? {}));
        },
      );

      v1.post('/plaid/exchange', async (req) => {
        const user = requireUser(req);
        const body = exchangeRequestSchema.parse(req.body);
        return exchangePublicToken(deps, user.uid, body.publicToken, body.institution);
      });

      v1.post('/plaid/hosted-link/complete', async (req) => {
        const user = requireUser(req);
        const body = hostedLinkCompleteSchema.parse(req.body);
        return completeHostedLink(deps, user.uid, body.linkToken);
      });

      v1.post('/sync', async (req) => syncAll(deps, requireUser(req).uid));

      v1.delete('/items/:id', async (req) => {
        const user = requireUser(req);
        return removeItem(deps, user.uid, idParam.parse(req.params).id);
      });

      v1.patch('/transactions/:id', async (req) => {
        const user = requireUser(req);
        const { id } = idParam.parse(req.params);
        const body = transactionPatchSchema.parse(req.body);
        return setTransactionCategory(deps, user.uid, id, body);
      });

      v1.post('/rules', async (req, reply) => {
        const user = requireUser(req);
        const result = await createRule(deps, user.uid, ruleInputSchema.parse(req.body));
        return reply.status(201).send(result);
      });

      v1.patch('/rules/:id', async (req) => {
        const user = requireUser(req);
        const { id } = idParam.parse(req.params);
        return updateRule(deps, user.uid, id, ruleUpdateSchema.parse(req.body));
      });

      v1.delete('/rules/:id', async (req) => {
        const user = requireUser(req);
        return deleteRule(deps, user.uid, idParam.parse(req.params).id);
      });

      v1.put('/budgets/:category', async (req) => {
        const user = requireUser(req);
        const { category } = categoryParam.parse(req.params);
        const { limitCents } = budgetInputSchema.parse(req.body);
        const budget = { category, limitCents, updatedAt: deps.now().toISOString() };
        await deps.repo.saveBudget(user.uid, budget);
        return { budget };
      });

      v1.delete('/budgets/:category', async (req, reply) => {
        const user = requireUser(req);
        const { category } = categoryParam.parse(req.params);
        await deps.repo.deleteBudget(user.uid, category);
        return reply.status(204).send();
      });
    },
    { prefix: '/v1' },
  );

  return app;
}
