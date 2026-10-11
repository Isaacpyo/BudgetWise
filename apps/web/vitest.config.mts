import { defineConfig } from 'vitest/config';

// Unit tests for the app's framework-free modules (API client, status store,
// formatting). Screens are covered by the Playwright e2e suite.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
