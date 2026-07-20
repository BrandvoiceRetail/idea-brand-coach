import { test, expect, type Page } from '@playwright/test';

/**
 * /v4 surface — E2E SKELETON.
 *
 * Covers the "one and only" surface: Landing front-door → forced /v4 →
 * Loop 1 (megaprompt paste → read-it-back build-theatre → confirm gate →
 * Context Card "I won't ask twice") → continue to Diagnose → /v4/tools
 * connector trust page.
 *
 * TIERS (mirrors funnel.spec.ts):
 *  - Smoke (default): pure render/routing/structure. No writes, no LLM. Safe to
 *    re-run anywhere. Auth comes from the shared QA account via auth.setup.ts
 *    (docs/TEST_ACCOUNT.md) per playwright.config.ts.
 *  - Live-backend (test.fixme): the read-it-back run drives the real coach
 *    build-theatre (agentic timeline + grounded findings) and the Context Card
 *    promotion. These call backend/LLM seams — left as test.fixme with the
 *    exact assertions to fill in once run against a live backend. DO NOT run
 *    these in CI without E2E_RUN_LLM wiring; they cost tokens + write state.
 *
 * Run (do NOT auto-run as part of the green gate):
 *   npm run test:e2e -- v4-flow.spec.ts          # local dev server (port 8080)
 *   E2E_BASE_URL=https://ideabrandcoach.icodemybusiness.com npm run test:e2e -- v4-flow.spec.ts
 */

const V4_ROOT = '/v4';
const V4_TOOLS = '/v4/tools';

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/** Paste a minimal, grounded megaprompt and click "Read it back to me". */
async function pasteMegaprompt(page: Page): Promise<void> {
  const box = page.getByTestId('megaprompt-input');
  await expect(box).toBeVisible();
  await box.fill(
    "We're RestWell. We sell a natural sleep supplement for busy parents who " +
      "can't switch off at night. We mostly sell on Amazon and want more repeat orders.",
  );
  await page.getByTestId('read-it-back-button').click();
}

test.describe('/v4 surface — Loop 1', () => {
  test('Landing "/" force-redirects an authed user into the single surface (pre-GA default)', async ({
    page,
  }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');
    // VersionGate -> isPreGa() -> navigate(CURRENT_SURFACE='/v5', replace) for an authed user.
    await expect(page).toHaveURL(/\/v5\/?$/);
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Onboarding renders the megaprompt paste box + read-it-back CTA', async ({ page }) => {
    await page.goto(V4_ROOT);
    await expect(page.getByTestId('megaprompt-input')).toBeVisible();
    const cta = page.getByTestId('read-it-back-button');
    await expect(cta).toBeVisible();
    // CTA is gated until something is pasted.
    await expect(cta).toBeDisabled();
  });

  test('the app shell mounts the spine (Diagnose → Analyse → Fix → Re-measure → Defend)', async ({
    page,
  }) => {
    await page.goto(V4_ROOT);
    for (const label of [/diagnose/i, /analyse/i, /fix/i, /re-?measure/i, /defend/i]) {
      // Spine appears in the sidebar (desktop) and/or bottom-nav (mobile); first() is fine.
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('/v4/tools renders the connector trust registry (tool list + counts)', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(V4_TOOLS);
    // Generated registry page: Available / Roadmap status badges + a generated-from note.
    await expect(page.getByText(/available/i).first()).toBeVisible();
    await expect(page.getByText(/generated/i).first()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // LIVE-BACKEND tier — the build-theatre + Context Card promotion.
  // These exercise the read-it-back agentic run (real, grounded findings — never
  // fabricated) and the confirm gate. They need a live backend/LLM seam, so they
  // are fixme'd: fill the assertions in + remove .fixme when running live.
  // ---------------------------------------------------------------------------

  test.fixme(
    'read-it-back streams the build-theatre timeline with a real finding per step',
    async ({ page }) => {
      await page.goto(V4_ROOT);
      await pasteMegaprompt(page);
      // The agentic timeline mounts (read-only, shows each tool/step).
      await expect(page.getByTestId('reflection-run')).toBeVisible();
      await expect(page.getByTestId('reflection-timeline')).toBeVisible();
      // EXPECT (live): at least one step with a grounded finding traceable to the
      // paste (e.g. "RestWell", "sleep supplement", "Amazon"). NO fabricated text.
      // const findings = page.locator('[data-testid^="reflection-finding-"]');
      // await expect(findings.first()).toBeVisible();
      // await expect(findings.first()).toContainText(/RestWell|sleep|Amazon/i);
    },
  );

  test.fixme(
    'confirm gate: "Sounds right" promotes findings into the Context Card',
    async ({ page }) => {
      await page.goto(V4_ROOT);
      await pasteMegaprompt(page);
      await expect(page.getByTestId('reflection-confirm-gate')).toBeVisible();
      await page.getByRole('button', { name: /sounds right/i }).click();
      // Context Card ("I won't ask twice") + completeness ring carry the context forward.
      await expect(page.getByText(/i won't ask twice/i)).toBeVisible();
      await expect(page.getByTestId('completeness-ring')).toBeVisible();
    },
  );

  test.fixme('"Not quite" drops into the Context Card to edit', async ({ page }) => {
    await page.goto(V4_ROOT);
    await pasteMegaprompt(page);
    await page.getByRole('button', { name: /not quite/i }).click();
    await expect(page.getByText(/i won't ask twice/i)).toBeVisible();
  });

  test.fixme(
    'Continue to Diagnose is enabled once context is complete, then routes to /v4/diagnose',
    async ({ page }) => {
      await page.goto(V4_ROOT);
      await pasteMegaprompt(page);
      await page.getByRole('button', { name: /sounds right/i }).click();
      const cont = page.getByTestId('continue-to-diagnose');
      await expect(cont).toBeEnabled(); // gated on allFilled
      await cont.click();
      await expect(page).toHaveURL(/\/v4\/diagnose/);
    },
  );

  test.fixme(
    'no-data honesty: a megaprompt the coach cannot ground surfaces needs-input, not a fabricated finding',
    async ({ page }) => {
      await page.goto(V4_ROOT);
      const box = page.getByTestId('megaprompt-input');
      await box.fill('.');
      await page.getByTestId('read-it-back-button').click();
      // EXPECT (live): reflection-needs-input OR reflection-run-error — never an invented finding.
      await expect(page.getByTestId('reflection-needs-input')).toBeVisible();
    },
  );

  test.fixme(
    'connector instructions: /v4/tools links to the claude.ai MCP connector add-flow',
    async ({ page }) => {
      // The trust page should expose how to add the IDEA Brand Coach connector in
      // claude.ai (OAuth). Assert the connect instructions/CTA once that surface lands.
      await page.goto(V4_TOOLS);
      // await expect(page.getByRole('link', { name: /add.*connector|connect/i })).toBeVisible();
    },
  );
});
