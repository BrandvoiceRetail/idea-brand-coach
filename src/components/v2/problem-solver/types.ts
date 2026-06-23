/**
 * Problem-Solver flow — the run-forensic-analysis response contract (client side)
 * plus the flow's shared state shape.
 *
 * The forensic response shape mirrors the edge function
 * (supabase/functions/run-forensic-analysis/index.ts): forensic_scores (0-25
 * pillars / 0-100 overall), per-dimension interpretation, the snake_case
 * decision_trigger, the NEW customer_profile (S5's four cards), the corpus size,
 * and the thin-corpus flag. Kept narrow + defensively narrowed at the boundary.
 */

import type { TrustGapDimension, TrustGapInputScores } from '@/lib/trustGap';

/** Forensic pillar scores: each pillar 0-25, overall 0-100 (derived from the corpus). */
export interface ForensicScores {
  insight: number;
  distinctive: number;
  empathetic: number;
  authentic: number;
  overall: number;
}

/** One per-dimension evidence read from diagnostic-interpretation-evidence. */
export interface InterpretationDimension {
  dimension: string;
  brand_read?: string;
  what_it_measures?: string;
  grounding?: 'evidence' | 'inference';
}

/** The interpretation object echoed by run-forensic-analysis (evidence fn shape). */
export interface ForensicInterpretation {
  dimensions?: InterpretationDimension[];
  primaryGapSummary?: string;
}

/** The S5 "Your customer profile" four fields, derived from the review corpus. */
export interface CustomerProfile {
  how_they_talk: string;
  why_buying_now: string;
  what_builds_trust: string;
  what_stops_them: string;
}

/** Successful run-forensic-analysis response (shared contract). */
export interface ForensicResponse {
  ok: true;
  asin: string;
  reviews_analyzed: number;
  thin_corpus: boolean;
  forensic_scores: ForensicScores;
  primary_gap: TrustGapDimension;
  interpretation: ForensicInterpretation;
  decision_trigger: unknown;
  customer_profile?: CustomerProfile;
  emailed?: boolean;
  listing: { title?: string; bullets?: string[] };
}

/** State shared across the eight screens, owned by the flow shell. */
export interface ProblemSolverFlowState {
  /** Self-report Trust Gap from S1 (0-100 pillars + overall), null until diagnosed. */
  selfReport: TrustGapInputScores | null;
  /** ASIN captured in S3 (uppercase, validated). */
  asin: string | null;
  /** Forensic report from S4, null until the run completes. */
  report: ForensicResponse | null;
}

/** Narrow an unknown forensic response to the success contract. */
export function isForensicResponse(data: unknown): data is ForensicResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.ok !== true || typeof d.asin !== 'string') return false;
  if (typeof d.reviews_analyzed !== 'number' || typeof d.thin_corpus !== 'boolean') return false;
  const s = d.forensic_scores as Record<string, unknown> | undefined;
  if (!s) return false;
  return (['insight', 'distinctive', 'empathetic', 'authentic', 'overall'] as const).every(
    (k) => typeof s[k] === 'number',
  );
}
