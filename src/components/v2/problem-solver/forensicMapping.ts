/**
 * Problem-Solver flow — forensic response → client shapes.
 *
 * Mirrors the mapping ForensicAnalysisPanel uses (the diagnostic-results flow):
 * snake_case `decision_trigger` → camelCase DecisionTriggerResult, and /25 pillars
 * → the buildTrustGap input scale. Shared here so S5 (scorecard) and S6 (trigger)
 * reuse one source of truth rather than re-deriving it per screen.
 */

import { TRUST_GAP_MAX_PER_DIMENSION, type TrustGapInputScores } from '@/lib/trustGap';
import { DECISION_TRIGGER_TYPES, type DecisionTriggerType } from '@/lib/decisionTrigger';
import type { DecisionTriggerResult } from '@/components/decision-trigger/types';
import type { ForensicScores } from './types';

/** Plain divisor turning a displayed /25 pillar back into the 0-100 scale buildTrustGap rescales from. */
const PILLAR_TO_RAW = 100 / TRUST_GAP_MAX_PER_DIMENSION;

/** Convert forensic /25 pillars + /100 overall into the buildTrustGap input scale. */
export function forensicToInputScores(scores: ForensicScores): TrustGapInputScores {
  return {
    insight: Math.round(scores.insight * PILLAR_TO_RAW),
    distinctive: Math.round(scores.distinctive * PILLAR_TO_RAW),
    empathetic: Math.round(scores.empathetic * PILLAR_TO_RAW),
    authentic: Math.round(scores.authentic * PILLAR_TO_RAW),
    overall: scores.overall,
  };
}

/**
 * Map the server `decision_trigger` object to the client DecisionTriggerResult.
 * Tolerates both the internal snake_case shape from identify-decision-trigger and
 * the camelCase variant. Returns undefined on an unusable shape so the UI omits
 * the trigger rather than rendering junk.
 */
export function mapDecisionTrigger(raw: unknown): DecisionTriggerResult | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const dominant = (r.dominant_type ?? r.dominantType) as unknown;
  const anchor = (r.brand_anchor ?? r.brandAnchor) as unknown;
  const phrases = (r.evidence_phrases ?? r.evidencePhrases) as unknown;
  const placement = (r.placement_instruction ?? r.placementInstruction) as unknown;
  const why = (r.why_this_trigger ?? r.whyThisTrigger) as unknown;

  if (typeof dominant !== 'string' || !DECISION_TRIGGER_TYPES.includes(dominant as DecisionTriggerType)) {
    return undefined;
  }
  if (typeof anchor !== 'string' || typeof placement !== 'string') return undefined;

  return {
    id: typeof r.id === 'string' ? r.id : null,
    dominantType: dominant as DecisionTriggerType,
    brandAnchor: anchor,
    evidencePhrases: Array.isArray(phrases)
      ? phrases.filter((p): p is string => typeof p === 'string')
      : [],
    placementInstruction: placement,
    whyThisTrigger: typeof why === 'string' ? why : '',
  };
}
