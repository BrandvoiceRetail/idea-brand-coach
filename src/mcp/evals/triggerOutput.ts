/**
 * Decision-Trigger output validator — pure, CI-checkable contract mirror.
 *
 * The live Decision-Trigger engine is a Deno edge function (`identify-decision-trigger`)
 * and can't be imported here. This module mirrors its OUTPUT contract as a pure validator
 * so the exact regressions we've hit in prod are caught in CI instead:
 *   - the Recognition anchor coming back as Lego (Lego is Identity; the anchor must be Dove);
 *   - CAPTURE element names (Tier B) leaking into user-facing placement text at Alpha;
 *   - missing / empty evidence_phrases (an unquoted, evidence-free trigger).
 *
 * Pure + deterministic (no clock/network/model/browser/Deno APIs) so it unit-tests in CI.
 */

export const TRIGGER_TYPES = [
  'Identity',
  'Belonging',
  'Permission',
  'Fear-of-Loss',
  'Recognition',
  'Momentum',
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** The one canonical brand anchor per trigger (Recognition = Dove, NOT Lego). */
export const FIXED_ANCHORS: Record<TriggerType, string> = {
  Identity: 'Apple',
  Belonging: 'Patagonia',
  Permission: 'Harvard Medical School',
  'Fear-of-Loss': 'FOMO',
  Recognition: 'Dove',
  Momentum: "Amazon's Choice",
};

export interface TriggerOutput {
  dominant_type: string;
  brand_anchor: string;
  evidence_phrases: string[];
  placement_instruction: string;
  why_this_trigger?: string;
}

export interface TriggerValidation {
  valid: boolean;
  violations: string[];
}

/**
 * CAPTURE element names (Tier B) that must NOT appear in user-facing placement text at Alpha.
 * Covers the engine element names + the edge-fn variants (Contextual, Pain/Problem,
 * Transformation, Emotional CTA).
 */
const CAPTURE_ELEMENT_NAMES =
  /\b(Contextual|Attention|Pain\/?Problem|Transformation|Uniqueness|Reassurance|Emotional CTA|Context|Transform|Escalate)\b/;

const isTriggerType = (t: string): t is TriggerType =>
  (TRIGGER_TYPES as readonly string[]).includes(t);

export function validateTriggerOutput(o: TriggerOutput): TriggerValidation {
  const violations: string[] = [];

  if (!isTriggerType(o.dominant_type)) {
    violations.push(
      `dominant_type "${o.dominant_type}" is not a recognised trigger (expected one of: ${TRIGGER_TYPES.join(', ')}).`,
    );
  }

  // Wrong-anchor check. At minimum, a Recognition output must anchor on Dove and never Lego
  // (Lego is the Identity anchor in the book; the prod regression was Recognition→Lego).
  if (o.dominant_type === 'Recognition') {
    const anchor = o.brand_anchor;
    if (!/dove/i.test(anchor)) {
      violations.push(
        `Recognition brand_anchor must reference "Dove" (the canonical Recognition anchor); got "${anchor}".`,
      );
    }
    if (/lego/i.test(anchor)) {
      violations.push(
        `Recognition brand_anchor must NOT name "Lego" (Lego is the Identity anchor, not Recognition).`,
      );
    }
  }

  if (CAPTURE_ELEMENT_NAMES.test(o.placement_instruction)) {
    const leaked = o.placement_instruction.match(CAPTURE_ELEMENT_NAMES)?.[0];
    violations.push(
      `placement_instruction leaks a CAPTURE element name (Tier B) — "${leaked}" must not appear in user-facing placement text at Alpha.`,
    );
  }

  const evidenceOk =
    Array.isArray(o.evidence_phrases) &&
    o.evidence_phrases.length >= 1 &&
    o.evidence_phrases.every((p) => typeof p === 'string' && p.trim().length > 0);
  if (!evidenceOk) {
    violations.push(
      'evidence_phrases must be a non-empty array of non-empty strings (>= 1 quoted phrase).',
    );
  }

  return { valid: violations.length === 0, violations };
}
