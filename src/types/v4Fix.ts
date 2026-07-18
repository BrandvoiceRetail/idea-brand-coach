/**
 * Loop-3 (Fix / Funnel) shared domain types.
 *
 * WHAT: The single contract the Fix screens (FunnelMap, WhatNeedsWork,
 * AssetDetailTabs, DriftBanner) and the `fixService` seam all import — funnel
 * map → impact-ranked work → asset detail/audit → Positioning Statement drift. Defining it
 * once keeps the screens and the integrator from drifting on field names.
 *
 * WHY: Loop-3 is the Diagnose→Analyse→Fix spine's "do the work" leg — map the
 * five-stage funnel, rank what would move the numbers most, work each asset, and
 * flag what drifted when the Positioning Statement changed. Like Loop-1/Loop-2, EVERY value
 * here is grounded: statuses come from the real coverage read, scores come from
 * the real audit engine, and a lift number is only ever shown when REAL campaign
 * metrics back it — never fabricated. The service returns `needs_input` or
 * `error` rather than synthesising a status, a score, or a lift.
 *
 * The result discriminant deliberately mirrors `AnalyseResult` in
 * `src/types/v4Analyse.ts` (same ok | needs_input | error shape) so the two
 * service seams share one mental model.
 */
import type { StageId } from '@/config/touchpointTaxonomy';
import type { NeedsInputItem } from '@/types/onboardingReflection';
import type { AssetStatus, AuditResult } from '@/services/interfaces/IBrandFunnelService';
import type { BriefSlots } from '@/types/v4Analyse';
import type { MetricKey, WindsorSource } from '@/config/v4Funnel';

/** Re-export so screens import the grounding-demand + audit shapes from one place. */
export type { NeedsInputItem, AuditResult, BriefSlots };
export type { MetricKey, WindsorSource } from '@/config/v4Funnel';

// ── Funnel Map (S-12) ─────────────────────────────────────────────────────────

/**
 * The four user-facing touchpoint statuses on the Funnel Map. A subset of the
 * service-layer `AssetStatus`: the transient `pending`/`failed` audit states are
 * folded into `misaligned` ("needs attention") for display — the map only ever
 * speaks in these four (Tier-A) words.
 */
export type TouchpointStatus = 'aligned' | 'stale' | 'misaligned' | 'missing';

/** One touchpoint's slot on the Funnel Map (taxonomy × the user's asset, if any). */
export interface Touchpoint {
  touchpointId: string;
  /** Everyday label from the taxonomy (Tier-A). */
  label: string;
  stage: StageId;
  /** Display status — `missing` when no asset exists yet. */
  status: TouchpointStatus;
  /** Last audit score 0-100; null when never audited / missing. */
  overallScore: number | null;
  /** The funnel asset backing this touchpoint; null when missing. */
  assetId: string | null;
  /** P0 (high-priority) touchpoint per the taxonomy. */
  p0: boolean;
}

/** One funnel stage with its applicable touchpoints, in funnel order. */
export interface FunnelStageView {
  stage: StageId;
  /** Everyday stage label ("Awareness", …). */
  label: string;
  /** Plain-language brand task for the stage (Tier-A). */
  brandTask: string;
  touchpoints: Touchpoint[];
}

/** The whole Funnel Map: stages + roll-up counts + coverage against target. */
export interface FunnelMapView {
  stages: FunnelStageView[];
  counts: { aligned: number; stale: number; misaligned: number; missing: number };
  /** aligned ÷ applicable, as a percentage. */
  coveragePct: number;
  /** The coverage target the brand is working toward. */
  targetPct: number;
}

// ── What needs work (S-13) ────────────────────────────────────────────────────

/**
 * Where a work item's rank came from. `metrics` = ranked by a REAL estimated
 * lift from campaign metrics; `coverage` = ranked by status severity + priority
 * only, because no campaign metrics are available yet (honest no-data).
 */
export type LiftBasis = 'metrics' | 'coverage';

/**
 * A touchpoint that needs attention, on the impact-ranked to-do list. Ranked by
 * the lift its fix could unlock on the numbers when real metrics back it, else by
 * status severity + priority. `estimatedLift` is null whenever metrics are
 * absent — a lift number is NEVER fabricated to fill the column.
 */
export interface WorkItem {
  touchpointId: string;
  label: string;
  stage: StageId;
  status: TouchpointStatus;
  /** The asset to open (null when the touchpoint is missing entirely). */
  assetId: string | null;
  /** 1-based rank by potential impact (1 = work on this first). */
  rank: number;
  /** Plain-language reason this ranks here. */
  reason: string;
  /**
   * Estimated lift on the numbers when REAL campaign metrics back it; null when
   * we have no metrics yet (honest no-data — never a fabricated number).
   */
  estimatedLift: number | null;
  /** Whether the rank used real metrics or only coverage status. */
  liftBasis: LiftBasis;
  /** P0 priority touchpoint. */
  p0: boolean;
}

// ── Asset detail (S-14) ───────────────────────────────────────────────────────

/**
 * One funnel asset's full working detail — its content, current status, and the
 * IDEA per-dimension audit verdict (null until it has been checked). The
 * `check-asset` tab populates `audit` from the real audit engine; it is never
 * synthesised.
 */
export interface AssetDetail {
  assetId: string;
  touchpointId: string;
  /** Everyday touchpoint label (Tier-A). */
  touchpointLabel: string;
  stage: StageId;
  /** The short context the user gave at upload. */
  contextDescription: string;
  /** Pasted copy, when the asset is text. */
  contentText: string | null;
  /** Private-bucket path to the screenshot, when the asset is an image. */
  storagePath: string | null;
  /** Service-layer status (the full union, incl. pending/failed). */
  status: AssetStatus;
  /** Latest audit score 0-100; null until audited. */
  overallScore: number | null;
  /** Prior score, to show movement; null when none. */
  previousScore: number | null;
  /** The IDEA per-dimension audit verdict; null until checked. */
  audit: AuditResult | null;
  /** The Positioning Statement version this asset was last aligned to. */
  positioningStatementVersion: string | null;
  updatedAt: string;
}

// ── Positioning Statement drift (S-15) ────────────────────────────────────────────────────

/**
 * One asset that drifted when the Positioning Statement changed — it was aligned to an older
 * Positioning Statement and now needs a re-check. The DriftBanner self-hides at zero items.
 */
export interface DriftItem {
  assetId: string;
  touchpointId: string;
  /** Everyday touchpoint label (Tier-A). */
  touchpointLabel: string;
  stage: StageId;
  /** The Positioning Statement version the asset was aligned to. */
  builtAgainst: string | null;
  /** The current Positioning Statement version it now drifts from. */
  currentPositioningStatement: string | null;
}

// ── Service result discriminant (no-fabrication seam) ─────────────────────────

/**
 * The discriminated result every `fixService` method returns. `ok` carries real
 * data; `needs_input` carries the grounding demand (ask the user — e.g. no avatar
 * yet); `error` carries a message. The service NEVER synthesises data to avoid
 * `needs_input` or `error` — honest degradation over fabrication.
 */
export type FixResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'error'; error: string };

// ── Funnel-by-Job: the unified funnel piece + its metrics ─────────────────────

/**
 * The 4-word job verdict for a funnel piece, the same vocabulary the Funnel Map
 * speaks: `doing_job` (on-brand + numbers hold), `leaking` (message breaks /
 * numbers below target), `off_brand` (on-page but working against the brand),
 * `missing` (no piece here yet). A subset/peer of `TouchpointStatus`, named in the
 * job-first language of the v4 funnel screens.
 */
export type JobVerdict = 'doing_job' | 'leaking' | 'off_brand' | 'missing';

/**
 * The stored, text-only snapshot of a piece's current creative (Alpha = no live
 * fetch, no image — decision #5). Every field is nullable: we show what was last
 * pasted/ingested and an honest "—" for anything absent, never a fabricated value.
 */
export interface StoredContent {
  /** Listing/asset title or subject line. */
  title: string | null;
  /** Bullet copy / key lines, in order. */
  bullets: string[];
  /** Stored price, as a display string (e.g. "$24.99"). */
  price: string | null;
  /** Stored star rating 0–5. */
  rating: number | null;
  /** Stored review count. */
  reviewCount: number | null;
  /** When the stored copy was last updated (ISO). */
  updatedAt: string | null;
}

/**
 * The unified funnel entity: one active brand asset = one funnel piece = one
 * campaign (decision #1). Metrics attach to THIS via its `id` (the brand_asset id).
 * Carries its job (from `FUNNEL_JOBS[stage]`) and its stored text-only content.
 */
/** One customer's verdict on a piece, when the funnel considers a multi-avatar set. */
export interface PieceAvatarVerdict {
  avatarId: string;
  avatarName: string;
  status: JobVerdict;
}

export interface FunnelPiece {
  /** The backing brand_asset id — the entity metrics attach to. */
  id: string;
  touchpointId: string;
  stage: StageId;
  /** Channel tag the piece lives on (e.g. "amazon", "email"); null when unknown. */
  channel: string | null;
  /** Job-first verdict for the map. */
  status: JobVerdict;
  /** The piece's plain-language job (from the stage job contract). */
  job: string;
  /** Stored, text-only current version (Alpha). */
  storedContent: StoredContent;
  /**
   * Per-avatar verdicts when >1 customer is in the funnel analysis. The piece's
   * `status` above is the deterministic weakest-link rollup of these (a piece is
   * `doing_job` only if it does its job for EVERY selected customer). Absent for
   * single-avatar (the common case).
   */
  perAvatar?: PieceAvatarVerdict[];
}

/** The metric window a `PieceMetrics` covers, matching the funnel toolbar. */
export type MetricRange = '7d' | '30d' | '90d';

/**
 * One metric's reading for a piece. `value === null` means honest no-data (render
 * "—", never fabricated). `derived` flags cvr/aov computed from primitives.
 */
export interface MetricCell {
  key: MetricKey;
  /** The value, in the metric's natural unit; null when no source backs it. */
  value: number | null;
  /** Where the value came from; null when no-data. */
  source: WindsorSource | null;
  /** True for cvr/aov (computed) rather than read straight from a source. */
  derived: boolean;
}

/**
 * Every metric we have (or honestly lack) for one funnel piece in a range. Keyed by
 * `MetricKey`; `noData` lists the keys with no backing value so screens can render
 * "—" deliberately. cvr/aov arrive as derived cells when their primitives exist.
 * Nothing here is ever fabricated to fill a gap.
 */
export interface PieceMetrics {
  /** The brand_asset id these metrics attach to. */
  pieceId: string;
  /** The window the readings cover. */
  range: MetricRange;
  /** Per-metric readings, including derived cvr/aov. */
  metrics: Partial<Record<MetricKey, MetricCell>>;
  /** Metric keys with no data this range — render "—", never invent a number. */
  noData: MetricKey[];
}

// ── Testing & Lift ────────────────────────────────────────────────────────────

/** Whether a test is still running or has a measured result. */
export type TestRowStatus = 'running' | 'completed';

/**
 * The experiment-lifecycle stage a test has reached, derived from its milestone
 * dates + result. The tester journey stamps these in order: store the split-test
 * IDEA (`idea`) → build the asset and stamp ASSET_CREATED (`asset_created`) → push
 * it live and stamp ASSET_LIVE (`asset_live`, which starts the re-measure clock) →
 * `measuring` while waiting on numbers → `complete` once a result is recorded.
 * Derived, never stored: the seam computes it from the two milestone dates + the
 * measured result, so the table and the case-study data never drift.
 */
export type TestLifecycleStage =
  | 'idea'
  | 'asset_created'
  | 'asset_live'
  | 'measuring'
  | 'complete';

/**
 * Standard vs competitor-informed test. Competitor agents are flag-gated / post-Alpha
 * (decision #6) — Alpha rows are always `standard`.
 */
export type TestKind = 'standard' | 'competitor';

/**
 * One row in the Testing & Lift table: the fix you put into a test and what it
 * moved. `result` is null while running. Lift (result vs baseline) is derived in the
 * screen — never stored as a fabricated number.
 */
export interface TestRow {
  /** brand_tests row id. */
  id: string;
  /** Human name of the test. */
  name: string;
  /** The funnel piece (brand_asset) under test; null if detached. */
  pieceId: string | null;
  /** Everyday label of the piece under test. */
  pieceLabel: string;
  /** The metric the test is moving. */
  metric: MetricKey;
  /** Baseline value at open; null when not set. */
  baseline: number | null;
  /** Measured result; null while running. */
  result: number | null;
  status: TestRowStatus;
  kind: TestKind;
  /** ISO date the experiment's asset was built (ASSET_CREATED milestone); null until stamped. */
  assetCreatedAt: string | null;
  /** ISO date the asset went live (ASSET_LIVE milestone — starts the re-measure clock); null until stamped. */
  assetLiveAt: string | null;
  /** Lifecycle stage derived from the milestone dates + result (never stored). */
  lifecycleStage: TestLifecycleStage;
}

// ── Fix & Test (S-16) ─────────────────────────────────────────────────────────

/**
 * "The leak" for a funnel piece: the one metric that's below target plus the
 * message-continuity break (what promise broke from the step before). Both
 * `current` and `target` are nullable — an absent reading renders an honest "—",
 * never a fabricated number; `continuityBreak` is null when the message holds.
 */
export interface FixLeak {
  /** The metric the leak is measured on. */
  metric: MetricKey;
  /** Current reading, in the metric's natural unit; null = honest no-data. */
  current: number | null;
  /** The target to hit, in the metric's natural unit; null when none is set. */
  target: number | null;
  /** Plain-language continuity break ("battle-ready" not echoed); null = holds. */
  continuityBreak: string | null;
}

// ── No-fabrication data seam (ok | no_data | error) ───────────────────────────

/**
 * The discriminated result the funnel-metrics seams return. Distinct from
 * `FixResult`: there is no `needs_input` here — these reads either have data, have
 * none yet (`no_data`, with a plain reason — e.g. Windsor not connected for this
 * piece), or failed (`error`). The seam NEVER synthesises a value to dodge
 * `no_data`; an absent metric is an honest "—", not a guess.
 */
export type DataResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'no_data'; reason: string }
  | { status: 'error'; error: string };
