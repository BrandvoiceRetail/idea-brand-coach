import { test, expect, type Page } from '@playwright/test';

/**
 * Avatar-dependent UI, with the Supabase REST layer MOCKED so the full tracker renders
 * deterministically — no shared-account writes, no LLM. This is how we exercise the
 * screens the live suite skips when the QA account has no avatar.
 */
const AVATAR_ID = '00000000-0000-4000-8000-000000000abc';

const mockAvatar = {
  id: AVATAR_ID, user_id: 'qa-user', name: 'Funnel Tracker QA', description: null,
  demographics: {}, psychographics: {}, buying_behavior: {}, voice_of_customer: null,
  is_template: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};
const mockAssets = [
  {
    id: 'asset-1', avatar_id: AVATAR_ID, touchpoint_id: 'amazon_main_image', stage: 'awareness',
    context_description: 'Amazon main image hero', content_text: null, storage_path: null,
    signature_version: 'sigv1', status: 'misaligned', overall_score: 48, previous_score: 41,
    audit_result: { scores: { i: 52, d: 33, e: 55, a: 50 }, rationale: 'Generic studio shot.', fix: 'Lead with the collector trigger, not the product.' },
    superseded_by: null, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'asset-2', avatar_id: AVATAR_ID, touchpoint_id: 'amazon_brand_story', stage: 'consideration',
    context_description: 'A+ brand story', content_text: null, storage_path: null,
    signature_version: 'sigv1', status: 'aligned', overall_score: 88, previous_score: null,
    audit_result: { scores: { i: 88, d: 85, e: 90, a: 88 }, rationale: 'On-brand.', fix: 'Hold.' },
    superseded_by: null, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  },
];

async function mockSupabase(page: Page): Promise<void> {
  await page.route('**/rest/v1/avatars*', (route) => {
    const url = route.request().url();
    if (url.includes('is_template=eq.true')) return route.fulfill({ json: [] });
    return route.fulfill({ json: [mockAvatar] });
  });
  await page.route('**/rest/v1/brand_assets*', (route) => route.fulfill({ json: mockAssets }));
  await page.route('**/rest/v1/brand_tests*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/signatures*', (route) => route.fulfill({ json: [{ id: 'sigv1', artifact_id: 'sigv1' }] }));
}

test.describe('Funnel Tracker (mocked data)', () => {
  test.beforeEach(async ({ page }) => { await mockSupabase(page); });

  test('renders the tracker with the selected avatar', async ({ page }) => {
    await page.goto('/v2/funnel');
    await expect(page.getByRole('heading', { name: /your funnel, mapped/i })).toBeVisible();
    await expect(page.getByText(/Funnel Tracker QA/i)).toBeVisible();
  });

  test('four tabs render with correct counts and switch', async ({ page }) => {
    await page.goto('/v2/funnel');
    await expect(page.getByRole('tab', { name: /what needs work \(1\)/i })).toBeVisible();
    for (const name of [/funnel map/i, /what needs work/i, /in progress/i, /testing/i]) {
      const tab = page.getByRole('tab', { name });
      await tab.click();
      await expect(tab).toHaveAttribute('data-state', 'active');
    }
  });

  test('Funnel Map: coverage + stat cards + a status cell', async ({ page }) => {
    await page.goto('/v2/funnel');
    await page.getByRole('tab', { name: /funnel map/i }).click();
    await expect(page.getByText(/on-brand coverage/i)).toBeVisible();
    await expect(page.getByText('Tracked')).toBeVisible();
    // The Amazon main image asset is misaligned with score 48.
    await expect(page.getByText('Amazon main image')).toBeVisible();
    await expect(page.getByText('48', { exact: true }).first()).toBeVisible();
  });

  test('What Needs Work: row + fix + dimension bars + actions', async ({ page }) => {
    await page.goto('/v2/funnel');
    await page.getByRole('tab', { name: /what needs work/i }).click();
    await expect(page.getByText(/lead with the collector trigger/i)).toBeVisible();
    await expect(page.getByText(/was 41 → now 48/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /fix with coach/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /re-run audit/i })).toBeVisible();
  });

  test('Fix dialog opens with rationale + rewrite + test fields', async ({ page }) => {
    await page.goto('/v2/funnel');
    await page.getByRole('tab', { name: /what needs work/i }).click();
    await page.getByRole('button', { name: /fix with coach/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /generate on-brand rewrite/i })).toBeVisible();
    await expect(page.getByText(/the fix \(hypothesis\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /open test/i })).toBeDisabled();
  });

  test('channel toggle persists across reload', async ({ page }) => {
    await page.goto('/v2/funnel');
    const amazon = page.getByRole('button', { name: 'amazon', exact: true });
    const before = await amazon.getAttribute('class');
    await amazon.click();
    await page.reload();
    const after = await page.getByRole('button', { name: 'amazon', exact: true }).getAttribute('class');
    expect(after).not.toEqual(before);
  });

  test('upload dialog: required description gates submit', async ({ page }) => {
    await page.goto('/v2/funnel');
    await page.getByRole('button', { name: /upload asset/i }).click();
    const submit = page.getByRole('button', { name: /upload & audit/i });
    await expect(submit).toBeDisabled();
    await page.locator('#asset-copy').fill('Welcome email hero copy.');
    await page.locator('#asset-desc').fill('short');
    await expect(submit).toBeDisabled();
    await expect(page.getByText(/8\+ characters/i)).toBeVisible();
    await page.locator('#asset-touchpoint').click();
    await page.getByRole('option').first().click();
    await page.locator('#asset-desc').fill('Welcome email hero copy for collectors');
    await expect(submit).toBeEnabled();
  });
});
