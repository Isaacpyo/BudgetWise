import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke test of the main flow against the real stack:
 * web export (static) → API (mock Plaid provider) → Firebase Auth + Firestore emulators.
 *
 * Emulators must be running (`npm run emulators`), or use `npm run e2e:ci`
 * which wraps the run in `firebase emulators:exec`.
 * Build the web app first with `npm run build:web:e2e`.
 */
const CI = !!process.env.CI;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    // 375px wide: the smallest layout we support.
    {
      name: 'mobile-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:e2e --workspace @budgetwise/api',
      url: 'http://localhost:8787/health',
      reuseExistingServer: !CI,
      timeout: 60_000,
      env: {
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
        FIREBASE_PROJECT_ID: 'demo-budgetwise',
        PLAID_PROVIDER: 'mock',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npx serve -s apps/web/dist -l 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !CI,
      timeout: 30_000,
    },
  ],
});
