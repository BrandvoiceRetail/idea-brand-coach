/**
 * Layer 1 (service) — derive the four IDEA dimension scores FROM EVIDENCE.
 *
 * The keystone the onboarding session dead-ended on: `run_diagnostic_evidence` *interprets*
 * scores you supply, but nothing *derives* the scores from the user's own evidence — so the
 * Trust Gap was unreachable without the user hand-entering four numbers (which the firewall
 * rightly forbids inventing). This service fills exactly that gap, then feeds the SAME
 * deterministic `buildTrustGap` engine the app uses (Calculation Parity).
 *
 * Derive ≠ fabricate (docs/mcp/ONBOARD_ORCHESTRATOR_DESIGN.md):
 *  - every derived score is produced by the evidence engine and carries its citations +
 *    a confidence level + a grounding flag;
 *  - a CONFIDENCE FLOOR (honesty over alarm-farming): a dimension the engine can't read with
 *    at least medium confidence is NOT scored — it returns needs_input naming what would
 *    unlock it. The overall Trust Gap is only computed when all four clear the floor;
 *  - the result is explicitly PROVISIONAL — the caller confirms, never asserted as fact.
 *
 * Pure orchestration; the LLM derivation is the injected `DeriveEngine` (live = the
 * evidence edge fn in derive mode), so this is fully unit-testable.
 */
import {
  buildTrustGap,
  type RawDimensionScores,
  type TrustGapResult,
  type TrustGapDimension,
  TRUST_GAP_DIMENSIONS,
} from '../../lib/trustGap.js';

export type Confidence = 'high' | 'medium' | 'low';

/** One dimension as derived by the evidence engine. */
export interface DerivedDimension {
  dimension: TrustGapDimension;
  /** 0-100, the engine's evidence-derived read. */
  score: number;
  confidence: Confidence;
  grounding: 'evidence' | 'inference';
  /** Verbatim evidence snippets the score traces to (provenance). */
  citations: string[];
  /** Plain-language read of this dimension, in the buyer's terms (no framework jargon). */
  read: string;
}

/** The injected LLM derivation. Live = the evidence edge fn in derive mode. */
export type DeriveEngine = (
  evidence: Record<string, string>,
) => Promise<{ ok: boolean; dimensions?: DerivedDimension[]; note?: string }>;

/** A dimension the engine could not read confidently enough to score. */
export interface DimensionNeedsInput {
  dimension: TrustGapDimension;
  why: string;
}

export interface AssessResult {
  ok: boolean;
  /** Always true on success — these scores are a starting read, for the user to confirm. */
  provisional: boolean;
  scores?: RawDimensionScores;
  trustGap?: TrustGapResult;
  dimensions: DerivedDimension[];
  /** Dimensions below the confidence floor — ask, don't fabricate. */
  needsInput: DimensionNeedsInput[];
  note?: string;
}

/** Confidence at or above this clears the floor. 'low' is below — we ask rather than score. */
function clearsFloor(c: Confidence): boolean {
  return c === 'high' || c === 'medium';
}

/**
 * Derive the four scores from evidence, apply the confidence floor, and — only when all four
 * clear it — compute the Trust Gap via the parity engine. Otherwise return the reads we have
 * plus needs_input for the rest. Never fabricates a score for a dimension it can't read.
 */
export async function assessIdeaDimensions(
  evidence: Record<string, string>,
  engine: DeriveEngine,
): Promise<AssessResult> {
  if (Object.keys(evidence).length === 0) {
    return {
      ok: false,
      provisional: false,
      dimensions: [],
      needsInput: TRUST_GAP_DIMENSIONS.map((d) => ({
        dimension: d,
        why: 'No listing or review evidence on file yet — share your listing + a few reviews and I can read this.',
      })),
      note: 'no evidence to read',
    };
  }

  const res = await engine(evidence);
  if (!res.ok || !res.dimensions || res.dimensions.length === 0) {
    return { ok: false, provisional: false, dimensions: [], needsInput: [], note: res.note ?? 'derivation unavailable' };
  }

  // Index by dimension; any missing dimension is treated as unreadable (needs_input).
  const byDim = new Map<TrustGapDimension, DerivedDimension>();
  for (const d of res.dimensions) byDim.set(d.dimension, d);

  const dimensions: DerivedDimension[] = [];
  const needsInput: DimensionNeedsInput[] = [];
  for (const dim of TRUST_GAP_DIMENSIONS) {
    const d = byDim.get(dim);
    if (!d) {
      needsInput.push({ dimension: dim, why: `Not enough in your evidence to read ${dim} yet.` });
      continue;
    }
    dimensions.push(d);
    if (!clearsFloor(d.confidence)) {
      needsInput.push({
        dimension: dim,
        why: `I can only read ${dim} weakly from what's on file — one concrete example would let me score it honestly.`,
      });
    }
  }

  // The overall Trust Gap is only honest when all four clear the floor.
  const allClear = needsInput.length === 0 && dimensions.length === TRUST_GAP_DIMENSIONS.length;
  if (!allClear) {
    return {
      ok: true,
      provisional: true,
      dimensions,
      needsInput,
      note: 'partial read — some dimensions need one more input before I can show your full Trust Gap',
    };
  }

  const scores: RawDimensionScores = {
    insight: clamp100(byDim.get('insight')!.score),
    distinctive: clamp100(byDim.get('distinctive')!.score),
    empathetic: clamp100(byDim.get('empathetic')!.score),
    authentic: clamp100(byDim.get('authentic')!.score),
  };
  const overall = Math.round(
    (scores.insight + scores.distinctive + scores.empathetic + scores.authentic) / 4,
  );
  const trustGap = buildTrustGap({ ...scores, overall });

  return { ok: true, provisional: true, scores, trustGap, dimensions, needsInput: [] };
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
