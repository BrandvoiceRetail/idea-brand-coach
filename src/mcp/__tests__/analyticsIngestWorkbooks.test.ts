// @vitest-environment node
/**
 * Ingestion tests against REPRESENTATIVE rows of each real workbook shape + the write path.
 *
 * Covers the three parsers (funnel-tracker stages + monthly, content_tracker, and the
 * Amazon conversion-path report which normalises into the generic metric rows) and the
 * persist path (ownership verification, user_id/campaign_id stamping, upsert-on-natural-key
 * so a re-upload reconciles, and HONEST no_data when nothing parses).
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseFunnelAnalytics,
  parseContentPerformance,
  ingestCampaignAnalytics,
  ingestFunnelAnalytics,
  ingestContentPerformance,
  type FunnelAnalyticsInput,
} from '../service/analyticsIngestService.js';
import type { CampaignMetricRow, MetricInput } from '../service/campaignTypes.js';
import { __setUserSupabaseFactory } from '../supabaseUser.js';
import { runWithIdentity, type Identity } from '../context/identity.js';

const authed: Identity = { userId: 'user-1', token: 'jwt-abc', authenticated: true };

interface UpsertCapture {
  rows: Record<string, unknown>[];
  onConflict?: string;
}

/**
 * Stub for the ingest write path: `campaigns` (ownership maybeSingle) + `campaign_metrics`
 * (upsert→select, captured). The metrics select terminal echoes one row per upserted row so
 * `ingested` reflects the batch size.
 */
function ingestStub(campaign: unknown, capture: UpsertCapture[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    let upserted: Record<string, unknown>[] = [];
    const chain = (): Record<string, unknown> => b;
    b.select = chain;
    b.eq = chain;
    b.gte = chain;
    b.lte = chain;
    b.order = chain;
    b.maybeSingle = () => Promise.resolve({ data: campaign, error: null });
    b.upsert = (rows: Record<string, unknown>[], opts?: { onConflict?: string }) => {
      upserted = rows;
      capture.push({ rows, onConflict: opts?.onConflict });
      return b;
    };
    // select() terminal on campaign_metrics (upsert path) resolves via thenable
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve({
        data: table === 'campaign_metrics' ? upserted.map((r, i) => ({ ...r, id: `m${i}` })) : [],
        error: null,
      }).then(onF, onR);
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

afterEach(() => __setUserSupabaseFactory(null));

// ── PARSER: funnel tracker (infinity_vault_funnel.xlsx) ──────────────────────

describe('parseFunnelAnalytics — funnel-tracker stage band + monthly tracker', () => {
  it('expands all five VISIBILITY..PROFITABILITY stage snapshots, stamping stage + snapshot granularity', () => {
    const input: FunnelAnalyticsInput = {
      as_of: '2026-05-31',
      stages: [
        { stage: 'visibility', impressions: 120_000, ctr: 0.012 },
        { stage: 'clicks', cvr: 0.085 },
        { stage: 'orders', orders: 340 },
        { stage: 'revenue', revenue: 18_900, aov: 55.6 },
        { stage: 'profitability', revenue: 6_200 },
      ],
    };
    const out = parseFunnelAnalytics(input);
    // visibility(2) + clicks(1) + orders(1) + revenue(2) + profitability(1) = 7
    expect(out).toHaveLength(7);
    expect(out.every((m) => m.granularity === 'snapshot' && m.measured_date === '2026-05-31')).toBe(true);
    expect(out.every((m) => m.channel === 'amazon')).toBe(true);
    const stages = new Set(out.map((m) => m.funnel_stage));
    expect(stages).toEqual(new Set(['visibility', 'clicks', 'orders', 'revenue', 'profitability']));
  });

  it('parses the Monthly Tracker shape (impressions/sessions/ctr/cvr/aov/orders/revenue/spend)', () => {
    const out = parseFunnelAnalytics({
      channel: 'amazon',
      monthly: [
        { month: '2026-01-01', impressions: 90_000, sessions: 4_200, ctr: 0.011, cvr: 0.07, aov: 52, orders: 294, revenue: 15_288, spend: 1_900 },
        { month: '2026-02-01', impressions: 95_000, orders: 310, revenue: 16_120 },
      ],
    });
    const jan = out.filter((m) => m.measured_date === '2026-01-01').map((m) => m.metric_name).sort();
    expect(jan).toEqual(['aov', 'ctr', 'cvr', 'impressions', 'orders', 'revenue', 'sessions', 'spend']);
    expect(out.filter((m) => m.measured_date === '2026-02-01')).toHaveLength(3);
  });

  it('honest no_data: an empty/zero-field funnel input parses to zero metrics', () => {
    expect(parseFunnelAnalytics({ as_of: '2026-01-01', stages: [{ stage: 'visibility' }] })).toEqual([]);
    expect(parseFunnelAnalytics({})).toEqual([]);
  });
});

// ── PARSER: content_tracker_v2.xlsx ──────────────────────────────────────────

describe('parseContentPerformance — content_tracker per-channel rows', () => {
  it('maps views/engagement/calls_booked/revenue per channel and drops absent fields', () => {
    const out = parseContentPerformance([
      { channel: 'blog', measured_date: '2026-04-01', views: 1_240, engagement: 86, calls_booked: 4, revenue: 2_400 },
      { channel: 'social', measured_date: '2026-04-01', views: 9_800, engagement: 530 },
    ]);
    expect(out.filter((m) => m.channel === 'blog').map((m) => m.metric_name).sort()).toEqual([
      'calls_booked', 'engagement', 'revenue', 'views',
    ]);
    expect(out.filter((m) => m.channel === 'social')).toHaveLength(2);
    expect(out.every((m) => m.granularity === 'snapshot')).toBe(true);
  });
});

// ── WRITE PATH: ownership + stamping + upsert + no_data ───────────────────────

describe('ingest write path — ownership, stamping, natural-key upsert', () => {
  it('Amazon conversion-path rows ingest as generic metrics, stamped with user_id + campaign_id', async () => {
    const capture: UpsertCapture[] = [];
    __setUserSupabaseFactory(() => ingestStub({ id: 'c1' }, capture));

    // Amazon conversion-path report → Sales/Purchases normalise to revenue/orders metrics.
    const rows: MetricInput[] = [
      { channel: 'amazon', metric_name: 'revenue', metric_value: 4_210.5, measured_date: '2026-06-01' },
      { channel: 'amazon', metric_name: 'orders', metric_value: 77, measured_date: '2026-06-01' },
    ];
    const res = await runWithIdentity(authed, () => ingestCampaignAnalytics('c1', rows));

    expect(res).toMatchObject({ ok: true, ingested: 2 });
    expect(capture[0].onConflict).toContain('campaign_id');
    expect(capture[0].rows.every((r) => r.user_id === 'user-1' && r.campaign_id === 'c1')).toBe(true);
    // default granularity + source applied
    expect(capture[0].rows[0]).toMatchObject({ granularity: 'daily', source: 'manual' });
  });

  it('refuses to attach metrics to a campaign the caller does not own', async () => {
    __setUserSupabaseFactory(() => ingestStub(null, []));
    await expect(
      runWithIdentity(authed, () =>
        ingestCampaignAnalytics('not-mine', [
          { channel: 'paid', metric_name: 'spend', metric_value: 10, measured_date: '2026-06-01' },
        ]),
      ),
    ).rejects.toThrow(/not found or not owned/i);
  });

  it('drops non-finite values and returns ok:false/no_data when nothing is usable', async () => {
    __setUserSupabaseFactory(() => ingestStub({ id: 'c1' }, []));
    const res = await runWithIdentity(authed, () =>
      ingestCampaignAnalytics('c1', [
        { channel: 'paid', metric_name: 'spend', metric_value: Number.NaN, measured_date: '2026-06-01' },
      ]),
    );
    expect(res).toMatchObject({ ok: false, ingested: 0, note: 'no_data' });
  });

  it('ingestFunnelAnalytics stamps source=spreadsheet for parsed funnel rows', async () => {
    const capture: UpsertCapture[] = [];
    __setUserSupabaseFactory(() => ingestStub({ id: 'c1' }, capture));
    const res = await runWithIdentity(authed, () =>
      ingestFunnelAnalytics('c1', { monthly: [{ month: '2026-01-01', impressions: 100, revenue: 50 }] }),
    );
    expect(res.ingested).toBe(2);
    expect(capture[0].rows.every((r) => r.source === 'spreadsheet')).toBe(true);
  });

  it('ingestContentPerformance returns no_data for an all-empty content batch', async () => {
    __setUserSupabaseFactory(() => ingestStub({ id: 'c1' }, []));
    const res = await runWithIdentity(authed, () =>
      ingestContentPerformance('c1', [{ channel: 'blog', measured_date: '2026-04-01' }]),
    );
    expect(res).toMatchObject({ ok: false, ingested: 0, note: 'no_data' });
  });
});

// ── READ: by_date breakdown (complements the by_channel case in the sibling spec) ──

describe('getCampaignMetrics aggregation — by_date', () => {
  it('groups summed counts by measured_date, sorted ascending by key', async () => {
    const { getCampaignMetrics } = await import('../service/analyticsIngestService.js');
    const rows: CampaignMetricRow[] = [
      mRow({ measured_date: '2026-01-02', metric_name: 'orders', metric_value: 5 }),
      mRow({ measured_date: '2026-01-01', metric_name: 'orders', metric_value: 3 }),
      mRow({ measured_date: '2026-01-01', metric_name: 'orders', metric_value: 2 }),
    ];
    __setUserSupabaseFactory(() => ingestStubMetrics({ id: 'c1' }, rows));
    const res = await runWithIdentity(authed, () =>
      getCampaignMetrics({ campaignId: 'c1', breakdown: 'by_date' }),
    );
    expect(res.breakdown).toEqual([
      { key: '2026-01-01', metrics: { orders: 5 } },
      { key: '2026-01-02', metrics: { orders: 5 } },
    ]);
  });
});

function mRow(over: Partial<CampaignMetricRow>): CampaignMetricRow {
  return {
    id: 'm', user_id: 'user-1', campaign_id: 'c1', channel: 'amazon', metric_name: 'orders',
    metric_value: 0, funnel_stage: null, measured_date: '2026-01-01', granularity: 'daily',
    source: 'manual', created_at: '2026-01-01T00:00:00Z', ...over,
  };
}

/** Read-path stub: campaigns maybeSingle (ownership) + campaign_metrics order() terminal. */
function ingestStubMetrics(campaign: unknown, metrics: CampaignMetricRow[]): SupabaseClient {
  const from = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    const chain = (): Record<string, unknown> => b;
    b.select = chain;
    b.eq = chain;
    b.gte = chain;
    b.lte = chain;
    b.maybeSingle = () => Promise.resolve({ data: campaign, error: null });
    b.order = () => Promise.resolve({ data: table === 'campaign_metrics' ? metrics : [], error: null });
    return b;
  };
  return { from } as unknown as SupabaseClient;
}
