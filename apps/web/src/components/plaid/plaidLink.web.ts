import type { LinkTokenResponse } from '@budgetwise/core';
import type { LinkOutcome } from './types';

/** Web: Plaid Link JS drop-in (iframe overlay). */
export const linkMode = 'web' as const;

export function completionRedirectUri(): undefined {
  return undefined;
}

interface PlaidMetadata {
  institution?: { name?: string; institution_id?: string } | null;
}
interface PlaidHandler {
  open(): void;
  destroy(): void;
}
interface PlaidGlobal {
  create(config: {
    token: string;
    onSuccess(publicToken: string, metadata: PlaidMetadata): void;
    onExit(error: { display_message?: string | null; error_message?: string } | null): void;
  }): PlaidHandler;
}

const SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
let scriptPromise: Promise<PlaidGlobal> | null = null;

function loadPlaid(): Promise<PlaidGlobal> {
  const existing = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<PlaidGlobal>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const plaid = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
      if (plaid) resolve(plaid);
      else reject(new Error('Plaid Link failed to initialise'));
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load Plaid Link. Check your connection or ad blocker.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function runPlaidLink(token: LinkTokenResponse): Promise<LinkOutcome> {
  const plaid = await loadPlaid();
  return new Promise<LinkOutcome>((resolve) => {
    const handler = plaid.create({
      token: token.linkToken,
      onSuccess(publicToken, metadata) {
        const inst = metadata.institution;
        resolve({
          kind: 'publicToken',
          publicToken,
          institution: inst?.name ? { id: inst.institution_id ?? null, name: inst.name } : null,
        });
        handler.destroy();
      },
      onExit(error) {
        resolve({
          kind: 'cancelled',
          message: error ? (error.display_message ?? error.error_message ?? null) : null,
        });
        handler.destroy();
      },
    });
    handler.open();
  });
}
