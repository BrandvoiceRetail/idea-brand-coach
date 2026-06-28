// @vitest-environment node
/**
 * GAP B (Re-measure) — `getExperimentLift` over brand_tests + campaign_metrics.
 *
 * Closes the before/after loop for a split-test: before = the test's baseline_value (or the
 * latest metric BEFORE asset_created_at), after = the latest metric on/after asset_live_at,
 * read from campaign_metrics windowed by those dates (NO snapshot table). These tests prove
 * the four resolution paths + honest pending + RLS ownership refusal, with NO fabricated values.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getExperimentLift, BrandTestError, mapMetricTypeToName } from '../service/brandTestService.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface TestRow {
  id: string;
  asset_id: string;
  metric_type: string | null;
  baseline_value: number | null;
  asset_created_at: string | null;
  asset_live_at: string | null;
  status: string;
}

function testRow(over: Partial<TestRow>): TestRow {
  return {
    id: 't1',
    asset_id: 'asset-1',
    metric_type: 'conversion_rate',
    baseline_value: null,
    asset_created_at: '2026-06-01T00:00:00Z',
    asset_live_at: '2026-06-10T00:00:00Z',
    status: 'running',
    ...over,
  };
}

/**
 * Stub mirroring getExperimentLift's reads:
 *   brand_tests:      select().eq().maybeSingle()                         → `test`
 *   campaign_metrics: select().eq().eq().[lt|gte]().order().limit().maybeSingle()
 *                     → `preCreate` when .lt() ran (BEFORE window), `postLive` when .gte() ran.
 */
function liftStub(opts: {
  test: TestRow | null;
  preCreate?: { metric_value: number } | null;
  postLive?: { metric_value: number } | null;
}): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    if (table === 'brand_tests') {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: opts.test, error: null });
      return b;
    }
    // campaign_metrics
    let mode: 'before' | 'after' | null = null;
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.lt = () => {
      mode = 'before';
      return b;
    };
    b.gte = () => {
      mode = 'after';
      return b;
    };
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = () => {
      const row = mode === 'before' ? opts.preCreate ?? null : mode === 'after' ? opts.postLive ?? null : null;
      return Promise.resolve({ data: row, error: null });
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

afterEach(() => __setUserSupabaseFactory(null));

describe('mapMetricTypeToName', () => {
  it('maps free-text metric types onto stored metric_names (composite before substring)', () => {
    expect(mapMetricTypeToName('conversion_rate')).toBe('cvr');
    expect(mapMetricTypeToName('unit_session_percentage')).toBe('cvr');
    expect(mapMetricTypeToName('click_through_rate')).toBe('ctr');
    expect(mapMetricTypeToName('revenue')).toBe('revenue');
    expect(mapMetricTypeToName('orders')).toBe('orders');
    expect(mapMetricTypeToName('something_unknown')).toBeNull();
    expect(mapMetricTypeToName(null)).toBeNull();
  });
});

describe('getExperimentLift', () => {
  it('before from baseline_value, after from post-live metric → won', async () => {
    __setUserSupabaseFactory(() =>
      liftStub({ test: testRow({ baseline_value: 0.02 }), postLive: { metric_value: 0.03 } }),
    );
    const res = await runWithIdentity(authed, () => getExperimentLift('t1'));
    expect(res).toMatchObject({
      ok: true,
      metric_name: 'cvr',
      before: 0.02,
      before_source: 'baseline',
      after: 0.03,
      lift: 0.01,
      lift_pct: 0.5,
      status_suggestion: 'won',
    });
  });

  it('before from the pre-create window when no baseline → no_lift on a decline', async () => {
    __setUserSupabaseFactory(() =>
      liftStub({
        test: testRow({ metric_type: 'revenue', baseline_value: null }),
        preCreate: { metric_value: 100 },
        postLive: { metric_value: 90 },
      }),
    );
    const res = await runWithIdentity(authed, () => getExperimentLift('t1'));
    expect(res).toMatchObject({
      metric_name: 'revenue',
      before: 100,
      before_source: 'pre_create_window',
      after: 90,
      lift: -10,
      lift_pct: -0.1,
      status_suggestion: 'no_lift',
    });
  });

  it('honest pending when the asset is not live yet (no after value fabricated)', async () => {
    __setUserSupabaseFactory(() =>
      liftStub({ test: testRow({ baseline_value: 0.02, asset_live_at: null }) }),
    );
    const res = await runWithIdentity(authed, () => getExperimentLift('t1'));
    expect(res.status_suggestion).toBe('pending');
    expect(res.after).toBeNull();
    expect(res.lift).toBeNull();
    expect(res.before).toBe(0.02);
    expect(res.note).toMatch(/not live/);
  });

  it('honest pending when no post-live metric has been pulled yet', async () => {
    __setUserSupabaseFactory(() =>
      liftStub({ test: testRow({ baseline_value: 0.02 }), postLive: null }),
    );
    const res = await runWithIdentity(authed, () => getExperimentLift('t1'));
    expect(res.status_suggestion).toBe('pending');
    expect(res.after).toBeNull();
    expect(res.note).toMatch(/no_data/);
  });

  it('rejects a foreign / absent test_id (RLS ownership — clean not-found)', async () => {
    __setUserSupabaseFactory(() => liftStub({ test: null }));
    await expect(runWithIdentity(authed, () => getExperimentLift('foreign'))).rejects.toBeInstanceOf(
      BrandTestError,
    );
    await expect(runWithIdentity(authed, () => getExperimentLift('foreign'))).rejects.toThrow(
      /not found or not owned/,
    );
  });
});
