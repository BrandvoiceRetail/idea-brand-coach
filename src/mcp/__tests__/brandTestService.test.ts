// @vitest-environment node
/**
 * GAP B — experiment-lifecycle milestone stamping (`updateTestMilestone` over `brand_tests`).
 *
 * brand_tests stored status + baseline/result but NOT the milestone DATES the tester journey
 * needs: ASSET_CREATED and ASSET_LIVE (they start the re-measure clock + are the case-study data,
 * migration 20260628000000). These tests prove the service stamps each date onto its column,
 * promotes a still-`draft` test to `running` on ASSET_LIVE, and refuses a foreign/absent test_id
 * (RLS ownership) rather than cross-tenant writing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateTestMilestone, BrandTestError } from '../service/brandTestService.js';
import type { BrandTestMilestoneRow } from '../service/campaignTypes.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

/**
 * Chainable brand_tests stub mirroring updateTestMilestone's two calls to `from('brand_tests')`:
 *   read   → select().eq().maybeSingle()              → resolves `existing`
 *   update → update().eq().select().maybeSingle()     → resolves `{ ...existing, ...patch }`
 * `capture.patch` records the update payload so a test can assert which date/status was written.
 */
function brandTestStub(
  existing: BrandTestMilestoneRow | null,
  capture?: { patch?: Record<string, unknown> },
): SupabaseClient {
  const from = (): Record<string, unknown> => {
    let updateMode = false;
    let patch: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.update = (p: Record<string, unknown>) => {
      updateMode = true;
      patch = p;
      if (capture) capture.patch = p;
      return b;
    };
    b.maybeSingle = () => {
      if (!updateMode) return Promise.resolve({ data: existing, error: null });
      if (!existing) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: { ...existing, ...patch }, error: null });
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

function testRow(over: Partial<BrandTestMilestoneRow>): BrandTestMilestoneRow {
  return { id: 't1', status: 'draft', asset_created_at: null, asset_live_at: null, ...over };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('updateTestMilestone', () => {
  it('stamps asset_created_at on the asset_created milestone (status untouched)', async () => {
    const cap: { patch?: Record<string, unknown> } = {};
    __setUserSupabaseFactory(() => brandTestStub(testRow({ status: 'draft' }), cap));
    const res = await runWithIdentity(authed, () => updateTestMilestone({ testId: 't1', milestone: 'asset_created', at: '2026-06-28T10:00:00Z' }));
    expect(res).toMatchObject({ ok: true, test_id: 't1', milestone: 'asset_created', at: '2026-06-28T10:00:00Z', status: 'draft' });
    expect(cap.patch).toEqual({ asset_created_at: '2026-06-28T10:00:00Z' });
  });

  it('stamps asset_live_at AND promotes a draft test to running on asset_live', async () => {
    const cap: { patch?: Record<string, unknown> } = {};
    __setUserSupabaseFactory(() => brandTestStub(testRow({ status: 'draft' }), cap));
    const res = await runWithIdentity(authed, () => updateTestMilestone({ testId: 't1', milestone: 'asset_live', at: '2026-06-29T00:00:00Z' }));
    expect(res.status).toBe('running');
    expect(cap.patch).toEqual({ asset_live_at: '2026-06-29T00:00:00Z', status: 'running' });
  });

  it('does NOT touch status on asset_live when the test is already running', async () => {
    const cap: { patch?: Record<string, unknown> } = {};
    __setUserSupabaseFactory(() => brandTestStub(testRow({ status: 'running' }), cap));
    const res = await runWithIdentity(authed, () => updateTestMilestone({ testId: 't1', milestone: 'asset_live', at: '2026-06-29T00:00:00Z' }));
    expect(res.status).toBe('running');
    expect(cap.patch).toEqual({ asset_live_at: '2026-06-29T00:00:00Z' }); // no status promotion
  });

  it('defaults `at` to now() when omitted', async () => {
    const cap: { patch?: Record<string, unknown> } = {};
    __setUserSupabaseFactory(() => brandTestStub(testRow({}), cap));
    const before = Date.now();
    const res = await runWithIdentity(authed, () => updateTestMilestone({ testId: 't1', milestone: 'asset_created' }));
    expect(Number.isNaN(Date.parse(res.at))).toBe(false);
    expect(Date.parse(res.at)).toBeGreaterThanOrEqual(before - 1000);
    expect(cap.patch?.asset_created_at).toBe(res.at);
  });

  it('rejects a foreign / absent test_id (RLS ownership — clean not-found, no write)', async () => {
    __setUserSupabaseFactory(() => brandTestStub(null));
    await expect(
      runWithIdentity(authed, () => updateTestMilestone({ testId: 'foreign', milestone: 'asset_live' })),
    ).rejects.toBeInstanceOf(BrandTestError);
    await expect(
      runWithIdentity(authed, () => updateTestMilestone({ testId: 'foreign', milestone: 'asset_live' })),
    ).rejects.toThrow(/not found or not owned/);
  });
});
