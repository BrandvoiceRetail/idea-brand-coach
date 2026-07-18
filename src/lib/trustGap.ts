/**
 * Trust Gap™ scorecard helpers.
 *
 * The diagnostic stores four IDEA dimension scores on a 0-100 scale plus an
 * `overall` (their average, also 0-100). The Trust Gap™ scorecard presents each
 * dimension on a /25 scale so the four pillars visibly sum to the overall /100.
 *
 * This module is the deterministic core of the scorecard (Layer 3): rescaling,
 * primary-gap detection, score bands, and gap-based routing all live here so the
 * UI and the interpretation hook share one source of truth. No network, no React.
 */

export type TrustGapDimension = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

/** Raw IDEA dimension scores as stored by the diagnostic (each 0-100). */
export interface RawDimensionScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
}

/** Full score object as persisted in `diagnostic_submissions.scores`. */
export interface TrustGapInputScores extends RawDimensionScores {
  /** Average of the four dimensions, 0-100. */
  overall: number;
}

/** Canonical dimension order used everywhere the pillars are listed. */
export const TRUST_GAP_DIMENSIONS: readonly TrustGapDimension[] = [
  'insight',
  'distinctive',
  'empathetic',
  'authentic',
] as const;

const RAW_MAX_PER_DIMENSION = 100;
export const TRUST_GAP_MAX_PER_DIMENSION = 25;
/** 100 / 25 = 4. Display-rescale divisor (PATH A — Trevor Decision 4). */
const RESCALE_DIVISOR = RAW_MAX_PER_DIMENSION / TRUST_GAP_MAX_PER_DIMENSION;

export interface TrustGapDimensionMeta {
  key: TrustGapDimension;
  /** Display label, matches the goal's dimension names. */
  label: string;
  /** One-line, plain-language statement of what the pillar measures. */
  measures: string;
  /** Route the "Let's go deeper" CTA sends the user to for this gap. */
  route: string;
}

/**
 * Per-dimension metadata. The `route` values are guest-accessible IDEA pages
 * (see src/App.tsx — wrapped only in <Layout>, not ProtectedRoute), so gap-based
 * routing works for authenticated users and guests alike.
 */
export const TRUST_GAP_DIMENSION_META: Record<TrustGapDimension, TrustGapDimensionMeta> = {
  insight: {
    key: 'insight',
    label: 'Insight',
    measures: 'How well you understand what really drives your customer.',
    route: '/v1/idea/insight',
  },
  distinctive: {
    key: 'distinctive',
    label: 'Distinctive',
    measures: 'How clearly you stand out instead of blending in.',
    route: '/v1/idea/distinctive',
  },
  empathetic: {
    key: 'empathetic',
    label: 'Empathetic',
    measures: 'How deeply your customers feel understood by you.',
    route: '/v1/idea/empathy',
  },
  authentic: {
    key: 'authentic',
    label: 'Authentic',
    measures: 'How genuine and believable your brand feels.',
    route: '/v1/idea/authenticity',
  },
};

export type TrustGapBand = 'weak' | 'mixed' | 'strong';

/**
 * Map a /25 dimension score to a band. Thresholds mirror the bands described to
 * the interpretation model so the visual colour and the coaching read agree.
 */
export function getTrustGapBand(score25: number): TrustGapBand {
  if (score25 <= 9) return 'weak';
  if (score25 <= 17) return 'mixed';
  return 'strong';
}

/** Rescale one raw 0-100 dimension score to the displayed /25 value. */
export function rescaleDimension(raw: number): number {
  const safe = Number.isFinite(raw) ? raw : 0;
  const clamped = Math.max(0, Math.min(RAW_MAX_PER_DIMENSION, safe));
  return Math.round(clamped / RESCALE_DIVISOR);
}

export interface TrustGapDimensionResult extends TrustGapDimensionMeta {
  /** Raw 0-100 score as stored. */
  raw: number;
  /** Display score on the /25 scale. */
  score: number;
  band: TrustGapBand;
}

export interface TrustGapResult {
  /** Overall score, 0-100. */
  overall: number;
  /** Dimensions in canonical order, each with raw + /25 score. */
  dimensions: TrustGapDimensionResult[];
  /** Lowest-scoring dimension (ties resolved by canonical order). */
  primaryGap: TrustGapDimension;
  primaryGapMeta: TrustGapDimensionMeta;
}

/**
 * Build the full scorecard model from raw stored scores.
 * Pure and total: handles missing/NaN fields by treating them as 0.
 */
export function buildTrustGap(scores: TrustGapInputScores): TrustGapResult {
  const dimensions: TrustGapDimensionResult[] = TRUST_GAP_DIMENSIONS.map((key) => {
    const raw = Number.isFinite(scores?.[key]) ? scores[key] : 0;
    const score = rescaleDimension(raw);
    return {
      ...TRUST_GAP_DIMENSION_META[key],
      raw,
      score,
      band: getTrustGapBand(score),
    };
  });

  // Primary gap = lowest raw score. Strict `<` keeps the first dimension in
  // canonical order on a tie (so an all-equal distribution names Insight).
  let primaryGap: TrustGapDimension = TRUST_GAP_DIMENSIONS[0];
  let lowest = Number.POSITIVE_INFINITY;
  for (const dim of dimensions) {
    if (dim.raw < lowest) {
      lowest = dim.raw;
      primaryGap = dim.key;
    }
  }

  const overallRaw = Number.isFinite(scores?.overall) ? scores.overall : 0;

  return {
    overall: Math.max(0, Math.min(RAW_MAX_PER_DIMENSION, Math.round(overallRaw))),
    dimensions,
    primaryGap,
    primaryGapMeta: TRUST_GAP_DIMENSION_META[primaryGap],
  };
}

/**
 * Stable positioning statement for a score set, used to cache an interpretation so navigating
 * back to the results page does not re-bill the model for identical scores.
 */
export function trustGapPositioningStatement(scores: TrustGapInputScores): string {
  const result = buildTrustGap(scores);
  const dims = result.dimensions.map((d) => `${d.key}:${d.score}`).join('|');
  return `v1|overall:${result.overall}|${dims}`;
}
