// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseFunnelAnalytics,
  parseContentPerformance,
  getCampaignMetrics,
  getFunnelPieceMetrics,
  ingestCampaignAnalytics,
} from '../service/analyticsIngestService.js';
import type { CampaignMetricRow, MetricInput } from '../service/campaignTypes.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

/**
 * Minimal chainable stub: the `campaigns` table resolves via maybeSingle() (ownership check),
 * the `campaign_metrics` table resolves via order() (the metrics read). All filters are no-ops.
 */
function stub(campaign: unknown, metrics: CampaignMetricRow[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.gte = () => b;
    b.lte = () => b;
    b.maybeSingle = () => Promise.resolve({ data: campaign, error: null });
    b.order = () => Promise.resolve({ data: table === 'campaign_metrics' ? metrics : [], error: null });
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

function metricRow(over: Partial<CampaignMetricRow>): CampaignMetricRow {
  return {
    id: 'm',
    user_id: 'user-1',
    campaign_id: 'c1',
    brand_asset_id: null,
    channel: 'amazon',
    metric_name: 'impressions',
    metric_value: 0,
    funnel_stage: null,
    journey_stage: null,
    measured_date: '2026-01-01',
    granularity: 'daily',
    source: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

afterEach(() => __setUserSupabaseFactory(null));

describe('parseFunnelAnalytics', () => {
  it('emits one metric per finite field; drops absent fields (no fabricated 0s)', () => {
    const out = parseFunnelAnalytics({
      monthly: [{ month: '2026-01-01', impressions: 1000, ctr: 0.02, orders: undefined }],
    });
    const names = out.map((m) => m.metric_name).sort();
    expect(names).toEqual(['ctr', 'impressions']);
    expect(out.every((m) => m.channel === 'amazon' && m.granularity === 'snapshot')).toBe(true);
  });

  it('stamps funnel_stage for stage snapshots and ignores stages without an as_of date', () => {
    expect(parseFunnelAnalytics({ stages: [{ stage: 'visibility', impressions: 5 }] })).toEqual([]);
    const out = parseFunnelAnalytics({
      as_of: '2026-02-01',
      stages: [{ stage: 'visibility', impressions: 5 }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].funnel_stage).toBe('visibility');
  });
});

describe('parseContentPerformance', () => {
  it('maps per-channel content fields and drops NaN/undefined', () => {
    const out = parseContentPerformance([
      { channel: 'blog', measured_date: '2026-03-01', views: 200, calls_booked: 3, revenue: Number.NaN },
    ]);
    expect(out.map((m) => m.metric_name).sort()).toEqual(['calls_booked', 'views']);
    expect(out.every((m) => m.channel === 'blog')).toBe(true);
  });
});

describe('getCampaignMetrics', () => {
  it('returns honest no_data when there are no metrics', async () => {
    __setUserSupabaseFactory(() => stub({ id: 'c1' }, []));
    const res = await runWithIdentity(authed, () => getCampaignMetrics({ campaignId: 'c1' }));
    expect(res).toMatchObject({ ok: true, count: 0, note: 'no_data' });
  });

  it('sums additive metrics and means ratio metrics in a by_channel breakdown', async () => {
    const rows = [
      metricRow({ channel: 'amazon', metric_name: 'impressions', metric_value: 100 }),
      metricRow({ channel: 'amazon', metric_name: 'impressions', metric_value: 50 }),
      metricRow({ channel: 'amazon', metric_name: 'ctr', metric_value: 0.02 }),
      metricRow({ channel: 'amazon', metric_name: 'ctr', metric_value: 0.04 }),
    ];
    __setUserSupabaseFactory(() => stub({ id: 'c1' }, rows));
    const res = await runWithIdentity(authed, () =>
      getCampaignMetrics({ campaignId: 'c1', breakdown: 'by_channel' }),
    );
    expect(res.breakdown).toEqual([
      { key: 'amazon', metrics: { impressions: 150, ctr: 0.03 } },
    ]);
  });

  it('raises when the campaign is not owned / absent', async () => {
    __setUserSupabaseFactory(() => stub(null, []));
    await expect(
      runWithIdentity(authed, () => getCampaignMetrics({ campaignId: 'nope' })),
    ).rejects.toThrow(/not found or not owned/);
  });
});

/**
 * Richer chainable stub: dispatches per table for the funnel-piece paths.
 *   campaigns      → maybeSingle() (ownership check)
 *   brand_assets   → .in() (funnel-piece ownership check) resolves the owned set
 *   campaign_metrics → upsert().select() (ingest) OR select()…order() (read)
 * `capture.upsertRows` records the rows handed to upsert so a test can assert what was written.
 */
function richStub(
  opts: {
    campaign?: unknown;
    brandAssets?: Array<{ id: string }>;
    upserted?: CampaignMetricRow[];
    metrics?: CampaignMetricRow[];
  },
  capture?: { upsertRows?: unknown[] },
): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    let upsertMode = false;
    const b: Record<string, unknown> = {};
    b.select = () =>
      upsertMode ? Promise.resolve({ data: opts.upserted ?? [], error: null }) : b;
    b.upsert = (rows: unknown[]) => {
      upsertMode = true;
      if (capture) capture.upsertRows = rows;
      return b;
    };
    b.eq = () => b;
    b.gte = () => b;
    b.lte = () => b;
    b.in = () => Promise.resolve({ data: opts.brandAssets ?? [], error: null });
    b.maybeSingle = () => Promise.resolve({ data: opts.campaign ?? null, error: null });
    b.order = () =>
      Promise.resolve({ data: table === 'campaign_metrics' ? opts.metrics ?? [] : [], error: null });
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

describe('ingestCampaignAnalytics (funnel-piece + windsor)', () => {
  it('attaches brand_asset_id/journey_stage and stamps source=windsor', async () => {
    const cap: { upsertRows?: Array<Record<string, unknown>> } = {};
    __setUserSupabaseFactory(() =>
      richStub(
        {
          campaign: { id: 'c1' },
          brandAssets: [{ id: 'ba1' }],
          upserted: [metricRow({ brand_asset_id: 'ba1', source: 'windsor', metric_name: 'clicks', metric_value: 500 })],
        },
        cap,
      ),
    );
    const rows: MetricInput[] = [
      {
        channel: 'amazon',
        metric_name: 'clicks',
        metric_value: 500,
        measured_date: '2026-06-01',
        brand_asset_id: 'ba1',
        journey_stage: 'awareness',
      },
    ];
    const res = await runWithIdentity(authed, () => ingestCampaignAnalytics('c1', rows, 'windsor'));
    expect(res).toMatchObject({ ok: true, ingested: 1 });
    expect(cap.upsertRows?.[0]).toMatchObject({
      brand_asset_id: 'ba1',
      journey_stage: 'awareness',
      source: 'windsor',
    });
  });

  it('rejects a metric that references a brand_asset the caller does not own', async () => {
    __setUserSupabaseFactory(() => richStub({ campaign: { id: 'c1' }, brandAssets: [] }));
    const rows: MetricInput[] = [
      {
        channel: 'amazon',
        metric_name: 'clicks',
        metric_value: 10,
        measured_date: '2026-06-01',
        brand_asset_id: 'foreign',
      },
    ];
    await expect(
      runWithIdentity(authed, () => ingestCampaignAnalytics('c1', rows)),
    ).rejects.toThrow(/brand_asset\) not found or not owned/);
  });
});

describe('getFunnelPieceMetrics', () => {
  it('returns the latest value per metric and derives cvr/aov', async () => {
    const rows = [
      // service orders measured_date desc — stub returns newest-first as given
      metricRow({ brand_asset_id: 'ba1', metric_name: 'clicks', metric_value: 1000, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'clicks', metric_value: 800, measured_date: '2026-06-01' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'orders', metric_value: 50, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'revenue', metric_value: 2500, measured_date: '2026-06-10' }),
    ];
    __setUserSupabaseFactory(() => richStub({ brandAssets: [{ id: 'ba1' }], metrics: rows }));
    const res = await runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'ba1' }));
    expect(res.count).toBe(4);
    expect(res.latest.clicks).toEqual({ value: 1000, measured_date: '2026-06-10' });
    expect(res.derived.cvr).toBeCloseTo(0.05); // 50 / 1000
    expect(res.derived.aov).toBe(50); // 2500 / 50
  });

  it('derives acos/roas/cpc when spend + revenue + clicks are present', async () => {
    const rows = [
      metricRow({ brand_asset_id: 'ba1', metric_name: 'spend', metric_value: 100, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'revenue', metric_value: 400, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'clicks', metric_value: 200, measured_date: '2026-06-10' }),
    ];
    __setUserSupabaseFactory(() => richStub({ brandAssets: [{ id: 'ba1' }], metrics: rows }));
    const res = await runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'ba1' }));
    expect(res.derived.acos).toBeCloseTo(0.25); // spend 100 / revenue 400
    expect(res.derived.roas).toBe(4); // revenue 400 / spend 100
    expect(res.derived.cpc).toBeCloseTo(0.5); // spend 100 / clicks 200
  });

  it('OMITS acos/roas/cpc when an input is absent (honest — never fabricates)', async () => {
    // revenue + clicks present, spend absent ⇒ none of acos/roas/cpc derivable.
    const rows = [
      metricRow({ brand_asset_id: 'ba1', metric_name: 'revenue', metric_value: 400, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'clicks', metric_value: 200, measured_date: '2026-06-10' }),
    ];
    __setUserSupabaseFactory(() => richStub({ brandAssets: [{ id: 'ba1' }], metrics: rows }));
    const res = await runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'ba1' }));
    expect(res.derived.acos).toBeUndefined();
    expect(res.derived.roas).toBeUndefined();
    expect(res.derived.cpc).toBeUndefined();
  });

  it('OMITS cpc and roas on a zero divisor (no divide-by-zero / Infinity)', async () => {
    // clicks 0 ⇒ cpc omitted; spend 0 ⇒ roas omitted (but acos still derivable: spend/revenue).
    const rows = [
      metricRow({ brand_asset_id: 'ba1', metric_name: 'spend', metric_value: 0, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'revenue', metric_value: 400, measured_date: '2026-06-10' }),
      metricRow({ brand_asset_id: 'ba1', metric_name: 'clicks', metric_value: 0, measured_date: '2026-06-10' }),
    ];
    __setUserSupabaseFactory(() => richStub({ brandAssets: [{ id: 'ba1' }], metrics: rows }));
    const res = await runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'ba1' }));
    expect(res.derived.cpc).toBeUndefined(); // clicks === 0
    expect(res.derived.roas).toBeUndefined(); // spend === 0
    expect(res.derived.acos).toBe(0); // spend 0 / revenue 400 — a legitimate 0, not fabricated
  });

  it('returns honest no_data for an owned piece with no metrics', async () => {
    __setUserSupabaseFactory(() => richStub({ brandAssets: [{ id: 'ba1' }], metrics: [] }));
    const res = await runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'ba1' }));
    expect(res).toMatchObject({ ok: true, count: 0, note: 'no_data' });
    expect(res.derived).toEqual({});
  });

  it('rejects a funnel piece the caller does not own', async () => {
    __setUserSupabaseFactory(() => richStub({ brandAssets: [] }));
    await expect(
      runWithIdentity(authed, () => getFunnelPieceMetrics({ brandAssetId: 'foreign' })),
    ).rejects.toThrow(/not found or not owned/);
  });
});
