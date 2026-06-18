import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for the Brand Funnel Tracker.
 *
 * Pattern mirrored from agency-operations/mango-income-tool's pytest-playwright suite
 * (session server fixture, console-error guards, isolated runs), adapted to this app's
 * React/Vite/TS stack with @playwright/test and the project's Supabase TEST_ACCOUNT login.
 *
 * Default target: a locally-started dev server (port 8080). Point at any deployment with
 * E2E_BASE_URL (e.g. the prod URL) to run against it instead of starting a server.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  // Auto-start the dev server only when targeting localhost (not when E2E_BASE_URL is set).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
