import { test, expect, type Page } from '@playwright/test';

/**
 * Brand Funnel Tracker — E2E.
 *
 * Smoke tier (default): no writes, no LLM — verifies every screen renders and the key
 * controls behave as a customer expects (tab switching, coverage view, channel persistence,
 * upload-dialog validation). Safe to run repeatedly against any environment.
 *
 * Full-flow tier (@slow, opt-in via E2E_RUN_LLM=1): uploads an asset and runs the real
 * Claude audit — writes to the test account + costs tokens, so it is skipped by default.
 */
const FUNNEL = '/v2/funnel';

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** The empty state (with a "Create an avatar" CTA) renders only when no avatar is selected. */
async function hasAvatar(page: Page): Promise<boolean> {
  return !(await page.getByRole('button', { name: /create an avatar/i }).isVisible().catch(() => false));
}

test.describe('Brand Funnel Tracker', () => {
  test('route renders with no uncaught errors', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(FUNNEL);
    await expect(
      page.getByRole('heading', { name: /your funnel, mapped/i })
        .or(page.getByRole('button', { name: /create an avatar/i })),
    ).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the four screens render and switch', async ({ page }) => {
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    for (const name of [/funnel map/i, /what needs work/i, /in progress/i, /testing/i]) {
      const tab = page.getByRole('tab', { name });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute('data-state', 'active');
    }
  });

  test('Funnel Map shows coverage meter + stat cards', async ({ page }) => {
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    await page.getByRole('tab', { name: /funnel map/i }).click();
    await expect(page.getByText(/on-brand coverage/i)).toBeVisible();
    await expect(page.getByText('Tracked')).toBeVisible();
    await expect(page.getByText('Aligned')).toBeVisible();
  });

  test('channel toggle persists across reload', async ({ page }) => {
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    const amazon = page.getByRole('button', { name: 'amazon', exact: true });
    await expect(amazon).toBeVisible();
    const classBefore = await amazon.getAttribute('class');
    await amazon.click();
    await page.reload();
    const classAfter = await page.getByRole('button', { name: 'amazon', exact: true }).getAttribute('class');
    expect(classAfter, 'toggled channel state should survive reload (localStorage)').not.toEqual(classBefore);
    // restore
    await page.getByRole('button', { name: 'amazon', exact: true }).click();
  });

  test('upload dialog: required description gates "Upload & audit"', async ({ page }) => {
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    await page.getByRole('button', { name: /upload asset/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const submit = page.getByRole('button', { name: /upload & audit/i });
    await expect(submit).toBeDisabled();

    // Content present but description too short → still disabled + a hint shows.
    await page.locator('#asset-copy').fill('Welcome email hero copy.');
    await page.locator('#asset-desc').fill('short');
    await expect(submit).toBeDisabled();
    await expect(page.getByText(/8\+ characters/i)).toBeVisible();

    // Pick a touchpoint + a valid description → enabled.
    await page.locator('#asset-touchpoint').click();
    await page.getByRole('option').first().click();
    await page.locator('#asset-desc').fill('Welcome email hero copy for collectors');
    await expect(submit).toBeEnabled();
  });

  test('empty In Progress / Testing tabs show guidance copy', async ({ page }) => {
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    await page.getByRole('tab', { name: /in progress/i }).click();
    // Either real items or the empty-state guidance.
    await expect(page.getByText(/awaiting audit|run audit|nothing/i).first()).toBeVisible();
  });

  test('@slow paste-text asset audits end to end (E2E_RUN_LLM=1)', async ({ page }) => {
    test.skip(process.env.E2E_RUN_LLM !== '1', 'set E2E_RUN_LLM=1 to run the real Claude audit');
    await page.goto(FUNNEL);
    test.skip(!(await hasAvatar(page)), 'test account has no avatar');
    await page.getByRole('button', { name: /upload asset/i }).click();
    await page.locator('#asset-copy').fill('Guaranteed best card sleeves on earth. Buy now, limited stock!');
    await page.locator('#asset-touchpoint').click();
    await page.getByRole('option', { name: /amazon listing/i }).first().click();
    await page.locator('#asset-desc').fill('Amazon listing bullets for the premium binder');
    await page.getByRole('button', { name: /upload & audit/i }).click();
    // The real audit returns a status toast (aligned/misaligned/stale or a /100 score).
    await expect(page.getByText(/aligned|misaligned|stale|\/\s*100|\d{1,3}\s*\/\s*100/i).first())
      .toBeVisible({ timeout: 60_000 });
  });
});
