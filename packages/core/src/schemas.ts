/**
 * Request/response contracts shared by the API (validation) and the app
 * (typed client + form validation).
 */
import { z } from 'zod';
import { CATEGORY_IDS } from './categories';
import type { Item } from './types';

export const categoryIdSchema = z.enum(CATEGORY_IDS);

const MAX_CENTS = 100_000_000; // $1,000,000

export const ruleInputSchema = z
  .object({
    field: z.enum(['merchant', 'description']),
    operator: z.enum(['contains', 'equals', 'startsWith']),
    pattern: z
      .string()
      .trim()
      .min(2, 'Pattern must be at least 2 characters')
      .max(80, 'Pattern must be at most 80 characters'),
    category: categoryIdSchema,
    minAmountCents: z.number().int().min(0).max(MAX_CENTS).nullable().default(null),
    maxAmountCents: z.number().int().min(0).max(MAX_CENTS).nullable().default(null),
  })
  .refine(
    (r) => r.minAmountCents == null || r.maxAmountCents == null || r.minAmountCents <= r.maxAmountCents,
    { message: 'Minimum amount must not exceed maximum', path: ['maxAmountCents'] },
  );
export type RuleInput = z.input<typeof ruleInputSchema>;

export const ruleUpdateSchema = z
  .object({
    field: z.enum(['merchant', 'description']).optional(),
    operator: z.enum(['contains', 'equals', 'startsWith']).optional(),
    pattern: z.string().trim().min(2).max(80).optional(),
    category: categoryIdSchema.optional(),
    minAmountCents: z.number().int().min(0).max(MAX_CENTS).nullable().optional(),
    maxAmountCents: z.number().int().min(0).max(MAX_CENTS).nullable().optional(),
    priority: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .refine((r) => Object.keys(r).length > 0, { message: 'Nothing to update' });
export type RuleUpdate = z.input<typeof ruleUpdateSchema>;

export const budgetInputSchema = z.object({
  limitCents: z.number().int().min(100, 'Budget must be at least $1').max(MAX_CENTS),
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const transactionPatchSchema = z.object({
  /** null resets the transaction to automatic categorisation. */
  category: categoryIdSchema.nullable(),
  /** Also create a rule so future transactions from this merchant follow. */
  createRule: z.boolean().default(false),
});
export type TransactionPatch = z.input<typeof transactionPatchSchema>;

export const linkTokenRequestSchema = z.object({
  /** web: Plaid Link JS. hosted: Plaid Hosted Link (Expo Go / native). */
  mode: z.enum(['web', 'hosted']).default('web'),
  /** Deep link Hosted Link returns to after completion (native only). */
  completionRedirectUri: z.string().max(500).optional(),
});
export type LinkTokenRequest = z.input<typeof linkTokenRequestSchema>;

export const exchangeRequestSchema = z.object({
  publicToken: z.string().min(8).max(200),
  institution: z
    .object({
      id: z.string().max(100).nullable().optional(),
      name: z.string().max(200),
    })
    .nullable()
    .optional(),
});
export type ExchangeRequest = z.input<typeof exchangeRequestSchema>;

export const hostedLinkCompleteSchema = z.object({
  linkToken: z.string().min(8).max(200),
});

export interface LinkTokenResponse {
  provider: 'plaid' | 'mock';
  linkToken: string;
  expiration: string;
  /** Present for mode=hosted with the real provider. */
  hostedLinkUrl: string | null;
}

export interface SyncSummary {
  added: number;
  modified: number;
  removed: number;
  /** False when the bank is still preparing historical data (Plaid NOT_READY). */
  ready: boolean;
}

export interface ExchangeResponse {
  item: Item;
  sync: SyncSummary;
}

export interface SyncResponse {
  items: Array<{ itemId: string; ok: boolean; error: string | null } & SyncSummary>;
}

export interface DemoSessionResponse {
  customToken: string;
  reseeded: boolean;
}

export interface HealthResponse {
  ok: true;
  provider: 'plaid' | 'mock';
  version: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
