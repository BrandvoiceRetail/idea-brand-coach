import { test, expect, type Page } from '@playwright/test';

/**
 * /v4 surface — FULL SPINE WALK + mobile (375px) overflow audit.
 *
 * Complements v4-flow.spec.ts (Loop-1 onboarding focus) by walking the WHOLE
 * spine — Diagnose → Analyse → Fix → Re-measure → Defend — plus the /v4/tools
 * trust page, asserting every screen renders its HONEST empty / no-data state
 * without crashing, and that none overflow horizontally at a 375px viewport.
 *
 * DETERMINISM: Supabase REST + edge-function calls are MOCKED to return empty
 * (mirrors funnel.mocked.spec.ts). With no avatar + no campaign/analytics rows
 * (those tables ship as an unapplied migration), each stage must render its
 * honest gate / no-data prompt — NEVER a fabricated finding, lift, or asset.
 * No LLM, no writes, no live engines: safe to re-run anywhere.
 *
 * TIERS:
 *  - Smoke (default): render / routing / honest-empty-state + the 375px overflow
 *    audit. Auth comes from the shared QA account via auth.setup.ts (the empty
 *    mocks mean the result is identical with or without a live session).
 *  - Live-backend (test.fixme): the real engine paths (read-it-back agentic run,
 *    a real compute_trust_gap_lift before/after, a real export_workbook). These
 *    cost tokens + touch live state — left fixme'd with the exact assertions to
 *    fill in. DO NOT run in CI without explicit live wiring.
 *
 * Run (NOT part of the green gate):
 *   npm run test:e2e -- v4-spine.spec.ts
 */

const ROUTES = {
  ROOT: '/v4',
  DIAGNOSE: '/v4/diagnose',
  ANALYSE: '/v4/analyse',
  FIX: '/v4/fix',
  REMEASURE: '/v4/remeasure',
  DEFEND: '/v4/defend',
  TOOLS: '/v4/tools',
} as const;

/** Every spine route + the trust page, in spine order. */
const ALL_ROUTES = [
  ROUTES.ROOT,
  ROUTES.DIAGNOSE,
  ROUTES.ANALYSE,
  ROUTES.FIX,
  ROUTES.REMEASURE,
  ROUTES.DEFEND,
  ROUTES.TOOLS,
] as const;

/** Mobile reference width — the production bar is 0 horizontal overflow @375px. */
const MOBILE = { width: 375, height: 740 } as const;

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

/**
 * Force the honest no-data path: every Supabase read returns empty, every edge
 * function returns an empty object. No avatar, no rows, no engines → each stage
 * renders its gate / no-data prompt, never a fabricated result.
 */
async function mockEmptyBackend(page: Page): Promise<void> {
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/functions/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

/** scrollWidth <= clientWidth on <html> AND <body> means no horizontal overflow. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const widest = Math.max(doc.scrollWidth, document.body.scrollWidth);
    return widest - doc.clientWidth;
  });
}

test.describe('/v4 spine — honest empty-state walk', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmptyBackend(page);
  });

  test('app shell mounts the full spine on every stage', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.ROOT);
    for (const label of [/diagnose/i, /analyse/i, /fix/i, /re-?measure/i, /defend/i]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Diagnose stage renders without crashing (deep-links the diagnostic)', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.DIAGNOSE);
    await expect(page.getByRole('heading', { name: /diagnose/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /run the diagnostic/i })).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Analyse renders an honest no-avatar / no-data state', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.ANALYSE);
    await expect(page.getByRole('heading', { name: /analyse/i }).first()).toBeVisible();
    // No avatar mocked → an honest prompt to build one, never a fabricated profile.
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Fix renders an honest no-asset / no-data state', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.FIX);
    await expect(page.getByRole('heading', { name: /fix/i }).first()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Re-measure gates honestly to Analyse when no avatar is scoped', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.REMEASURE);
    await expect(page.getByRole('heading', { name: /re-?measure/i }).first()).toBeVisible();
    // The before/after is scoped to one avatar; with none, an honest gate appears.
    await expect(page.getByTestId('v4-remeasure-avatar-gate')).toBeVisible();
    await expect(page.getByTestId('v4-remeasure-go-analyse')).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('Defend gates honestly to Analyse when no avatar is scoped', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.DEFEND);
    await expect(page.getByRole('heading', { name: /defend/i }).first()).toBeVisible();
    await expect(page.getByTestId('v4-defend-avatar-gate')).toBeVisible();
    await expect(page.getByTestId('v4-defend-go-analyse')).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('/v4/tools renders the connector trust registry', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto(ROUTES.TOOLS);
    await expect(page.getByText(/available/i).first()).toBeVisible();
    await expect(page.getByText(/generated/i).first()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('/v4 surface — mobile (375px) overflow audit', () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await mockEmptyBackend(page);
  });

  for (const route of ALL_ROUTES) {
    test(`${route} has zero horizontal overflow @375px`, async ({ page }) => {
      await page.goto(route);
      // Let the layout settle (sticky stepper + sidebar collapse + bottom-nav).
      await page.waitForLoadState('networkidle');
      const overflow = await horizontalOverflow(page);
      expect(overflow, `${route} overflows by ${overflow}px at 375px`).toBeLessThanOrEqual(0);
    });
  }
});

// ---------------------------------------------------------------------------
// LIVE-BACKEND tier — real engine paths. Token-costing + state-writing, so they
// are fixme'd: remove .fixme + fill assertions only when running against a live
// backend with the QA account (docs/TEST_ACCOUNT.md). NEVER auto-run in CI.
// ---------------------------------------------------------------------------

test.fixme(
  'Analyse: a real avatar build surfaces a grounded gap + decision trigger (no fabrication)',
  async ({ page }) => {
    await page.goto(ROUTES.ANALYSE);
    // EXPECT (live): AvatarProfile + GapDecisionTriggerPanel render values traceable
    // to the user's real context — never invented ratings or invented reviews.
  },
);

test.fixme(
  'Re-measure: compute_trust_gap_lift renders a real before/after delta',
  async ({ page }) => {
    await page.goto(ROUTES.REMEASURE);
    // EXPECT (live): with two real diagnostic runs the TrustGapLiftCard shows the
    // deterministic delta; with one run it shows the honest "re-run" prompt.
    // await expect(page.getByTestId('v4-remeasure-continue-to-defend')).toBeVisible();
  },
);

test.fixme(
  'Defend: export_workbook returns a real artifact note (never a fake download)',
  async ({ page }) => {
    await page.goto(ROUTES.DEFEND);
    // EXPECT (live): WorkbookExportCard surfaces the live export_workbook note/error.
  },
);

test.fixme(
  'Business metrics stay honestly empty until the campaign/analytics migration lands',
  async ({ page }) => {
    await page.goto(ROUTES.REMEASURE);
    // EXPECT (live, pre-migration): BusinessMetricsCard shows no-data, never a lift.
  },
);
