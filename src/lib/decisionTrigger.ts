/**
 * Decision Trigger™ — shared front-end constants + the deterministic Stage-1 prior.
 *
 * The `identify-decision-trigger` edge function carries its own copy of this
 * mapping (the Deno runtime can't import from `src/`), so if the §5.2 correlation
 * changes, update BOTH this file and the function. Kept pure and dependency-free
 * so it is trivially unit-testable.
 *
 * Spec: Decision Trigger Developer Brief v2.20 §5.2.
 */

import type { TrustGapDimension, TrustGapInputScores } from '@/lib/trustGap';

export const DECISION_TRIGGER_TYPES = [
  'Identity', 'Belonging', 'Permission', 'Fear-of-Loss', 'Recognition', 'Momentum',
] as const;

export type DecisionTriggerType = typeof DECISION_TRIGGER_TYPES[number];

/** Brief §5.2: the LOW pillar predicts the trigger. Momentum and Fear-of-Loss are
 *  NOT score-predicted — they are surfaced only from review text by Stage 2. */
export const PILLAR_TRIGGER: Record<TrustGapDimension, DecisionTriggerType> = {
  empathetic: 'Recognition',
  distinctive: 'Identity',
  insight: 'Permission',
  authentic: 'Belonging',
};

const PRIOR_DIMENSIONS: readonly TrustGapDimension[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

export interface TriggerPrior {
  trigger: DecisionTriggerType;
  pillar: TrustGapDimension;
  score: number;
}

/**
 * Stage 1 — the deterministic prior. Ranks the four score-predicted triggers
 * weakest-pillar-first, so the lowest Trust Gap pillar yields the strongest
 * trigger hypothesis. Scale-independent: works on /25 or /100 inputs.
 */
export function derivePrior(scores: Pick<TrustGapInputScores, TrustGapDimension>): TriggerPrior[] {
  return PRIOR_DIMENSIONS
    .map((pillar) => ({ trigger: PILLAR_TRIGGER[pillar], pillar, score: scores[pillar] }))
    .sort((a, b) => a.score - b.score);
}
