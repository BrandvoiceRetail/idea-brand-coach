/**
 * Image output-quality eval — the OPTED-IN customer corpus (ground truth).
 *
 * OPT-IN PROVENANCE: this corpus is the real Infinity Vault brand's own data (listing,
 * review vocabulary, resolved positioning). The brand owner (support@infinityvaultcards.com)
 * has CERTIFIED it is opted in for use as evaluation ground truth. It is the same brand the
 * behavioural suite's hero cases use (cases/catalog.ts: `infinityvault-recognition` /
 * `alpha-trajectory-infinityvault`) — kept here as a structured record so the IMAGE rubric
 * can score a produced deliverable against the seller's actual problem, not a hypothetical.
 *
 * This module is PURE DATA (no I/O) so it type-checks under tsconfig.mcp.json and both the
 * node runner and the vision judge import it. Nothing here is a customer PII record — it is
 * the brand's own listing facts + the aggregate review pattern that produced the Trust Gap.
 */

/** The six IDEA Decision Triggers (mirrors the tool enum). */
export type DecisionTrigger =
  | 'permission'
  | 'recognition'
  | 'identity'
  | 'belonging'
  | 'momentum'
  | 'fear_of_loss';

export type IdeaPillar = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

export interface OptedInBrandCorpus {
  /** Stable id used by image cases' corpusRef. */
  id: string;
  brand: string;
  product: string;
  asin: string;
  price: string;
  category: string;
  rivals: string[];
  /** Owner opt-in certification (who, and that it is opted in). */
  optIn: { certifiedBy: string; scope: string };
  /** The seller's measurable core problem — what every deliverable must move. */
  coreProblem: string;
  /** The current (losing) listing promise the deliverable must beat. */
  currentPromise: string;
  /** The resolved positioning spine (the same the coach would resolve from the corpus). */
  positioning: {
    trustGapPillar: IdeaPillar;
    trustGapSummary: string;
    decisionTrigger: DecisionTrigger;
    /** Canonical brand anchor for the trigger (Recognition → Dove). */
    anchor: string;
    avatarCore: string;
    positioning_statement: string;
  };
  /** Aggregate review vocabulary (the pattern, not individual reviewers) that built the avatar. */
  reviewVoice: {
    /** Verbatim aggregate phrases (each stands for a cluster of similar reviews). */
    phrases: string[];
    /** The felt experience the empathetic beats must mirror. */
    feltExperience: string;
  };
  /** Facts the seller CONFIRMED — the only claims a deliverable may state (the claim gate whitelist). */
  verifiedFacts: string[];
  /** Claims that would be FABRICATION if a deliverable stated them (the red-team set). */
  prohibitedClaims: string[];
}

/**
 * Infinity Vault — the hero opted-in corpus. Empathetic is the weakest pillar (collectors
 * arrive braced for disappointment after a cheap binder bent their cards); the resolved
 * trigger is Recognition (Dove anchor) — mirror the felt failure before the spec proof.
 */
export const INFINITY_VAULT: OptedInBrandCorpus = {
  id: 'infinity-vault-216-binder',
  brand: 'InfinityVault',
  product: 'Premium 216-card trading-card binder',
  asin: 'B0CARD0001',
  price: '$34',
  category: 'Trading-card storage / TCG accessories',
  rivals: ['Gamegenic', 'Ultimate Guard', 'Vault X'],
  optIn: {
    certifiedBy: 'support@infinityvaultcards.com (brand owner)',
    scope: 'Own-brand listing facts + aggregate review pattern, certified opted in for eval ground truth.',
  },
  coreProblem:
    'Traffic is fine but conversion on the hero SKU is below category average — the main image + gallery are not earning the click/purchase against Gamegenic / Ultimate Guard / Vault X.',
  currentPromise: 'Specs-led: "216 pockets, acid-free, side-loading" — leads with features, not the collector\'s fear.',
  positioning: {
    trustGapPillar: 'empathetic',
    trustGapSummary: 'Empathetic is the weakest pillar: the listing proves specs but never acknowledges the collector\'s past-failure fear.',
    decisionTrigger: 'recognition',
    anchor: 'Dove (emotional mirroring — acknowledge the felt reality before the proof)',
    avatarCore:
      'The serious collector who has already had cards bent or damaged by a cheap binder — arrives braced for disappointment and needs to feel understood before trusting a new one.',
    positioning_statement: 'The binder serious collectors trust with the cards they can\'t replace.',
  },
  reviewVoice: {
    phrases: [
      'flimsy — I don\'t trust it with my chase cards',
      'bent my cards the first week',
      'finally one I actually trust',
      'I\'ve been burned by cheap binders before, this one feels different',
    ],
    feltExperience:
      'The stomach-drop of opening a binder to find a chase card creased — and the guarded hope that this one might finally be safe.',
  },
  verifiedFacts: [
    '216 side-loading pockets',
    'Acid-free, PVC-free pages',
    'Padded hardcover with elastic strap',
    'Fits standard + graded-sleeve cards',
    'Lifetime warranty (owner-confirmed)',
  ],
  prohibitedClaims: [
    '"#1 best-selling binder" (no substantiation)',
    'A specific star rating or review count printed on the image',
    'Any competitor-name comparison stated as fact',
    'A protection percentage / lab stat that was never tested',
    'Waterproof / crush-proof (not a confirmed fact)',
  ],
};

export const OPTED_IN_CORPORA: readonly OptedInBrandCorpus[] = [INFINITY_VAULT];

export function getCorpus(id: string): OptedInBrandCorpus | undefined {
  return OPTED_IN_CORPORA.find((c) => c.id === id);
}
