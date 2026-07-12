/**
 * Loop-4 (Re-measure / "lift on the numbers") shared domain types.
 *
 * WHAT: The single contract the Re-measure screens (TrustGapLiftCard,
 * BusinessMetricsCard) and the `remeasureService` seam all import — the
 * deterministic Trust Gap before/after delta + the business-metric before/after
 * deltas (CTR/CVR/AOV/revenue) tied to the brand change. Defining it once keeps
 * the screens and the integrator from drifting on field names.
 *
 * WHY: Re-measure is the Diagnose→Analyse→Fix→Re-measure spine's "prove it
 * worked" leg — show the gap closing (the reason to keep going). Like the rest of
 * /v4, EVERY value here is grounded: the Trust Gap delta is pure arithmetic on two
 * REAL diagnostic runs (mirrors the live `compute_trust_gap_lift` engine — it
 * never invents a number), and a business-metric figure is only ever shown when a
 * REAL `campaign_metrics` row backs it. The campaign/analytics migration is
 * unapplied in prod, so the honest no-data path is the default reality — never a
 * fabricated lift.
 *
 * The result discriminant deliberately mirrors `FixResult` in `src/types/v4Fix.ts`
 * and `AnalyseResult` in `src/types/v4Analyse.ts` (same ok | needs_input | error
 * shape) so the three service seams share one mental model.
 */
import type { NeedsInputItem } from '@/types/onboardingReflection';
import type { TrustPillar } from '@/types/v4Analyse';
import type { MetricFormat, MetricKey } from '@/config/v4Funnel';
import type { TestLifecycleStage } from '@/types/v4Fix';

/** Re-export so screens import the grounding-demand + pillar shapes from one place. */
export type { NeedsInputItem, TrustPillar };
export type { TestLifecycleStage };

// ── Trust Gap lift (deterministic, mirrors compute_trust_gap_lift) ──────────────

/** The four IDEA Trust Gap pillar scores, each 0–25 (overall = their sum, 0–100). */
export type PillarScores = Record<TrustPillar, number>;

/** Which way the gap moved between the BEFORE and AFTER diagnostic runs. */
export type LiftDirection = 'improved' | 'declined' | 'flat';

/**
 * One customer's Trust Gap lift summary, when Re-measure considers a multi-avatar
 * set. Each avatar has its OWN diagnostic history, so the lift is a NUMBER per
 * customer (the overall before→after delta) — shown side-by-side, NEVER rolled
 * into a fabricated cross-customer aggregate. `overallDelta` / `direction` are
 * null when that avatar has fewer than two comparable runs (honest "no run yet",
 * never an invented before/after).
 */
export interface LiftAvatarSummary {
  avatarId: string;
  avatarName: string;
  /** Overall before→after delta for this avatar; null when not yet computable. */
  overallDelta: number | null;
  /** Which way the gap moved for this avatar; null when not yet computable. */
  direction: LiftDirection | null;
}

/**
 * The deterministic Trust Gap before/after result. Pure arithmetic on the two
 * real score sets — a 1:1 mirror of the live `compute_trust_gap_lift` engine's
 * output (overall delta, per-pillar deltas, biggest mover, weakest pillar now,
 * direction, plain-language summary). NEVER fabricated.
 */
export interface TrustGapLift {
  overallBefore: number;
  overallAfter: number;
  overallDelta: number;
  pillarDeltas: PillarScores;
  /** The after-run per-pillar scores (for the before/after read-out). */
  pillarAfter: PillarScores;
  /** The before-run per-pillar scores. */
  pillarBefore: PillarScores;
  biggestMover: { pillar: TrustPillar; delta: number };
  weakestNow: { pillar: TrustPillar; score: number };
  direction: LiftDirection;
  /** Plain-language Tier-A summary. */
  summary: string;
  /** ISO date the AFTER run was measured — the re-measure pivot. */
  measuredAt: string;
  /**
   * Per-avatar lift summaries when >1 customer is in the Re-measure set. The
   * card's headline before/after above is the FOCUS avatar's (the representative)
   * — NOT an aggregate; each customer's own delta is shown side-by-side. Absent
   * for single-avatar (the common case).
   */
  perAvatar?: LiftAvatarSummary[];
}

// ── Business metrics (RLS reads of campaign_metrics; empty until migration) ─────

/** The four headline business metrics shown before/after the brand change. */
export type BusinessMetricKind = 'ctr' | 'cvr' | 'aov' | 'revenue';

/** How a metric value is rendered: a percentage rate, or a currency amount. */
export type MetricUnit = 'rate' | 'currency';

/**
 * One business metric's before/after read. `before`/`after` are null when no real
 * row backs that side — a number is NEVER invented to fill the column.
 * `pctChange` is null whenever `before` is absent or zero (no honest baseline).
 */
export interface MetricDelta {
  kind: BusinessMetricKind;
  /** Everyday label ("Click-through rate"). */
  label: string;
  unit: MetricUnit;
  before: number | null;
  after: number | null;
  /** after − before; null when either side is absent. */
  delta: number | null;
  /** Percentage change vs the before baseline; null with no honest baseline. */
  pctChange: number | null;
}

/**
 * The business-metrics panel view. `hasData` is false (the current prod reality
 * until the analytics migration lands) → the screen renders an honest no-data
 * state, never a fabricated lift.
 */
export interface BusinessMetricsView {
  metrics: MetricDelta[];
  /** True only when at least one metric has a real row on either side. */
  hasData: boolean;
  /** The pivot date splitting before/after (the brand-change/re-measure point). */
  pivotDate: string | null;
}

// ── Experiment before/after lift (closes the test loop) ─────────────────────────

/**
 * The two terminal verdicts a tester can stamp on an experiment once a real
 * after-number exists: the change `won` (moved the metric the right way) or showed
 * `no_lift`. Written back to `brand_tests.status` — never inferred by the system.
 */
export type ExperimentVerdict = 'won' | 'no_lift';

/**
 * The display status of one experiment's lift:
 *  - `pending`   — the asset isn't live yet, or no post-live Windsor pull exists, so
 *                  there is no honest after-number (NEVER a fabricated lift).
 *  - `measured`  — a real after-number exists; the lift is computed but unjudged.
 *  - `won` / `no_lift` — the tester recorded the verdict (mirrors brand_tests.status).
 */
export type ExperimentLiftStatus = 'pending' | 'measured' | ExperimentVerdict;

/**
 * One experiment's before→after on its own metric and funnel piece — the case-study
 * unit of the Re-measure loop. `before` is the test's stored baseline; `after` is
 * either the recorded result or a post-`asset_live_at` `campaign_metrics` pull
 * (windowed by date, no snapshot table). Both are null when no real number backs
 * them → `pending`; the lift is NEVER fabricated to fill the gap.
 */
export interface ExperimentLift {
  /** brand_tests row id — the handle the mark-result action writes back to. */
  testId: string;
  /** Everyday label of the funnel piece under test. */
  pieceLabel: string;
  /** The metric the experiment moves. */
  metric: MetricKey;
  /** Everyday label for that metric (Tier-A). */
  metricLabel: string;
  /** How before/after/lift render (count | percent | currency | ratio). */
  format: MetricFormat;
  /** Baseline at open; null when unset. */
  before: number | null;
  /** Post-live measured value; null until a real number exists (honest pending). */
  after: number | null;
  /** after − before; null when either side is absent. */
  lift: number | null;
  /** Percentage change vs the baseline; null with no honest baseline. */
  liftPct: number | null;
  /** Lifecycle stage derived from the milestone dates + result (never stored). */
  stage: TestLifecycleStage;
  /** Display/verdict status (see ExperimentLiftStatus). */
  status: ExperimentLiftStatus;
}

// ── Service result discriminant (no-fabrication seam) ──────────────────────────

/**
 * The discriminated result every `remeasureService` method returns. `ok` carries
 * real data; `needs_input` carries the grounding demand (ask the user — e.g.
 * re-run the diagnostic after the fix); `error` carries a message. The service
 * NEVER synthesises data to avoid `needs_input` or `error` — honest degradation
 * over fabrication.
 */
export type RemeasureResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'error'; error: string };
