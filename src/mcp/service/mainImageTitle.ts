/**
 * Layer 1 — `generate_main_image_title_plan` director.
 *
 * The SEARCH-GRID unit: the main image + the title are the only two things a shopper
 * sees before the click, and they win or lose together. This director plans them as
 * ONE coherent positioning statement — the image and the title each carrying the part
 * of the story the other physically cannot — grounded in the positioning spine.
 *
 * Grounding-director: returns the title formula + rules, the main-image brief (the
 * same slot-1 policy the listing-image brief enforces), the coherence rules, and the
 * split-test plan; the connector coach composes the final title variants + the
 * IMAGE_PROMPT. It NEVER produces images and NEVER fabricates a claim.
 */
import {
  EVIDENCE_DISCIPLINE,
  EXACT_NEGATIVE_PROMPT,
  IMAGE_PROMPT_CONSTRUCTION,
  LISTING_IMAGE_SLOTS,
  TRIGGER_IMAGE_DIRECTION,
  type ImageSlot,
} from './listingImageBrief.js';
import {
  HIGGSFIELD_HANDOFF,
  NEW_USER_EASY_PATH,
  TIER_C_NEVER_CONTAIN,
  normalizeTrigger,
  reportPositioningInputs,
  type PositioningInputReport,
  type PositioningInputs,
} from './creativeAlignment.js';

export interface TitleSegment {
  key: string;
  label: string;
  /** What this segment carries and where it comes from. */
  direction: string;
}

/** The title formula, in order. The first ~80 characters are the mobile-visible unit. */
export const TITLE_FORMULA: readonly TitleSegment[] = [
  {
    key: 'brand',
    label: 'Brand name',
    direction: 'Leads (Amazon style guide). Short; the brand is a trust cue, not a keyword dump.',
  },
  {
    key: 'primary_keyword',
    label: 'Primary keyword phrase',
    direction:
      "The term the AVATAR actually types — pull it from review vocabulary/search evidence, not from what the seller calls the product internally.",
  },
  {
    key: 'distinctive_difference',
    label: 'Distinctive difference',
    direction:
      'The positioning statement-derived angle that separates this from the grid — the one phrase a competitor could not honestly copy. Derived from the Positioning Statement; a hypothesis to test, phrased as a defensible fact.',
  },
  {
    key: 'exact_facts',
    label: 'Exact facts (size / count / variant)',
    direction:
      'Verbatim verified facts only — dimensions, quantity, variant. This is where distorted claims kill trust at the moment of comparison; never round, never invent.',
  },
  {
    key: 'use_outcome',
    label: 'Avatar-relevant use / outcome',
    direction:
      "The use-case or outcome the avatar is buying (from the job map) — fills remaining space AFTER the mobile-visible unit is complete.",
  },
];

export const TITLE_RULES: readonly string[] = [
  'The FIRST ~80 characters are the real title — that is all mobile search shows. Brand + keyword + the distinctive difference must land inside them.',
  'Respect the category character limit (typically 200; some categories less) — an over-limit title risks search suppression.',
  'Amazon style guide (hard): no promo phrases ("sale", "free shipping", "best"), no ALL-CAPS words, no decorative symbols/emoji, no price, no seller name unless it IS the brand.',
  'Every stated fact verbatim from verified facts (claim gate). Keyword-stuffing reads as spam to both the algorithm and the human — one primary phrase, placed naturally.',
  'Title-case per Amazon convention (capitalize main words; not articles/conjunctions/prepositions under 5 letters).',
];

/** The pair is one unit: what the title says and the image shows must be the SAME story. */
export const COHERENCE_RULES: readonly string[] = [
  'ONE positioning statement, two carriers: the image and the title each carry the part the other cannot — the image shows what words can\'t (finish, form, quality), the title says what the photo can\'t (the exact fact, the difference, the use).',
  'Both express the SAME distinctive angle. A premium-styled image over a commodity-keyword title (or vice versa) reads as a mismatch and loses the click.',
  'The Decision Trigger sets the shared register: the image\'s styling/angle/finish and the title\'s difference-phrase must land the same lever.',
  'Never duplicate: if the image makes something visually obvious (colour, 2-pack), the title spends those characters on what the image cannot show.',
  'Judge the pair IN CONTEXT: screenshot the actual search grid for the primary keyword and check the pair against the real competitive field, not in isolation.',
];

export interface MainImageTitleInput {
  product: string;
  decisionTrigger?: string;
  avatarSummary?: string;
  positioning_statement?: string;
  trustGapSummary?: string;
  verifiedFacts?: string;
  marketplace?: string;
  brandAssetId?: string;
}

export interface MainImageTitleResult {
  ok: true;
  marketplace: string;
  decision_trigger: string | null;
  trigger_image_direction: string | null;
  /** The main-image slot brief — identical policy to the listing-image set's slot 1. */
  main_image: ImageSlot;
  title_formula: readonly TitleSegment[];
  title_rules: readonly string[];
  coherence_rules: readonly string[];
  positioning_inputs: PositioningInputReport[];
  higgsfield_handoff: typeof HIGGSFIELD_HANDOFF;
  prompt_construction: { steps: readonly string[]; exact_negative_prompt: string };
  /** The pair is the highest-traffic split test a listing has. */
  test_plan: string[];
  claim_gate: string;
  evidence_discipline: readonly string[];
  never_contain: readonly string[];
  new_user_path: readonly string[];
  instructions: string[];
  summary: string;
}

/** Build the main image + title coherence plan. */
export function buildMainImageTitlePlan(input: MainImageTitleInput): MainImageTitleResult {
  const marketplace = (input.marketplace ?? 'amazon').toLowerCase();
  const trigger = normalizeTrigger(input.decisionTrigger);
  const mainImage = LISTING_IMAGE_SLOTS.find((s) => s.key === 'main') as ImageSlot;

  const positioning: PositioningInputs = {
    decisionTrigger: input.decisionTrigger,
    avatarSummary: input.avatarSummary,
    positioning_statement: input.positioning_statement,
    trustGapSummary: input.trustGapSummary,
    verifiedFacts: input.verifiedFacts,
  };

  return {
    ok: true,
    marketplace,
    decision_trigger: trigger,
    trigger_image_direction: trigger ? TRIGGER_IMAGE_DIRECTION[trigger] ?? null : null,
    main_image: mainImage,
    title_formula: TITLE_FORMULA,
    title_rules: TITLE_RULES,
    coherence_rules: COHERENCE_RULES,
    positioning_inputs: reportPositioningInputs(positioning),
    higgsfield_handoff: HIGGSFIELD_HANDOFF,
    prompt_construction: { steps: IMAGE_PROMPT_CONSTRUCTION, exact_negative_prompt: EXACT_NEGATIVE_PROMPT },
    test_plan: [
      'The main image is the highest-traffic asset the brand owns — test it first: design_test with hypothesis "this main image lifts CTR from the search grid", then update_test_milestone as variants go live.',
      'Produce 2-3 title variants (same facts, different distinctive-difference phrasing) and 2-3 main-image angle/styling variants; change ONE variable per test.',
      'Read the result with get_experiment_lift; the winning pair becomes the anchor the gallery, A+, video and storefront align to.',
    ],
    claim_gate:
      'Before any specific claim enters the title (a percentage, a certification, a guarantee), flag it to the user and ask them to confirm they can substantiate it. Only include it once confirmed.',
    evidence_discipline: EVIDENCE_DISCIPLINE,
    never_contain: TIER_C_NEVER_CONTAIN,
    new_user_path: NEW_USER_EASY_PATH,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline; collect the verified facts the title will state (size/count/variant, verbatim).`,
      `2) Ground the pair in the positioning spine (see positioning_inputs): the Decision Trigger${trigger ? ` (${trigger})` : ''} sets the shared register, the avatar's search vocabulary gives the primary keyword, the positioning statement gives the distinctive difference. Missing elements degrade honestly — plan anyway and name the sharpening input.`,
      '3) Compose 2-3 TITLE variants with title_formula + title_rules: brand + keyword + difference inside the first ~80 characters, exact facts verbatim, category limit respected.',
      '4) Compose the MAIN IMAGE brief per main_image (pure white background, product only, NO added text/badges — Amazon policy) with the trigger showing through styling/angle/finish only; write the IMAGE_PROMPT per prompt_construction and route photoreal per higgsfield_handoff (real product photo as strict reference).',
      '5) Check the pair against coherence_rules — one story, two carriers — ideally against a screenshot of the live search grid for the primary keyword.',
      '6) Run the claim gate on the title; save the plan with log_asset (content_type "amazon") and wire the split-test per test_plan.',
      '7) Adjust either carrier independently later (a title edit never requires re-shooting the image), or refine_creative_plan for positioning changes.',
    ],
    summary: `Main image + title plan (${marketplace}): the search-grid pair composed as ONE positioning statement — white-bg policy-clean main image (trigger through styling only) + a title whose first ~80 characters carry brand, the avatar's real keyword, and the positioning statement-derived difference, all facts verbatim.${trigger ? ` Register tuned to the ${trigger} trigger.` : ''} 2-3 variants each, claim-gated, split-tested as the highest-traffic test the listing has.`,
  };
}
