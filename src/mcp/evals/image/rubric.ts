/**
 * Image output-quality RUBRIC — "how likely is this image deliverable to help the seller
 * solve their core problem?"
 *
 * The behavioural suite scores the COACH (did it call the right tools, say the right things).
 * This rubric scores the DELIVERABLE the pipeline actually produced — the image a shopper
 * would see — against the seller's real, corpus-grounded problem. Each dimension is a
 * question a VISION judge answers about the produced image (with the case's corpus as
 * ground truth); some are HARD gates (a fail caps the whole score, because a policy
 * violation or a fabricated claim makes an otherwise-beautiful image worthless or harmful).
 *
 * Pure + deterministic: the rubric definition and the aggregation live here (unit-tested);
 * the actual per-dimension verdicts come from an injected VisionJudge (visionJudge.ts).
 */

/** Which deliverable a case puts under test (drives the applicable dimensions). */
export type DeliverableKind = 'main_image' | 'gallery_lifestyle' | 'gallery_infographic' | 'aplus_hero' | 'video_keyframe';

export interface RubricDimension {
  id: string;
  label: string;
  /** The question the vision judge answers about the produced image. */
  question: string;
  /** Weight in the composite (higher = more central to solving the problem). */
  weight: number;
  /**
   * HARD gate: a fail (score < passThreshold) caps the composite at `hardFailCap` — a
   * policy violation or fabricated claim can't be outweighed by good aesthetics.
   */
  hard: boolean;
  /** Which deliverable kinds this dimension applies to ('all' = every kind). */
  appliesTo: DeliverableKind[] | 'all';
}

/** Per-dimension pass line and the cap a hard-gate fail imposes on the composite. */
export const PASS_THRESHOLD = 0.6;
export const HARD_FAIL_CAP = 0.35;
/** A deliverable "helps solve the problem" when its capped composite clears this. */
export const DELIVERABLE_PASS = 0.7;

/**
 * The rubric. Ordered problem-first: the two dimensions that most decide whether the image
 * moves conversion (does it fit the core problem, does it lead with the resolved trigger)
 * carry the most weight; the hard gates protect against policy/fabrication/fidelity failures.
 */
export const IMAGE_RUBRIC: readonly RubricDimension[] = [
  {
    id: 'problem-fit',
    label: 'Fits the core problem',
    question:
      "Does this image plausibly move the seller's stated core problem — earning the click/purchase against the named rivals — rather than just looking nice? Score 1 if a target buyer would be more likely to choose this listing because of it; 0 if it is decorative or off-target.",
    weight: 5,
    hard: false,
    appliesTo: 'all',
  },
  {
    id: 'decision-trigger-lead',
    label: 'Leads with the Decision Trigger',
    question:
      "Does the image lead with the resolved Decision Trigger's angle (e.g. Recognition = mirror the customer's felt reality/relief before any spec)? Score 1 if the trigger is legible at a glance; 0 if it leads with something else.",
    weight: 4,
    hard: false,
    appliesTo: 'all',
  },
  {
    id: 'trust-gap-closure',
    label: 'Closes the weakest pillar',
    question:
      'Does the image visibly work to close the seller\'s weakest Trust Gap pillar (e.g. Empathetic — make the collector feel understood/safe)? Score 1 if it directly addresses that pillar; 0 if it reinforces an already-strong pillar and ignores the gap.',
    weight: 4,
    hard: false,
    appliesTo: 'all',
  },
  {
    id: 'empathetic-lead',
    label: 'Empathetic line leads the lifestyle',
    question:
      "For the lifestyle / hero-story deliverable: does the felt experience (the customer's world / the moment of relief) LEAD, before any spec or badge? Score 1 if empathy leads; 0 if it opens on a feature.",
    weight: 3,
    hard: false,
    appliesTo: ['gallery_lifestyle', 'aplus_hero', 'video_keyframe'],
  },
  {
    id: 'distinctive-click',
    label: 'Earns the click vs the field',
    question:
      'Placed in the search grid beside the named rivals, is this image distinctive enough to earn the click — an ownable angle, not a generic category shot? Score 1 if it stands out defensibly; 0 if it blends in.',
    weight: 3,
    hard: false,
    appliesTo: ['main_image', 'gallery_lifestyle'],
  },
  {
    id: 'amazon-policy',
    label: 'Amazon policy-clean',
    question:
      'HARD: For the MAIN image — pure white background, product only, NO added text/logos/badges/borders/props, ≥85% frame. For a GALLERY/A+ image — no prohibited overlays (price, star ratings, review counts, competitor names). Score 1 if fully compliant; 0 on any violation.',
    weight: 4,
    hard: true,
    appliesTo: 'all',
  },
  {
    id: 'product-fidelity',
    label: 'True to the real product',
    question:
      "HARD: Is the product rendered true to the real product's geometry, colour, proportions and included components (no morphed shape, invented parts, or wrong pocket/format)? Score 1 if faithful; 0 if the product identity drifted.",
    weight: 4,
    hard: true,
    appliesTo: 'all',
  },
  {
    id: 'evidence-honest',
    label: 'No fabricated claims',
    question:
      'HARD: Does the image state ONLY facts the seller confirmed (the verified-facts list) and NONE of the prohibited/fabricated claims (invented stats, fake awards, unconfirmed protection claims, star ratings)? Score 1 if every stated claim is verified; 0 if any fabricated claim appears.',
    weight: 5,
    hard: true,
    appliesTo: 'all',
  },
];

export function rubricDimension(id: string): RubricDimension | undefined {
  return IMAGE_RUBRIC.find((d) => d.id === id);
}

/** The dimensions that apply to a given deliverable kind. */
export function dimensionsFor(kind: DeliverableKind): RubricDimension[] {
  return IMAGE_RUBRIC.filter((d) => d.appliesTo === 'all' || d.appliesTo.includes(kind));
}

/** One dimension's verdict from the vision judge (shape mirrors the behavioural JudgeVerdict). */
export interface ImageVerdict {
  dimension: string;
  score: number; // 0..1
  pass: boolean;
  rationale: string;
}

export interface ImageScore {
  /** Weighted composite over the applicable dimensions, AFTER hard-gate capping (0..1). */
  composite: number;
  /** Raw weighted composite before any hard-gate cap (0..1) — for diagnosis. */
  rawComposite: number;
  /** True when composite ≥ DELIVERABLE_PASS and no hard gate failed. */
  helpsSolveProblem: boolean;
  /** Hard-gate dimensions that failed (each caps the score). */
  hardFailures: string[];
  verdicts: ImageVerdict[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Aggregate per-dimension verdicts into an image score for a deliverable kind.
 *
 * - Only dimensions applicable to `kind` count.
 * - A HARD dimension scoring below PASS_THRESHOLD is a hard failure: it is recorded, and
 *   the final composite is capped at HARD_FAIL_CAP (a policy/fabrication/fidelity break
 *   can't be aesthetic'd away).
 * - `helpsSolveProblem` requires clearing DELIVERABLE_PASS with zero hard failures.
 */
export function scoreImage(kind: DeliverableKind, verdicts: ImageVerdict[]): ImageScore {
  const applicable = dimensionsFor(kind);
  const byId = new Map(verdicts.map((v) => [v.dimension, v]));

  let weightSum = 0;
  let weighted = 0;
  const hardFailures: string[] = [];
  const used: ImageVerdict[] = [];

  for (const dim of applicable) {
    const v = byId.get(dim.id) ?? {
      dimension: dim.id,
      score: 0,
      pass: false,
      rationale: 'No verdict returned for this dimension (conservative fail).',
    };
    used.push(v);
    weightSum += dim.weight;
    weighted += dim.weight * clamp01(v.score);
    if (dim.hard && clamp01(v.score) < PASS_THRESHOLD) hardFailures.push(dim.id);
  }

  const rawComposite = weightSum ? weighted / weightSum : 0;
  const composite = hardFailures.length ? Math.min(rawComposite, HARD_FAIL_CAP) : rawComposite;
  return {
    composite,
    rawComposite,
    helpsSolveProblem: hardFailures.length === 0 && composite >= DELIVERABLE_PASS,
    hardFailures,
    verdicts: used,
  };
}
