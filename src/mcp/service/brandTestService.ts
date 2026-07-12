/**
 * Layer 1 (service) — experiment-lifecycle milestone stamping over `brand_tests`.
 *
 * The tester journey records a split-test IDEA (a brand_tests row), then stamps two
 * lifecycle milestones on it: ASSET_CREATED (the asset was produced) and ASSET_LIVE
 * (it went live — this date starts the re-measure clock and anchors the case study).
 * `updateTestMilestone` writes those dates onto migration 20260628000000's columns.
 *
 * Ownership: every call runs on the JWT-bound client so RLS scopes brand_tests to the
 * caller (asset_id → brand_assets → avatars → user). A foreign/absent id is simply not
 * returned by the RLS read, which we surface as a clean "test not found or not owned" —
 * never a cross-tenant write.
 *
 * Lifecycle nudge: stamping ASSET_LIVE on a still-`draft` test promotes it to `running`
 * (a live asset is, by definition, no longer a draft); other statuses are left untouched.
 */
import { getUserSupabase } from '../supabaseUser.js';
import { METRIC_NAME_VALUES } from './campaignTypes.js';
import type { BrandTestMilestoneRow, MetricName, TestMilestone } from './campaignTypes.js';

const BRAND_TESTS_TABLE = 'brand_tests';
const MILESTONE_COLS = 'id, status, asset_created_at, asset_live_at';

/** The brand_tests column each milestone stamps. */
const MILESTONE_COLUMN: Record<TestMilestone, 'asset_created_at' | 'asset_live_at'> = {
  asset_created: 'asset_created_at',
  asset_live: 'asset_live_at',
};

/** Raised when a brand_tests milestone call fails or the target test is absent / not owned. */
export class BrandTestError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BrandTestError';
  }
}

export interface UpdateTestMilestoneInput {
  testId: string;
  milestone: TestMilestone;
  /** ISO timestamp the milestone was reached; defaults to now() when omitted. */
  at?: string;
}

export interface UpdateTestMilestoneResult {
  ok: boolean;
  test_id: string;
  milestone: TestMilestone;
  at: string;
  status: string;
}

/**
 * Stamp one lifecycle milestone date on a brand_tests row the caller owns. Verifies
 * ownership via an RLS-scoped read first (clean not-found otherwise), then writes the
 * date; ASSET_LIVE also promotes a `draft` test to `running`. The `at` value defaults
 * to the server's current time when not supplied.
 */
export async function updateTestMilestone(
  input: UpdateTestMilestoneInput,
): Promise<UpdateTestMilestoneResult> {
  const supabase = getUserSupabase();
  const at = input.at ?? new Date().toISOString();
  const column = MILESTONE_COLUMN[input.milestone];

  // Ownership read (RLS) — a foreign/absent id is not returned ⇒ clean not-found.
  const { data: existing, error: readErr } = await supabase
    .from(BRAND_TESTS_TABLE)
    .select(MILESTONE_COLS)
    .eq('id', input.testId)
    .maybeSingle();
  if (readErr) throw new BrandTestError(`failed to read test: ${readErr.message}`, readErr);
  if (!existing) throw new BrandTestError('test not found or not owned');

  const current = existing as BrandTestMilestoneRow;
  const patch: Record<string, string> = { [column]: at };
  // A live asset is no longer a draft — promote the lifecycle status.
  if (input.milestone === 'asset_live' && current.status === 'draft') {
    patch.status = 'running';
  }

  const { data: updated, error: updErr } = await supabase
    .from(BRAND_TESTS_TABLE)
    .update(patch)
    .eq('id', input.testId)
    .select(MILESTONE_COLS)
    .maybeSingle();
  if (updErr) throw new BrandTestError(`failed to stamp milestone: ${updErr.message}`, updErr);
  if (!updated) throw new BrandTestError('test not found or not owned');

  const row = updated as BrandTestMilestoneRow;
  return { ok: true, test_id: row.id, milestone: input.milestone, at, status: row.status };
}

// ── get_experiment_lift (the Re-measure leg, deterministic, no snapshot table) ──
//
// Close the before/after loop for ONE split-test: a brand_tests row carries a baseline,
// a metric, and the lifecycle dates (asset_created_at / asset_live_at). After the asset
// goes LIVE and a second Windsor pull lands metric rows, compute the LIFT for that test's
// metric on its funnel piece (the brand_asset = asset_id), reading campaign_metrics
// windowed by those dates — NO snapshot table. Honest pending: when the asset isn't live
// yet, or no post-live metric has been pulled, we return status_suggestion 'pending' and
// NEVER fabricate an after value. status_suggestion is advice only — the user/coach decides
// the brand_tests.status via update.

const METRICS_TABLE = 'campaign_metrics';
const BRAND_TESTS_TABLE_LIFT = 'brand_tests';
const LIFT_COLS = 'id, asset_id, metric_type, baseline_value, asset_created_at, asset_live_at, status';

/** The brand_tests subset get_experiment_lift reads. */
interface BrandTestLiftRow {
  id: string;
  asset_id: string;
  metric_type: string | null;
  baseline_value: number | null;
  asset_created_at: string | null;
  asset_live_at: string | null;
  status: string;
}

export interface ExperimentLiftResult {
  ok: boolean;
  test_id: string;
  metric_type: string | null;
  /** The campaign_metrics metric_name the free-text metric_type resolved to (null = unmappable). */
  metric_name: MetricName | null;
  /** Where `before` came from: the test's baseline_value, or the latest pre-create metric. */
  before_source: 'baseline' | 'pre_create_window' | null;
  before: number | null;
  after: number | null;
  lift: number | null;
  /** (after-before)/before — only when before is a non-zero number. */
  lift_pct: number | null;
  status_suggestion: 'won' | 'no_lift' | 'pending';
  note?: string;
  summary: string;
}

/**
 * Map a free-text brand_tests.metric_type (e.g. 'conversion_rate', 'unit_session_percentage',
 * 'click_through_rate') onto a stored campaign_metrics.metric_name. Order matters: composite
 * names are matched before their substrings (click_through before clicks). Returns null when
 * nothing maps — the caller then reports an honest "metric not measurable" rather than guessing.
 */
export function mapMetricTypeToName(metricType: string | null): MetricName | null {
  if (!metricType) return null;
  const t = metricType.toLowerCase().replace(/[\s%]+/g, '_');
  const rules: Array<[RegExp, MetricName]> = [
    [/click[_]?through|(^|_)ctr(_|$)/, 'ctr'],
    [/conversion|(^|_)cvr(_|$)|unit_session/, 'cvr'],
    [/engagement/, 'engagement'],
    [/aov|average_order/, 'aov'],
    [/revenue|sales/, 'revenue'],
    [/new_to_brand/, 'new_to_brand'],
    [/repeat/, 'repeat_rate'],
    [/return/, 'return_rate'],
    [/subscribe/, 'subscribe_save'],
    [/units?_sold|(^|_)units(_|$)/, 'units_sold'],
    [/order/, 'orders'],
    [/impression/, 'impressions'],
    [/session|traffic/, 'sessions'],
    [/calls?_booked|booking/, 'calls_booked'],
    [/click/, 'clicks'],
    [/open/, 'opens'],
    [/spend|cost/, 'spend'],
    [/view/, 'views'],
  ];
  for (const [re, name] of rules) if (re.test(t)) return name;
  if ((METRIC_NAME_VALUES as readonly string[]).includes(t)) return t as MetricName;
  return null;
}

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** The latest metric_value for a piece+metric, optionally windowed by measured_date. */
async function latestPieceMetric(
  brandAssetId: string,
  metricName: MetricName,
  window: { before?: string; onOrAfter?: string },
): Promise<number | null> {
  const supabase = getUserSupabase();
  let query = supabase
    .from(METRICS_TABLE)
    .select('metric_value, measured_date')
    .eq('brand_asset_id', brandAssetId)
    .eq('metric_name', metricName);
  if (window.before) query = query.lt('measured_date', window.before);
  if (window.onOrAfter) query = query.gte('measured_date', window.onOrAfter);

  const { data, error } = await query.order('measured_date', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new BrandTestError(`failed to read metrics for lift: ${error.message}`, error);
  const row = data as { metric_value: number } | null;
  return row && typeof row.metric_value === 'number' ? row.metric_value : null;
}

/**
 * Compute the before/after lift for one split-test. Verifies ownership via an RLS-scoped
 * brand_tests read (clean not-found otherwise), then:
 *   before = baseline_value if set, else latest metric BEFORE asset_created_at;
 *   after  = latest metric on/after asset_live_at (the live date starts the clock).
 * Honest pending when the asset isn't live or no post-live metric exists yet — never fabricated.
 */
export async function getExperimentLift(testId: string): Promise<ExperimentLiftResult> {
  const supabase = getUserSupabase();
  const { data, error } = await supabase
    .from(BRAND_TESTS_TABLE_LIFT)
    .select(LIFT_COLS)
    .eq('id', testId)
    .maybeSingle();
  if (error) throw new BrandTestError(`failed to read test: ${error.message}`, error);
  if (!data) throw new BrandTestError('test not found or not owned');

  const test = data as BrandTestLiftRow;
  const metricName = mapMetricTypeToName(test.metric_type);

  const base = (extra: Partial<ExperimentLiftResult>): ExperimentLiftResult => ({
    ok: true,
    test_id: test.id,
    metric_type: test.metric_type,
    metric_name: metricName,
    before_source: null,
    before: null,
    after: null,
    lift: null,
    lift_pct: null,
    status_suggestion: 'pending',
    ...extra,
  } as ExperimentLiftResult);

  if (!metricName) {
    return base({
      note: 'metric_type is not measurable (no campaign_metrics metric maps to it)',
      summary: `Cannot measure lift: this test's metric ("${test.metric_type ?? 'none'}") doesn't map to a tracked metric. Set a measurable metric_type to re-measure.`,
    });
  }

  // BEFORE: prefer the recorded baseline; else the latest pre-create metric (needs a create date).
  let before: number | null = null;
  let beforeSource: ExperimentLiftResult['before_source'] = null;
  if (typeof test.baseline_value === 'number') {
    before = test.baseline_value;
    beforeSource = 'baseline';
  } else if (test.asset_created_at) {
    before = await latestPieceMetric(test.asset_id, metricName, { before: test.asset_created_at.slice(0, 10) });
    if (before !== null) beforeSource = 'pre_create_window';
  }

  // AFTER: latest metric on/after the live date — the live date starts the clock.
  if (!test.asset_live_at) {
    return base({
      before,
      before_source: beforeSource,
      note: 'asset not live yet (no asset_live_at) — re-measure after it goes live',
      summary: 'Pending: this asset is not live yet. Stamp ASSET_LIVE and pull post-live metrics, then re-measure.',
    });
  }
  const after = await latestPieceMetric(test.asset_id, metricName, { onOrAfter: test.asset_live_at.slice(0, 10) });
  if (after === null) {
    return base({
      before,
      before_source: beforeSource,
      note: 'no post-live metric pulled yet (no_data)',
      summary: 'Pending: no metric has been pulled since the asset went live. Run a fresh Windsor pull, then re-measure.',
    });
  }

  if (before === null) {
    return base({
      after,
      note: 'no baseline available (no baseline_value and no pre-create metric)',
      summary: `Pending: we have an after value (${after}) but no before to compare it to. Record a baseline_value to compute lift.`,
    });
  }

  const lift = round4(after - before);
  const liftPct = before !== 0 ? round4((after - before) / before) : null;
  const suggestion: 'won' | 'no_lift' = lift > 0 ? 'won' : 'no_lift';
  const pct = liftPct === null ? '' : ` (${liftPct > 0 ? '+' : ''}${round4(liftPct * 100)}%)`;
  return base({
    before,
    before_source: beforeSource,
    after,
    lift,
    lift_pct: liftPct,
    status_suggestion: suggestion,
    summary:
      `${metricName} ${before} → ${after} (${lift > 0 ? '+' : ''}${lift})${pct}. ` +
      `Suggested call: ${suggestion === 'won' ? 'WON — the asset lifted the metric' : 'NO LIFT — the metric did not improve'}. ` +
      'You decide the verdict; update the test status to lock it in.',
  });
}
