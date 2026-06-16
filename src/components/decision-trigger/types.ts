/**
 * Client-facing Decision Trigger™ result.
 *
 * Deliberately NARROWER than the DB row: it carries no confidence score, no
 * score prior, and no model internals. The output must "feel like a finding,
 * not a calculation" (Developer Brief v2.20 §1.2 / §3.4), so the certainty
 * number the model produced never crosses the wire to the panel.
 */
export type { DecisionTriggerType } from '@/lib/decisionTrigger';
import type { DecisionTriggerType } from '@/lib/decisionTrigger';

export interface DecisionTriggerResult {
  id: string | null;
  dominantType: DecisionTriggerType;
  /** One-line brand analog, e.g. "like Lego, your customer buys the feeling of being understood". */
  brandAnchor: string;
  /** 2-3 verbatim phrases from the seller's own reviews/listing. */
  evidencePhrases: string[];
  /** One <=2-sentence deployment instruction naming a CAPTURE element. */
  placementInstruction: string;
  /** Plain-language "why this trigger" for the secondary expansion. */
  whyThisTrigger: string;
}
