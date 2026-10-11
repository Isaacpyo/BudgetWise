import type { LinkTokenResponse } from '@budgetwise/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { LinkOutcome } from './types';

/**
 * iOS/Android (including Expo Go, which can't load Plaid's native SDK): open
 * Plaid Hosted Link in an auth session. Plaid redirects back to our deep link
 * and the API fetches the public token server-side via /link/token/get.
 */
export const linkMode = 'hosted' as const;

export function completionRedirectUri(): string {
  return Linking.createURL('plaid-complete');
}

export async function runPlaidLink(token: LinkTokenResponse): Promise<LinkOutcome> {
  if (!token.hostedLinkUrl) {
    return { kind: 'cancelled', message: 'Plaid did not return a Hosted Link URL.' };
  }
  await WebBrowser.openAuthSessionAsync(token.hostedLinkUrl, completionRedirectUri());
  // Finished or dismissed, the server knows whether an item was added.
  return { kind: 'hostedFinished' };
}
