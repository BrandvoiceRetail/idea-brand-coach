import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Logs in once with the shared QA test account (docs/TEST_ACCOUNT.md) and saves the
 * authenticated storage state for all other specs to reuse. Override with E2E_EMAIL /
 * E2E_PASSWORD env vars if the account rotates.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth', 'user.json');

const EMAIL = process.env.E2E_EMAIL || 'signatureqa20260526@gmail.com';
const PASSWORD = process.env.E2E_PASSWORD || 'Sig-QA-Test-2026!';

setup('authenticate', async ({ page }) => {
  await page.goto('/auth');

  // Switch to the Sign In tab (it may already be active).
  const signInTab = page.getByRole('tab', { name: /^sign in$/i });
  if (await signInTab.count()) await signInTab.click();

  // Scope to the sign-in panel (the one with a password field) so we never touch the
  // magic-link email form or the Google/OAuth buttons. Submit with Enter, not a button —
  // the button name "Sign in" also matches "Sign in with Google".
  const panel = page.locator('[role="tabpanel"]').filter({ has: page.locator('input[type="password"]') });
  await panel.locator('input[type="email"]').first().fill(EMAIL);
  const password = panel.locator('input[type="password"]').first();
  await password.fill(PASSWORD);
  await password.press('Enter');

  // Login succeeds when we navigate away from /auth.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/auth/);

  await page.context().storageState({ path: authFile });
});
