/**
 * Layer 1 (service) — numeric-analytics ingestion + read over campaign_metrics.
 *
 * The store-of-record write path the analytics tools wrap:
 *   ingest_campaign_analytics  → ingestCampaignAnalytics (already-normalised metric rows)
 *   ingest_funnel_analytics    → ingestFunnelAnalytics    (funnel-tracker shape → rows)
 *   ingest_content_performance → ingestContentPerformance (content-tracker shape → rows)
 *   get_campaign_metrics       → getCampaignMetrics       (date_range + by_channel|by_date)
 *
 * Every write runs on the JWT-bound client so RLS scopes rows to `auth.uid()`. Metrics are
 * APPEND-ONLY facts: writes upsert on the natural key (uq_campaign_metrics_natural) so
 * re-uploading a workbook reconciles instead of duplicating. The campaign is verified to belong
 * to the caller (RLS-scoped read) before any metric is attached — a foreign campaign_id is a
 * clean "campaign not found", never a cross-linked write.
 *
 * HONEST no_data: the parsers only emit a metric for a finite numeric input — absent / null /
 * NaN fields are skipped, never coerced to 0. When nothing parses, the service returns
 * `ingested: 0` with a `no_data` note; the coach surfaces that rather than fabricating numbers.
 *
 * Units: rate metrics (ctr, cvr) are stored as fractions 0–1 exactly as supplied (the tool input
 * schemas instruct callers to pass fractions) — the service never guesses percent-vs-fraction.
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { getCampaign } from './campaignService.js';
import {
  CAMPAIGN_METRICS_CONFLICT_TARGET,
  type CampaignChannel,
  type CampaignMetricRow,
  type FunnelStage,
  type JourneyStage,
  type MetricInput,
  type MetricName,
  type MetricSource,
} from './campaignTypes.js';

const METRICS_TABLE = 'campaign_metrics';
const BRAND_ASSETS_TABLE = 'brand_assets';
const METRIC_COLS =
  'id, user_id, campaign_id, brand_asset_id, channel, metric_name, metric_value, funnel_stage, journey_stage, measured_date, granularity, source, created_at';

/** Metrics whose group aggregate is a mean (ratios), not a sum (additive counts/amounts). */
const RATIO_METRICS: ReadonlySet<MetricName> = new Set<MetricName>(['ctr', 'cvr', 'aov']);

/** Raised when an analytics DB call fails or the target campaign is absent / not owned. */
export class AnalyticsIngestError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AnalyticsIngestError';
  }
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new AnalyticsIngestError('no authenticated user id in scope');
  return userId;
}

/** Result of an ingest call. `ingested` is the number of metric rows written / reconciled. */
export interface IngestResult {
  ok: boolean;
  ingested: number;
  metrics: CampaignMetricRow[];
  note?: string;
}

/** One aggregated group in a get_campaign_metrics breakdown. */
export interface MetricBreakdownGroup {
  key: string;
  metrics: Partial<Record<MetricName, number>>;
}

/** Result of get_campaign_metrics. `breakdown` is present only when one was requested. */
export interface MetricsQueryResult {
  ok: boolean;
  count: number;
  metrics: CampaignMetricRow[];
  breakdown?: MetricBreakdownGroup[];
  note?: string;
}

// ── parser helpers ──────────────────────────────────────────────────────────

/** True for a real, finite number (rejects null/undefined/NaN/Infinity — the no_data guard). */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Expand a base row + a {metric_name: value} map into MetricInput[], emitting ONE metric per
 * field that carries a finite number. Absent / null / NaN fields are dropped (no fabricated 0s).
 */
function expandMetrics(
  base: {
    channel: CampaignChannel;
    measured_date: string;
    funnel_stage?: FunnelStage | null;
    brand_asset_id?: string | null;
    journey_stage?: JourneyStage | null;
    granularity?: MetricInput['granularity'];
  },
  values: Partial<Record<MetricName, number | null | undefined>>,
): MetricInput[] {
  const out: MetricInput[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (!isFiniteNumber(value)) continue;
    out.push({
      channel: base.channel,
      metric_name: name as MetricName,
      metric_value: value,
      measured_date: base.measured_date,
      funnel_stage: base.funnel_stage ?? null,
      brand_asset_id: base.brand_asset_id ?? null,
      journey_stage: base.journey_stage ?? null,
      granularity: base.granularity,
    });
  }
  return out;
}

// ── core write ──────────────────────────────────────────────────────────────

/** Verify the campaign belongs to the caller (RLS read) or raise a clean not-found. */
async function requireOwnedCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new AnalyticsIngestError('campaign not found or not owned');
}

/**
 * Verify EVERY referenced funnel piece (brand_asset_id) belongs to the caller before any metric
 * is attached to it (mirrors requireOwnedCampaign). RLS scopes `brand_assets` to auth.uid(), so a
 * foreign/absent id is simply not returned — a row-count shortfall is the not-owned signal. A
 * single `in` read covers a whole batch; an empty set is a no-op. Decision #1: the brand_asset is
 * the entity metrics attach to, so a foreign piece must be a clean refusal, never a cross-linked write.
 */
async function requireOwnedBrandAssets(brandAssetIds: Iterable<string>): Promise<void> {
  const ids = Array.from(new Set(brandAssetIds));
  if (ids.length === 0) return;

  const supabase = getUserSupabase();
  const { data, error } = await supabase.from(BRAND_ASSETS_TABLE).select('id').in('id', ids);
  if (error) {
    throw new AnalyticsIngestError(`failed to verify funnel piece ownership: ${error.message}`, error);
  }
  const found = new Set((data as Array<{ id: string }> | null)?.map((r) => r.id) ?? []);
  if (found.size !== ids.length) {
    throw new AnalyticsIngestError('funnel piece (brand_asset) not found or not owned');
  }
}

/** Collect the distinct non-null brand_asset_ids referenced by a batch of parsed metrics. */
function brandAssetIdsOf(metrics: MetricInput[]): string[] {
  const ids = new Set<string>();
  for (const m of metrics) if (m.brand_asset_id) ids.add(m.brand_asset_id);
  return [...ids];
}

/**
 * Upsert normalised metric rows into campaign_metrics on the natural key (re-upload safe).
 * Stamps user_id; defaults granularity=daily and source per the caller. Returns the written rows.
 */
async function persistMetrics(
  campaignId: string,
  metrics: MetricInput[],
  defaultSource: MetricSource,
): Promise<CampaignMetricRow[]> {
  if (metrics.length === 0) return [];
  const supabase = getUserSupabase();
  const userId = requireUserId();

  const rows = metrics.map((m) => ({
    user_id: userId,
    campaign_id: campaignId,
    brand_asset_id: m.brand_asset_id ?? null,
    channel: m.channel,
    metric_name: m.metric_name,
    metric_value: m.metric_value,
    funnel_stage: m.funnel_stage ?? null,
    journey_stage: m.journey_stage ?? null,
    measured_date: m.measured_date,
    granularity: m.granularity ?? 'daily',
    source: m.source ?? defaultSource,
  }));

  const { data, error } = await supabase
    .from(METRICS_TABLE)
    .upsert(rows, { onConflict: CAMPAIGN_METRICS_CONFLICT_TARGET })
    .select(METRIC_COLS);

  if (error) {
    throw new AnalyticsIngestError(`failed to ingest metrics: ${error.message}`, error);
  }
  return (data as CampaignMetricRow[] | null) ?? [];
}

function ingestResult(metrics: CampaignMetricRow[]): IngestResult {
  return metrics.length === 0
    ? { ok: false, ingested: 0, metrics: [], note: 'no_data' }
    : { ok: true, ingested: metrics.length, metrics };
}

// ── ingest_campaign_analytics ─────────────────────────────────────────────────

/** Already-normalised metric rows (the generic ingest path). */
export async function ingestCampaignAnalytics(
  campaignId: string,
  rows: MetricInput[],
  source: MetricSource = 'manual',
): Promise<IngestResult> {
  await requireOwnedCampaign(campaignId);
  const metrics = rows.filter((r) => isFiniteNumber(r.metric_value));
  await requireOwnedBrandAssets(brandAssetIdsOf(metrics));
  return ingestResult(await persistMetrics(campaignId, metrics, source));
}

// ── ingest_funnel_analytics ───────────────────────────────────────────────────

/** Per-stage snapshot row (funnel-tracker VISIBILITY..PROFITABILITY band). */
export interface FunnelStageInput {
  stage: FunnelStage;
  impressions?: number;
  ctr?: number;
  cvr?: number;
  aov?: number;
  orders?: number;
  revenue?: number;
}

/** Monthly-actuals row (funnel-tracker Monthly Tracker). */
export interface FunnelMonthlyInput {
  month: string;
  impressions?: number;
  sessions?: number;
  ctr?: number;
  cvr?: number;
  aov?: number;
  orders?: number;
  revenue?: number;
  spend?: number;
}

export interface FunnelAnalyticsInput {
  channel?: CampaignChannel;
  as_of?: string;
  stages?: FunnelStageInput[];
  monthly?: FunnelMonthlyInput[];
  /** The funnel piece (brand_asset) this whole upload measures (decision #1). Optional. */
  brand_asset_id?: string | null;
  /** The funnel piece's customer-journey stage (mirrors brand_assets.stage). Optional. */
  journey_stage?: JourneyStage | null;
}

/**
 * Parse the funnel-tracker shape into MetricInput[]: per-stage snapshots (granularity snapshot,
 * funnel_stage stamped) + monthly actuals (one snapshot per month). Channel defaults to amazon
 * (the funnel tracker is Amazon-centric). Stage snapshots need an `as_of` date to anchor them.
 * When `brand_asset_id`/`journey_stage` are supplied they attach the whole upload to that piece.
 */
export function parseFunnelAnalytics(input: FunnelAnalyticsInput): MetricInput[] {
  const channel: CampaignChannel = input.channel ?? 'amazon';
  const piece = { brand_asset_id: input.brand_asset_id ?? null, journey_stage: input.journey_stage ?? null };
  const metrics: MetricInput[] = [];

  if (input.stages && input.as_of) {
    for (const s of input.stages) {
      metrics.push(
        ...expandMetrics(
          { channel, measured_date: input.as_of, funnel_stage: s.stage, granularity: 'snapshot', ...piece },
          {
            impressions: s.impressions,
            ctr: s.ctr,
            cvr: s.cvr,
            aov: s.aov,
            orders: s.orders,
            revenue: s.revenue,
          },
        ),
      );
    }
  }

  for (const m of input.monthly ?? []) {
    metrics.push(
      ...expandMetrics(
        { channel, measured_date: m.month, granularity: 'snapshot', ...piece },
        {
          impressions: m.impressions,
          sessions: m.sessions,
          ctr: m.ctr,
          cvr: m.cvr,
          aov: m.aov,
          orders: m.orders,
          revenue: m.revenue,
          spend: m.spend,
        },
      ),
    );
  }

  return metrics;
}

export async function ingestFunnelAnalytics(
  campaignId: string,
  input: FunnelAnalyticsInput,
  source: MetricSource = 'spreadsheet',
): Promise<IngestResult> {
  await requireOwnedCampaign(campaignId);
  const metrics = parseFunnelAnalytics(input);
  await requireOwnedBrandAssets(brandAssetIdsOf(metrics));
  return ingestResult(await persistMetrics(campaignId, metrics, source));
}

// ── ingest_content_performance ────────────────────────────────────────────────

/** Per-channel content-tracker performance row. */
export interface ContentPerformanceInput {
  channel: CampaignChannel;
  measured_date: string;
  views?: number;
  engagement?: number;
  calls_booked?: number;
  revenue?: number;
  /** The funnel piece (brand_asset) this row measures (decision #1). Optional. */
  brand_asset_id?: string | null;
  /** The funnel piece's customer-journey stage (mirrors brand_assets.stage). Optional. */
  journey_stage?: JourneyStage | null;
}

/** Parse content-tracker per-channel rows into MetricInput[] (views/engagement/calls_booked/revenue). */
export function parseContentPerformance(rows: ContentPerformanceInput[]): MetricInput[] {
  const metrics: MetricInput[] = [];
  for (const r of rows) {
    metrics.push(
      ...expandMetrics(
        {
          channel: r.channel,
          measured_date: r.measured_date,
          granularity: 'snapshot',
          brand_asset_id: r.brand_asset_id ?? null,
          journey_stage: r.journey_stage ?? null,
        },
        {
          views: r.views,
          engagement: r.engagement,
          calls_booked: r.calls_booked,
          revenue: r.revenue,
        },
      ),
    );
  }
  return metrics;
}

export async function ingestContentPerformance(
  campaignId: string,
  rows: ContentPerformanceInput[],
  source: MetricSource = 'spreadsheet',
): Promise<IngestResult> {
  await requireOwnedCampaign(campaignId);
  const metrics = parseContentPerformance(rows);
  await requireOwnedBrandAssets(brandAssetIdsOf(metrics));
  return ingestResult(await persistMetrics(campaignId, metrics, source));
}

// ── get_campaign_metrics ──────────────────────────────────────────────────────

export interface GetMetricsFilter {
  campaignId: string;
  from?: string;
  to?: string;
  breakdown?: 'by_channel' | 'by_date';
}

/**
 * Aggregate rows into groups keyed by channel or measured_date. Additive metrics
 * (impressions/clicks/orders/revenue/spend/...) are SUMMED; ratio metrics (ctr/cvr/aov) are
 * arithmetic MEANS (a sum would be meaningless). Deterministic + honest — no inferred values.
 */
function aggregate(
  rows: CampaignMetricRow[],
  by: 'by_channel' | 'by_date',
): MetricBreakdownGroup[] {
  const keyOf = (r: CampaignMetricRow): string =>
    by === 'by_channel' ? r.channel : r.measured_date;

  const sums = new Map<string, Map<MetricName, number>>();
  const counts = new Map<string, Map<MetricName, number>>();

  for (const r of rows) {
    const k = keyOf(r);
    if (!sums.has(k)) {
      sums.set(k, new Map());
      counts.set(k, new Map());
    }
    const s = sums.get(k)!;
    const c = counts.get(k)!;
    s.set(r.metric_name, (s.get(r.metric_name) ?? 0) + r.metric_value);
    c.set(r.metric_name, (c.get(r.metric_name) ?? 0) + 1);
  }

  return [...sums.keys()].sort().map((k) => {
    const s = sums.get(k)!;
    const c = counts.get(k)!;
    const metrics: Partial<Record<MetricName, number>> = {};
    for (const [name, total] of s) {
      metrics[name] = RATIO_METRICS.has(name) ? total / (c.get(name) ?? 1) : total;
    }
    return { key: k, metrics };
  });
}

/** Read a campaign's metrics over a date range, optionally aggregated. Honest no_data when empty. */
export async function getCampaignMetrics(filter: GetMetricsFilter): Promise<MetricsQueryResult> {
  await requireOwnedCampaign(filter.campaignId);
  const supabase = getUserSupabase();

  let query = supabase.from(METRICS_TABLE).select(METRIC_COLS).eq('campaign_id', filter.campaignId);
  if (filter.from) query = query.gte('measured_date', filter.from);
  if (filter.to) query = query.lte('measured_date', filter.to);

  const { data, error } = await query.order('measured_date', { ascending: false });
  if (error) {
    throw new AnalyticsIngestError(`failed to read campaign metrics: ${error.message}`, error);
  }

  const metrics = (data as CampaignMetricRow[] | null) ?? [];
  if (metrics.length === 0) {
    return { ok: true, count: 0, metrics: [], note: 'no_data' };
  }
  return {
    ok: true,
    count: metrics.length,
    metrics,
    breakdown: filter.breakdown ? aggregate(metrics, filter.breakdown) : undefined,
  };
}

// ── get_funnel_piece_metrics ──────────────────────────────────────────────────

export interface FunnelPieceMetricsFilter {
  brandAssetId: string;
  from?: string;
  to?: string;
}

/** The latest observed value for one metric_name on a funnel piece, with its measured_date. */
export interface LatestMetric {
  value: number;
  measured_date: string;
}

/** Deterministic derivations from the latest metrics — present only when both inputs exist. */
export interface DerivedPieceMetrics {
  cvr?: number; // orders / clicks
  aov?: number; // revenue / orders
  acos?: number; // spend / revenue (ad cost of sale, fraction)
  roas?: number; // revenue / spend (return on ad spend)
  cpc?: number; // spend / clicks (cost per click)
  // TACoS is intentionally NOT derived here: it needs TOTAL revenue (incl. organic), which
  // we don't have per funnel piece.
}

/** Result of get_funnel_piece_metrics: one funnel piece's latest-per-name metrics + derivations. */
export interface FunnelPieceMetricsResult {
  ok: boolean;
  brand_asset_id: string;
  count: number;
  latest: Partial<Record<MetricName, LatestMetric>>;
  derived: DerivedPieceMetrics;
  note?: string;
}

/**
 * Read ONE funnel piece's (brand_asset's) metrics over an optional date range and reduce to the
 * LATEST value per metric_name, plus a small deterministic derived block (cvr, aov, acos, roas,
 * cpc) computed ONLY when both inputs are present and the divisor is non-zero. Honest no_data: an OWNED but
 * empty piece returns ok:true/count 0 with a no_data note — the coach reasons over real numbers,
 * never invents. A foreign/absent piece is a clean not-owned refusal (mirrors requireOwnedCampaign).
 */
export async function getFunnelPieceMetrics(
  filter: FunnelPieceMetricsFilter,
): Promise<FunnelPieceMetricsResult> {
  await requireOwnedBrandAssets([filter.brandAssetId]);
  const supabase = getUserSupabase();

  let query = supabase
    .from(METRICS_TABLE)
    .select(METRIC_COLS)
    .eq('brand_asset_id', filter.brandAssetId);
  if (filter.from) query = query.gte('measured_date', filter.from);
  if (filter.to) query = query.lte('measured_date', filter.to);

  // Newest first so the first row seen per metric_name is the latest in range.
  const { data, error } = await query.order('measured_date', { ascending: false });
  if (error) {
    throw new AnalyticsIngestError(`failed to read funnel piece metrics: ${error.message}`, error);
  }

  const rows = (data as CampaignMetricRow[] | null) ?? [];
  if (rows.length === 0) {
    return {
      ok: true,
      brand_asset_id: filter.brandAssetId,
      count: 0,
      latest: {},
      derived: {},
      note: 'no_data',
    };
  }

  const latest: Partial<Record<MetricName, LatestMetric>> = {};
  for (const r of rows) {
    if (!latest[r.metric_name]) {
      latest[r.metric_name] = { value: r.metric_value, measured_date: r.measured_date };
    }
  }

  const derived: DerivedPieceMetrics = {};
  const clicks = latest.clicks?.value;
  const orders = latest.orders?.value;
  const revenue = latest.revenue?.value;
  const spend = latest.spend?.value;
  if (isFiniteNumber(orders) && isFiniteNumber(clicks) && clicks !== 0) derived.cvr = orders / clicks;
  if (isFiniteNumber(revenue) && isFiniteNumber(orders) && orders !== 0) derived.aov = revenue / orders;
  // Ad-efficiency derivations — present only when both inputs exist and the divisor is non-zero
  // (honest: omit rather than fabricate / divide by zero).
  if (isFiniteNumber(spend) && isFiniteNumber(revenue) && revenue !== 0) derived.acos = spend / revenue;
  if (isFiniteNumber(revenue) && isFiniteNumber(spend) && spend !== 0) derived.roas = revenue / spend;
  if (isFiniteNumber(spend) && isFiniteNumber(clicks) && clicks !== 0) derived.cpc = spend / clicks;

  return {
    ok: true,
    brand_asset_id: filter.brandAssetId,
    count: rows.length,
    latest,
    derived,
  };
}
