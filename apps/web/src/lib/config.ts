import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Public runtime configuration. EXPO_PUBLIC_* values are inlined at build
 * time, so each must be read with a literal `process.env.X` expression.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';

/**
 * In Expo Go on a phone, "localhost" is the phone. When the API URL points at
 * localhost, reuse the dev server's LAN host instead.
 */
function resolveApiUrl(url: string): string {
  if (Platform.OS === 'web' || !/\/\/(localhost|127\.0\.0\.1)/.test(url)) return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devHost ? url.replace(/\/\/(localhost|127\.0\.0\.1)/, `//${devHost}`) : url;
}

const useEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

export const config = {
  apiUrl: resolveApiUrl(rawApiUrl).replace(/\/$/, ''),
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-budgetwise',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || undefined,
  },
  useEmulators,
  emulatorHost: resolveApiUrl(
    `http://${process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost'}`,
  ).replace('http://', ''),
  repoUrl: 'https://github.com/temitopeagbola/BudgetWise',
} as const;
