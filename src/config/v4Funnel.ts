/**
 * /v4 Funnel-by-Job configuration — the single source of truth for "what is each
 * funnel piece's JOB, and which 2–3 numbers say whether it did it".
 *
 * WHAT: For every customer-journey stage (awareness → advocacy) this declares the
 * piece's plain-language JOB, the 2–3 `primaryMetrics` that actually measure that
 * job, and the `continuityLabel` — the message-handoff question ("did it hold the
 * promise from the step before and move the customer to the next step?"). Plus the
 * metric vocabulary (`MetricKey` + `METRIC_META`) and the `WindsorSource`
 * provenance tags for where a stored metric came from.
 *
 * WHY: Per the locked product decisions, one funnel piece = one active brand asset,
 * and each piece shows ONLY the handful of metrics that measure its job + messaging
 * continuity — never the full metric wall. Centralising the job/metric mapping here
 * (rather than hard-coding it in each card) keeps the Funnel Map, the asset detail,
 * and the service seam from drifting on "which metric matters where".
 *
 * This is config only — no data is fetched here and nothing is ever fabricated. The
 * service decides whether a real value backs each metric; this file only says which
 * metrics a piece's job calls for and how to label them.
 */
import type { StageId } from '@/config/touchpointTaxonomy';
import type { MetricRange } from '@/types/v4Fix';

// ── Metric vocabulary ─────────────────────────────────────────────────────────

/**
 * The full metric superset a funnel piece can carry, grouped by intent. A superset
 * deliberately wider than any one piece shows: each piece surfaces only its job
 * metrics (see `FUNNEL_JOBS`), the rest are available contextually on the detail.
 * `cvr` and `aov` are DERIVED (orders ÷ clicks; revenue ÷ orders) — never primitives.
 */
export type MetricKey =
  // Core (volume / engagement)
  | 'impressions'
  | 'sessions'
  | 'clicks'
  | 'views'
  | 'ctr'
  | 'cvr'
  | 'opens'
  | 'engagement'
  // Revenue
  | 'orders'
  | 'revenue'
  | 'aov'
  | 'units_sold'
  // Efficiency
  | 'spend'
  | 'cpc'
  | 'acos'
  | 'roas'
  // Acquisition / retention
  | 'new_to_brand'
  | 'repeat_rate'
  | 'return_rate'
  | 'reviews'
  | 'subscribe_save';

/** Which superset bucket a metric belongs to (drives grouping on the detail). */
export type MetricGroup = 'core' | 'revenue' | 'efficiency' | 'acquisition';

/** How a metric value is rendered. */
export type MetricFormat = 'count' | 'percent' | 'currency' | 'ratio';

/**
 * The platform a metric is read from, via the user's Windsor connector. Mirrors the
 * connected Windsor connector slugs (decision #4). `derived` = computed from other
 * metrics (cvr/aov); `manual` = entered by hand. Never fabricated.
 */
export type WindsorSource =
  | 'amazon_ads'
  | 'amazon_sp'
  | 'facebook'
  | 'googleanalytics4'
  | 'tiktok_shop'
  | 'google_my_business'
  | 'derived'
  | 'manual';

/** Display + formatting metadata for one metric. */
export interface MetricMeta {
  /** Everyday label (Tier-A, no internal jargon). */
  label: string;
  group: MetricGroup;
  format: MetricFormat;
}

/** Label + format + group for every metric in the superset. */
export const METRIC_META: Readonly<Record<MetricKey, MetricMeta>> = {
  // Core
  impressions: { label: 'Traffic (impr.)', group: 'core', format: 'count' },
  sessions: { label: 'Sessions', group: 'core', format: 'count' },
  clicks: { label: 'Clicks', group: 'core', format: 'count' },
  views: { label: 'Views', group: 'core', format: 'count' },
  ctr: { label: 'CTR', group: 'core', format: 'percent' },
  cvr: { label: 'CVR', group: 'core', format: 'percent' },
  opens: { label: 'Open rate', group: 'core', format: 'percent' },
  engagement: { label: 'Engagement', group: 'core', format: 'count' },
  // Revenue
  orders: { label: 'Orders', group: 'revenue', format: 'count' },
  revenue: { label: 'Revenue', group: 'revenue', format: 'currency' },
  aov: { label: 'AOV', group: 'revenue', format: 'currency' },
  units_sold: { label: 'Units sold', group: 'revenue', format: 'count' },
  // Efficiency
  spend: { label: 'Spend', group: 'efficiency', format: 'currency' },
  cpc: { label: 'CPC', group: 'efficiency', format: 'currency' },
  acos: { label: 'ACoS', group: 'efficiency', format: 'percent' },
  roas: { label: 'ROAS', group: 'efficiency', format: 'ratio' },
  // Acquisition / retention
  new_to_brand: { label: 'New-to-brand', group: 'acquisition', format: 'percent' },
  repeat_rate: { label: 'Repeat rate', group: 'acquisition', format: 'percent' },
  return_rate: { label: 'Return rate', group: 'acquisition', format: 'percent' },
  reviews: { label: 'Reviews', group: 'acquisition', format: 'count' },
  subscribe_save: { label: 'Subscribe & Save', group: 'acquisition', format: 'count' },
};

/** The two metrics computed from primitives rather than read directly. */
export const DERIVED_METRICS: readonly MetricKey[] = ['cvr', 'aov'] as const;

/** Whether a metric is derived (cvr/aov) rather than read straight from a source. */
export const isDerivedMetric = (key: MetricKey): boolean => DERIVED_METRICS.includes(key);

// ── Metric range (the window the readings cover) ──────────────────────────────

/**
 * Everyday label for each metric window, shared by the Funnel Map toolbar's range
 * selector and the piece-detail metrics header so the two never drift on what a
 * range reads as. `'30d'` is the trailing 30 calendar days from today (the metrics
 * edge fn subtracts N days from now), so "Last 30 days" is literally accurate.
 */
export const RANGE_LABELS: Readonly<Record<MetricRange, string>> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// ── Per-stage job contract ────────────────────────────────────────────────────

/**
 * The contract for one customer-journey stage: its plain-language JOB, the 2–3
 * metrics that measure that job, and the continuity question (did it hold the
 * message from the step before + move the customer on?).
 */
export interface FunnelJob {
  /** What every piece at this stage is *for*, in one line (Tier-A). */
  job: string;
  /** The 2–3 metrics that say whether this stage's piece did its job. */
  primaryMetrics: MetricKey[];
  /** The message-continuity question for a piece at this stage. */
  continuityLabel: string;
}

/**
 * Job contract per customer-journey stage. Metric picks follow the locked decision:
 * Awareness → Traffic/CTR; Consideration → CVR/AOV; Purchase → CVR/Return-rate;
 * Retention (email) → Open/CTR-to-next/Repeat; Advocacy → Reviews/Repeat.
 */
export const FUNNEL_JOBS: Readonly<Record<StageId, FunnelJob>> = {
  awareness: {
    job: 'Get the brand seen by in-market buyers and earn the click.',
    primaryMetrics: ['impressions', 'ctr'],
    continuityLabel:
      'Opens the promise — does it stop the scroll and send them to the listing?',
  },
  consideration: {
    job: 'Deliver the promise the ad made and build the case to buy.',
    primaryMetrics: ['cvr', 'aov'],
    continuityLabel:
      'Echoes the step before — does the page keep the promise and move them toward checkout?',
  },
  purchase_decision: {
    job: 'Remove the last risk and turn the decision into an order.',
    primaryMetrics: ['cvr', 'return_rate'],
    continuityLabel:
      'Carries the promise to checkout — does it close the sale without breaking trust?',
  },
  retention: {
    job: 'Continue the story after the sale and earn the next action.',
    primaryMetrics: ['opens', 'ctr', 'repeat_rate'],
    continuityLabel:
      'Picks up where the purchase left off — does it keep them engaged and coming back?',
  },
  advocacy: {
    job: 'Turn a satisfied buyer into proof and referrals.',
    primaryMetrics: ['reviews', 'repeat_rate'],
    continuityLabel:
      'Closes the loop — does a happy customer become the next customer’s reason to buy?',
  },
};

/** The job contract for a stage. */
export const getFunnelJob = (stage: StageId): FunnelJob => FUNNEL_JOBS[stage];
