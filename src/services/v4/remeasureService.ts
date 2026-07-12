/**
 * remeasureService — Layer-3 execution seam for Loop-4 (Re-measure).
 *
 * WHAT: Thin, typed wrappers around the owner-scoped Supabase reads that power the
 * Re-measure loop — getTrustGapLift (deterministic before/after Trust Gap delta)
 * and getBusinessMetrics (CTR/CVR/AOV/revenue before/after) — plus the pure
 * `computeLift` math. Each async method returns a `RemeasureResult<T>`
 * discriminated `ok | needs_input | error`.
 *
 * WHY: This is the single seam the Re-measure screens (TrustGapLiftCard,
 * BusinessMetricsCard) and the run-hook integrator share, so they never touch
 * RLS tables directly or drift on payload shapes. Modeled on `fixService`: the
 * run reader (diagnostic_results) and the metrics reader (campaign_metrics) are
 * INJECTABLE so tests drive the ok / needs_input / empty / no-data branches
 * without a network.
 *
 * NO FABRICATION:
 *  - The Trust Gap delta is PURE arithmetic on two REAL diagnostic runs — a 1:1
 *    mirror of the live `compute_trust_gap_lift` engine (see
 *    src/mcp/tools/computeTrustGapLift.ts). Fewer than two comparable runs →
 *    `needs_input` (re-run the diagnostic after the fix), never a made-up delta.
 *  - Business metrics read `campaign_metrics` (RLS). That migration is UNAPPLIED
 *    in prod, so the read returns empty → `hasData: false` (honest no-data),
 *    never a fabricated lift. It activates automatically once rows exist.
 *
 * Observability lives in the SCREENS (PostHog funnel events), not this seam — the
 * same split as `fixService` / `analyseService`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getTouchpoint } from '@/config/touchpointTaxonomy';
import { METRIC_META, type MetricKey } from '@/config/v4Funnel';
import { deriveLifecycle } from '@/services/v4/fixService';
import type {
  BusinessMetricKind,
  BusinessMetricsView,
  ExperimentLift,
  ExperimentLiftStatus,
  ExperimentVerdict,
  LiftAvatarSummary,
  LiftDirection,
  MetricDelta,
  MetricUnit,
  PillarScores,
  RemeasureResult,
  TrustGapLift,
  TrustPillar,
} from '@/types/v4Remeasure';

const PILLARS: readonly TrustPillar[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

/** One diagnostic run as the reader yields it (oldest-relevant first is NOT assumed). */
export interface DiagnosticRun {
  /** Per-pillar scores parsed from category_scores; null when not comparable. */
  scores: PillarScores | null;
  /** ISO timestamp the run was measured. */
  measuredAt: string;
}

/** One campaign_metrics fact row (long/narrow format). */
export interface MetricRow {
  metricName: string;
  metricValue: number;
  /** ISO date (measured_date). */
  measuredDate: string;
}

/**
 * Reads the two most recent diagnostic runs for an avatar, newest first. Defaults
 * to an owner-scoped `diagnostic_results` RLS read. Returns [] when none exist.
 */
export type RunReader = (avatarId: string) => Promise<DiagnosticRun[]>;

/**
 * Reads the raw campaign metric facts for an avatar. Defaults to a
 * `campaign_metrics` RLS read that returns an EMPTY array until the
 * campaign/analytics migration is applied — so business-metric lift is honestly
 * absent rather than fabricated.
 */
export type MetricsReader = (avatarId: string) => Promise<MetricRow[]>;

/** One experiment (brand_tests row) as the experiment reader yields it. */
export interface ExperimentRow {
  /** brand_tests row id. */
  id: string;
  /** The funnel piece (brand_asset) under test; null if detached. */
  pieceId: string | null;
  /** Everyday label of the piece under test. */
  pieceLabel: string;
  /** The metric the experiment moves (already validated to the metric vocab). */
  metric: MetricKey;
  /** Baseline value at open; null when unset. */
  baseline: number | null;
  /** Recorded result; null while running. */
  result: number | null;
  /** Raw brand_tests.status (e.g. running | won | no_lift | draft). */
  rawStatus: string;
  /** ASSET_CREATED milestone date; null until stamped. */
  assetCreatedAt: string | null;
  /** ASSET_LIVE milestone date (starts the re-measure clock); null until stamped. */
  assetLiveAt: string | null;
}

/**
 * Reads the user's experiments (brand_tests joined to their piece label) for an
 * avatar, newest first. Defaults to an owner-scoped RLS read; returns [] when none.
 */
export type ExperimentReader = (avatarId: string) => Promise<ExperimentRow[]>;

/** Request for the post-live "after" number of one experiment's metric. */
export interface ExperimentMetricRequest {
  avatarId: string;
  /** The funnel piece the metric is measured on. */
  pieceId: string | null;
  metric: MetricKey;
  /** ISO date the asset went live — the after-window opens here (inclusive). */
  since: string;
}

/**
 * The `get_experiment_lift` seam: the real post-`asset_live_at` value of an
 * experiment's metric, read from `campaign_metrics` windowed by date. Returns null
 * (honest pending) until the campaign/analytics migration lands and a post-live
 * pull exists — NEVER a fabricated after-number.
 */
export type ExperimentMetricReader = (req: ExperimentMetricRequest) => Promise<number | null>;

/** Writes a tester's won / no-lift verdict + measured result back to a brand_test. */
export type ExperimentResultWriter = (req: {
  testId: string;
  status: ExperimentVerdict;
  resultValue: number | null;
}) => Promise<void>;

// ── value guards ────────────────────────────────────────────────────────────────
const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

const errResult = (e: unknown, fallback: string): RemeasureResult<never> => ({
  status: 'error',
  error: e instanceof Error ? e.message : fallback,
});

/** Parse a diagnostic run's category_scores Json into the four pillar scores. */
function parseScores(raw: unknown): PillarScores | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const out = {} as PillarScores;
  for (const p of PILLARS) {
    const v = asNumber(rec[p]);
    if (v == null) return null; // not comparable unless all four are present
    out[p] = v;
  }
  return out;
}

/**
 * Default run reader: newest-two `diagnostic_results` rows scoped to the avatar
 * (RLS scopes to the caller). Parses category_scores into pillar scores.
 */
const defaultRunReader: RunReader = async (avatarId) => {
  const { data, error } = await supabase
    .from('user_diagnostic_results')
    .select('category_scores, created_at, diagnostic_completion_date')
    .eq('avatar_id', avatarId)
    .order('created_at', { ascending: false })
    .limit(2);
  if (error) throw error;
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows
    .map((row): DiagnosticRun | null => {
      const r = asRecord(row);
      if (!r) return null;
      const measuredAt =
        asString(r.diagnostic_completion_date) ?? asString(r.created_at) ?? '';
      return { scores: parseScores(r.category_scores), measuredAt };
    })
    .filter((r): r is DiagnosticRun => r !== null);
};

/**
 * Default metrics reader. `campaign_metrics` is NOT in the generated Database types
 * yet (migration unapplied), so we read it through an untyped view of the client
 * and guard every row. Returns an empty array on any error / no rows — the honest
 * no-data path. Activates automatically once the migration lands.
 *
 * Defense in depth (not RLS alone): the read is explicitly scoped to the
 * authenticated caller (`user_id`) AND to the avatar's own funnel pieces
 * (`brand_asset_id IN` the avatar's `brand_assets`), so a multi-avatar user never
 * sees cross-avatar / cross-tenant metrics even if a policy is ever loosened.
 */
const defaultMetricsReader: MetricsReader = async (avatarId) => {
  try {
    const untyped = supabase as unknown as SupabaseClient;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    // Resolve the avatar's own pieces first; metrics are scoped to those ids.
    const assetsRes = await untyped
      .from('brand_assets')
      .select('id')
      // brand_assets has no user_id column — RLS already scopes to the owner.
      // (.eq('user_id', …) here returned 400: column does not exist.)
      .eq('avatar_id', avatarId);
    const assetIds = (Array.isArray(assetsRes.data) ? assetsRes.data : [])
      .map((a) => asString(asRecord(a)?.id))
      .filter((id): id is string => id !== null);
    if (assetIds.length === 0) return [];
    const { data, error } = await untyped
      .from('campaign_metrics')
      .select('metric_name, metric_value, measured_date')
      .eq('user_id', user.id)
      .in('brand_asset_id', assetIds);
    if (error) return [];
    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows
      .map((row): MetricRow | null => {
        const r = asRecord(row);
        if (!r) return null;
        const metricName = asString(r.metric_name);
        const metricValue = asNumber(r.metric_value);
        const measuredDate = asString(r.measured_date);
        if (!metricName || metricValue == null || !measuredDate) return null;
        return { metricName, metricValue, measuredDate };
      })
      .filter((r): r is MetricRow => r !== null);
  } catch {
    return [];
  }
};

/** Narrow an arbitrary value to a known metric key (drives no fabrication). */
const isMetricKey = (v: unknown): v is MetricKey =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(METRIC_META, v);

/**
 * Default experiment reader: every brand_test for the avatar (newest first) joined
 * to its piece label. `brand_tests` lifecycle columns aren't in the generated types
 * yet (additive migration), so we read through an untyped client view and guard each
 * row. Drops rows whose metric isn't in the vocab rather than coercing one.
 */
const defaultExperimentReader: ExperimentReader = async (avatarId) => {
  const untyped = supabase as unknown as SupabaseClient;
  const [testsRes, assetsRes] = await Promise.all([
    untyped
      .from('brand_tests')
      .select(
        'id, asset_id, metric_type, baseline_value, result_value, status, asset_created_at, asset_live_at',
      )
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false }),
    untyped.from('brand_assets').select('id, touchpoint_id').eq('avatar_id', avatarId),
  ]);
  if (testsRes.error) throw testsRes.error;

  const labelById = new Map<string, string>();
  for (const a of Array.isArray(assetsRes.data) ? assetsRes.data : []) {
    const r = asRecord(a);
    if (!r) continue;
    const id = asString(r.id);
    const tp = asString(r.touchpoint_id);
    if (id && tp) labelById.set(id, getTouchpoint(tp)?.label ?? tp);
  }

  const rows: unknown[] = Array.isArray(testsRes.data) ? testsRes.data : [];
  return rows
    .map((row): ExperimentRow | null => {
      const r = asRecord(row);
      if (!r) return null;
      const id = asString(r.id);
      if (!id || !isMetricKey(r.metric_type)) return null;
      const pieceId = asString(r.asset_id);
      return {
        id,
        pieceId,
        pieceLabel: (pieceId && labelById.get(pieceId)) || 'Funnel piece',
        metric: r.metric_type,
        baseline: asNumber(r.baseline_value),
        result: asNumber(r.result_value),
        rawStatus: asString(r.status) ?? 'running',
        assetCreatedAt: asString(r.asset_created_at),
        assetLiveAt: asString(r.asset_live_at),
      };
    })
    .filter((r): r is ExperimentRow => r !== null);
};

/**
 * Default `get_experiment_lift` seam. Reads `campaign_metrics` for the piece +
 * metric on/after the go-live date and aggregates (sum for count/currency, mean for
 * percent/ratio). Returns null on empty / error / unapplied migration — the honest
 * pending path, never a fabricated after-number.
 */
const defaultExperimentMetricReader: ExperimentMetricReader = async ({ pieceId, metric, since }) => {
  if (!pieceId) return null;
  try {
    const untyped = supabase as unknown as SupabaseClient;
    const { data, error } = await untyped
      .from('campaign_metrics')
      .select('metric_value, measured_date')
      .eq('brand_asset_id', pieceId)
      .eq('metric_name', metric)
      .gte('measured_date', since);
    if (error) return null;
    const values: number[] = (Array.isArray(data) ? data : [])
      .map((row) => asNumber(asRecord(row)?.metric_value))
      .filter((v): v is number => v != null);
    if (values.length === 0) return null;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const fmt = METRIC_META[metric].format;
    const additive = fmt === 'count' || fmt === 'currency';
    return round2(additive ? sum : sum / values.length);
  } catch {
    return null;
  }
};

/**
 * Default verdict writer: stamp the tester's won / no-lift call + the measured
 * result onto the brand_test (RLS owner-scoped). Throws on a real failure so the
 * caller surfaces honest `error`, never a silent success.
 */
const defaultExperimentResultWriter: ExperimentResultWriter = async ({ testId, status, resultValue }) => {
  const untyped = supabase as unknown as SupabaseClient;
  // Read-then-write ownership gate (mirrors the MCP brandTest milestone pattern):
  // the RLS-bound SELECT only returns a row the caller owns, so a missing row means
  // not-found-or-not-owned — refuse rather than blind-update a UUID the caller guessed.
  const existing = await untyped.from('brand_tests').select('id').eq('id', testId).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) throw new Error('Experiment not found or not owned.');
  const { error } = await untyped
    .from('brand_tests')
    .update({ status, result_value: resultValue, updated_at: new Date().toISOString() })
    .eq('id', testId);
  if (error) throw error;
};

const METRIC_META_BIZ: Record<BusinessMetricKind, { label: string; unit: MetricUnit }> = {
  ctr: { label: 'Click-through rate', unit: 'rate' },
  cvr: { label: 'Conversion rate', unit: 'rate' },
  aov: { label: 'Average order value', unit: 'currency' },
  revenue: { label: 'Revenue', unit: 'currency' },
};
const METRIC_KINDS: readonly BusinessMetricKind[] = ['ctr', 'cvr', 'aov', 'revenue'];

export class RemeasureService {
  constructor(
    private readonly readRuns: RunReader = defaultRunReader,
    private readonly readMetrics: MetricsReader = defaultMetricsReader,
    private readonly readExperiments: ExperimentReader = defaultExperimentReader,
    private readonly readExperimentMetric: ExperimentMetricReader = defaultExperimentMetricReader,
    private readonly writeExperimentResult: ExperimentResultWriter = defaultExperimentResultWriter,
  ) {}

  /**
   * Pure deterministic Trust Gap before/after math — a 1:1 mirror of the live
   * `compute_trust_gap_lift` engine. Exported via the instance so the screens can
   * recompute without a read, and the test drives it directly. NEVER invents a
   * number: it is only arithmetic on the two score sets passed in.
   */
  computeLift(before: PillarScores, after: PillarScores, measuredAt: string): TrustGapLift {
    const overall = (s: PillarScores): number => PILLARS.reduce((sum, p) => sum + s[p], 0);
    const overallBefore = overall(before);
    const overallAfter = overall(after);
    const overallDelta = round1(overallAfter - overallBefore);
    const pillarDeltas = Object.fromEntries(
      PILLARS.map((p) => [p, round1(after[p] - before[p])]),
    ) as PillarScores;
    const biggest = PILLARS.reduce(
      (m, p) => (Math.abs(pillarDeltas[p]) > Math.abs(pillarDeltas[m]) ? p : m),
      PILLARS[0],
    );
    const weakest = PILLARS.reduce((m, p) => (after[p] < after[m] ? p : m), PILLARS[0]);
    const direction: LiftDirection =
      overallDelta > 0 ? 'improved' : overallDelta < 0 ? 'declined' : 'flat';

    const moveWord = direction === 'improved' ? 'closed' : direction === 'declined' ? 'widened' : 'held';
    const sign = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
    const summary =
      `Trust Gap ${overallBefore} → ${overallAfter} (${sign(overallDelta)}). The gap ${moveWord}. ` +
      (direction !== 'flat'
        ? `${biggest[0].toUpperCase() + biggest.slice(1)} moved most (${sign(pillarDeltas[biggest])}). `
        : '') +
      `Your weakest pillar now is ${weakest} (${after[weakest]}/25) — that's the next single lever.`;

    return {
      overallBefore,
      overallAfter,
      overallDelta,
      pillarDeltas,
      pillarBefore: before,
      pillarAfter: after,
      biggestMover: { pillar: biggest, delta: pillarDeltas[biggest] },
      weakestNow: { pillar: weakest, score: after[weakest] },
      direction,
      summary,
      measuredAt,
    };
  }

  /**
   * The deterministic Trust Gap lift between the two latest diagnostic runs for an
   * avatar. `needs_input` when there is no avatar, or fewer than two comparable
   * runs (re-run the diagnostic after shipping the fix) — never a fabricated delta.
   */
  async getTrustGapLift(avatarId: string | null): Promise<RemeasureResult<TrustGapLift>> {
    if (!avatarId) return this.needAvatar();
    let runs: DiagnosticRun[];
    try {
      runs = await this.readRuns(avatarId);
    } catch (e) {
      return errResult(e, 'Could not read your diagnostic history.');
    }
    const comparable = runs.filter((r): r is DiagnosticRun & { scores: PillarScores } => r.scores !== null);
    if (comparable.length < 2) {
      return {
        status: 'needs_input',
        needs_input: [
          {
            slot: 0,
            question:
              'Re-run the Trust Gap diagnostic now that your fix is live — I need a second real run to measure the lift against your first.',
            why: 'I only ever show the gap moving between two real diagnostic runs; I will not invent a before/after.',
          },
        ],
      };
    }
    // Reader yields newest-first: [0] = after (latest), [1] = before (prior).
    const [after, before] = comparable;
    return { status: 'ok', data: this.computeLift(before.scores, after.scores, after.measuredAt) };
  }

  /**
   * The Trust Gap lift across a SET of avatars (multi-avatar Re-measure). Each
   * avatar has its OWN `diagnostic_results` history, so the lift is computed PER
   * avatar via the unchanged `getTrustGapLift` (N reads of the existing contract).
   * The lift is a NUMBER (overall before→after delta), so there is no honest
   * aggregate across customers — the FOCUS avatar's lift is the representative the
   * card headlines, and every avatar's own delta is attached as `perAvatar` to be
   * shown side-by-side (an avatar with fewer than two comparable runs carries a
   * null delta — honest "no run yet", never an invented before/after). When the
   * focus avatar itself has no computable lift its honest result is returned
   * unchanged — we never headline another customer's before/after as the focus's.
   * A single-id set delegates to `getTrustGapLift` (byte-identical single path).
   */
  async getTrustGapLiftForSet(
    avatarIds: string[],
    avatarNames: Record<string, string>,
  ): Promise<RemeasureResult<TrustGapLift>> {
    const ids = [...new Set(avatarIds)].filter(Boolean);
    if (ids.length === 0) return this.needAvatar();
    if (ids.length === 1) return this.getTrustGapLift(ids[0]);

    // Per-avatar lift via the unchanged single-avatar read (ids[0] = the focus).
    const results = await Promise.all(ids.map((id) => this.getTrustGapLift(id)));

    // Honesty: a per-avatar read that ERRORED fails the whole set — a real read
    // failure must never hide behind a null delta + status 'ok'. (A `needs_input`
    // avatar legitimately carries a null "no run yet" delta below — honest
    // emptiness, not a failure — so it does NOT fail the set.)
    const errored = results.find((r) => r.status === 'error');
    if (errored) return errored;

    const perAvatar: LiftAvatarSummary[] = ids.map((id, i) => {
      const r = results[i];
      return {
        avatarId: id,
        avatarName: avatarNames[id] ?? 'Customer',
        overallDelta: r.status === 'ok' ? r.data.overallDelta : null,
        direction: r.status === 'ok' ? r.data.direction : null,
      };
    });

    const focus = results[0];
    if (focus.status !== 'ok') return focus;
    return { status: 'ok', data: { ...focus.data, perAvatar } };
  }

  /**
   * Before/after on CTR/CVR/AOV/revenue, split around the brand-change pivot date.
   * Reads real `campaign_metrics` facts (RLS); that table is unapplied in prod so
   * the read returns empty → `hasData: false` (honest no-data), NEVER a fabricated
   * lift. `needs_input` when there is no avatar.
   *
   * SET-INVARIANT: business metrics are `campaign_metrics` facts keyed by
   * `brand_asset_id` (brand-scoped), so the read does not change per evaluation
   * avatar — there is deliberately no `…ForSet` variant; the focus-avatar read
   * stands for a multi-avatar selection (mirrors `fixService.getPieceMetrics`).
   */
  async getBusinessMetrics(
    avatarId: string | null,
    pivotDate: string | null,
  ): Promise<RemeasureResult<BusinessMetricsView>> {
    if (!avatarId) return this.needAvatar();
    let rows: MetricRow[];
    try {
      rows = await this.readMetrics(avatarId);
    } catch (e) {
      return errResult(e, 'Could not read your campaign metrics.');
    }
    return { status: 'ok', data: this.buildMetricsView(rows, pivotDate) };
  }

  /** Group long-format rows into the four headline metrics, before vs after pivot. */
  private buildMetricsView(rows: MetricRow[], pivotDate: string | null): BusinessMetricsView {
    const metrics: MetricDelta[] = METRIC_KINDS.map((kind) => {
      const meta = METRIC_META_BIZ[kind];
      const forKind = rows.filter((r) => r.metricName === kind);
      const before = this.aggregate(
        forKind.filter((r) => (pivotDate ? r.measuredDate < pivotDate : false)),
        kind,
      );
      const after = this.aggregate(
        forKind.filter((r) => (pivotDate ? r.measuredDate >= pivotDate : true)),
        kind,
      );
      const delta = before != null && after != null ? round2(after - before) : null;
      const pctChange =
        before != null && before !== 0 && after != null
          ? round1(((after - before) / before) * 100)
          : null;
      return { kind, label: meta.label, unit: meta.unit, before, after, delta, pctChange };
    });
    const hasData = metrics.some((m) => m.before != null || m.after != null);
    return { metrics, hasData, pivotDate };
  }

  /** Revenue aggregates as a sum; rates/AOV as a mean. null when no rows. */
  private aggregate(rows: MetricRow[], kind: BusinessMetricKind): number | null {
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, r) => acc + r.metricValue, 0);
    return kind === 'revenue' ? round2(sum) : round2(sum / rows.length);
  }

  /**
   * Every experiment for an avatar as a before→after lift, closing the test loop.
   * Lists the brand_tests, then for each derives the lifecycle stage and computes
   * the lift: `before` = the stored baseline, `after` = the recorded result, else a
   * post-`asset_live_at` `campaign_metrics` pull (the `get_experiment_lift` seam).
   * No live asset / no post-live pull → `pending` (after = null), NEVER a fabricated
   * lift. `needs_input` when there is no avatar; an empty list is honest "no tests".
   *
   * SET-INVARIANT: experiments are `brand_tests` rows (brand-scoped tests), so the
   * read does not change per evaluation avatar — there is deliberately no `…ForSet`
   * variant; the focus-avatar read stands for a multi-avatar selection (mirrors
   * `fixService.listTests`).
   */
  async getExperimentLifts(avatarId: string | null): Promise<RemeasureResult<ExperimentLift[]>> {
    if (!avatarId) return this.needAvatar();
    let rows: ExperimentRow[];
    try {
      rows = await this.readExperiments(avatarId);
    } catch (e) {
      return errResult(e, 'Could not read your experiments.');
    }
    const lifts = await Promise.all(rows.map((r) => this.toExperimentLift(avatarId, r)));
    return { status: 'ok', data: lifts };
  }

  /** Map one experiment row to its before/after lift (pulls the after only when live). */
  private async toExperimentLift(avatarId: string, row: ExperimentRow): Promise<ExperimentLift> {
    const stage = deriveLifecycle(row.assetCreatedAt, row.assetLiveAt, row.result);
    const before = row.baseline;
    // Recorded result wins; otherwise pull the post-live number — only once live.
    let after = row.result;
    if (after == null && row.assetLiveAt) {
      after = await this.readExperimentMetric({
        avatarId,
        pieceId: row.pieceId,
        metric: row.metric,
        since: row.assetLiveAt,
      });
    }
    const lift = before != null && after != null ? round2(after - before) : null;
    const liftPct =
      before != null && before !== 0 && after != null ? round1(((after - before) / before) * 100) : null;
    const status: ExperimentLiftStatus =
      row.rawStatus === 'won'
        ? 'won'
        : row.rawStatus === 'no_lift'
          ? 'no_lift'
          : after != null
            ? 'measured'
            : 'pending';
    return {
      testId: row.id,
      pieceLabel: row.pieceLabel,
      metric: row.metric,
      metricLabel: METRIC_META[row.metric].label,
      format: METRIC_META[row.metric].format,
      before,
      after,
      lift,
      liftPct,
      stage,
      status,
    };
  }

  /**
   * Record the tester's won / no-lift verdict (+ the measured result) on an
   * experiment — writes brand_tests.status + result_value (RLS owner-scoped).
   * `error` on a failed write, never a silent success or a fabricated result.
   */
  async markExperimentResult(
    testId: string,
    verdict: ExperimentVerdict,
    resultValue: number | null,
  ): Promise<RemeasureResult<{ testId: string }>> {
    try {
      await this.writeExperimentResult({ testId, status: verdict, resultValue });
      return { status: 'ok', data: { testId } };
    } catch (e) {
      return errResult(e, 'Could not record the test result.');
    }
  }

  /** Ask for an avatar — the one universal `needs_input` for this loop. */
  private needAvatar(): RemeasureResult<never> {
    return {
      status: 'needs_input',
      needs_input: [
        {
          slot: 0,
          question: 'Which customer avatar are we re-measuring the lift for?',
          why: 'The before/after is scoped to one avatar — I will not guess which.',
        },
      ],
    };
  }
}

/** Default instance the screens + integrator import. */
export const remeasureService = new RemeasureService();

// Standalone function seam (delegates to the default instance) for ergonomic
// imports in screens that don't need custom readers.
export const getTrustGapLift = (avatarId: string | null): Promise<RemeasureResult<TrustGapLift>> =>
  remeasureService.getTrustGapLift(avatarId);
export const getBusinessMetrics = (
  avatarId: string | null,
  pivotDate: string | null,
): Promise<RemeasureResult<BusinessMetricsView>> =>
  remeasureService.getBusinessMetrics(avatarId, pivotDate);
export const getExperimentLifts = (
  avatarId: string | null,
): Promise<RemeasureResult<ExperimentLift[]>> => remeasureService.getExperimentLifts(avatarId);
export const markExperimentResult = (
  testId: string,
  verdict: ExperimentVerdict,
  resultValue: number | null,
): Promise<RemeasureResult<{ testId: string }>> =>
  remeasureService.markExperimentResult(testId, verdict, resultValue);
