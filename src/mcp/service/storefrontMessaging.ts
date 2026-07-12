/**
 * Layer 1 — `generate_storefront_messaging_plan` director.
 *
 * Produces the STOREFRONT messaging brand-asset plan: the Amazon Store (and any owned
 * storefront surface) as one continuous expression of the positioning — hero banner,
 * brand story block, tagline system, category tiles — each section grounded in the
 * same spine as the listing set, A+ page, and video, so a shopper who clicks through
 * from any of them lands in the SAME story.
 *
 * Grounding-director: returns the section architecture + per-section direction + the
 * Higgsfield execution route for the visual sections; the connector coach composes
 * the final copy + IMAGE_PROMPTs. It NEVER produces images and NEVER fabricates a claim.
 */
import {
  EVIDENCE_DISCIPLINE,
  EXACT_NEGATIVE_PROMPT,
  IMAGE_PROMPT_CONSTRUCTION,
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

export interface StorefrontSection {
  key: string;
  label: string;
  purpose: string;
  ideaPillar: 'Insight-Driven' | 'Distinctive' | 'Empathetic' | 'Authentic';
  /** Composition + copy direction (what it must communicate, not how). */
  direction: string;
  /** Whether this section needs a generated visual (routes to Higgsfield) or is copy/layout. */
  execution: 'visual' | 'copy';
  /** Format/spec guardrails for this section. */
  rules: string;
}

/** The storefront section architecture, top of page to bottom. */
export const STOREFRONT_SECTIONS: readonly StorefrontSection[] = [
  {
    key: 'store_hero',
    label: 'Store hero banner',
    purpose: 'The brand-level first impression — the one line + one image that says who this brand is for.',
    ideaPillar: 'Distinctive',
    direction:
      'Photoreal brand-world image (product in its world, or the customer\'s transformed moment) with ONE overlay line — the signature or the empathetic lead, whichever the Decision Trigger favours. Not a product grid, not a collage.',
    execution: 'visual',
    rules:
      'Amazon Store hero: 3000×600 (renders much shorter on mobile — keep the line and any product safe-zone centred). Photoreal → Higgsfield generate_image; use outpaint_image to extend a strong composition to the wide aspect rather than regenerating.',
  },
  {
    key: 'brand_story_block',
    label: 'Brand story block',
    purpose: "Why this brand exists — the story that turns a product buyer into a brand customer.",
    ideaPillar: 'Authentic',
    direction:
      "The empathetic line LEADS ('I see you'), then the founder/mission why, then the signature as the landing line. Real specifics over polish — the same authenticity bar as the A+ emotional close.",
    execution: 'copy',
    rules: 'Short paragraphs a shopper actually reads on a phone. Any trust claim (guarantee/credential) is claim-gated.',
  },
  {
    key: 'tagline_system',
    label: 'Tagline system',
    purpose: 'The signature, productized: the line + its short/long variants used consistently across every surface.',
    ideaPillar: 'Distinctive',
    direction:
      'Derive from the Signature: one master line, one shortened banner form, one extended form for the story block. Same words everywhere — repetition is what makes it ownable.',
    execution: 'copy',
    rules: 'No new claims sneak in through a tagline — the claim gate applies to every variant.',
  },
  {
    key: 'category_tiles',
    label: 'Category tiles',
    purpose: 'Route shoppers by the JOB they came to do, not by internal catalog taxonomy.',
    ideaPillar: 'Insight-Driven',
    direction:
      "One tile per avatar job/use-case, each with a one-line promise in the avatar's vocabulary (from the job map / review language), over a clean product-true visual.",
    execution: 'visual',
    rules: 'Tile copy ≤ ~6 words; the promise must be honest for every product behind the tile.',
  },
  {
    key: 'featured_products_row',
    label: 'Featured products row',
    purpose: 'The bridge back to the listings — the grid where storefront coherence pays off.',
    ideaPillar: 'Distinctive',
    direction:
      'Feature the pieces whose main image + title pair already express the positioning (the winning search-grid unit) so the storefront and the listings visibly rhyme.',
    execution: 'copy',
    rules: 'No restyled one-off product shots here — reuse the listing main images so the shopper sees the same product identity everywhere.',
  },
];

export interface StorefrontMessagingInput {
  product: string;
  decisionTrigger?: string;
  avatarSummary?: string;
  signature?: string;
  trustGapSummary?: string;
  verifiedFacts?: string;
  marketplace?: string;
  brandAssetId?: string;
}

export interface StorefrontMessagingResult {
  ok: true;
  marketplace: string;
  decision_trigger: string | null;
  sections: Array<StorefrontSection & { section: number }>;
  /** The cross-surface consistency contract — the point of the storefront plan. */
  consistency_rules: readonly string[];
  positioning_inputs: PositioningInputReport[];
  higgsfield_handoff: typeof HIGGSFIELD_HANDOFF;
  prompt_construction: { steps: readonly string[]; exact_negative_prompt: string };
  adjustment_protocol: string[];
  claim_gate: string;
  evidence_discipline: readonly string[];
  never_contain: readonly string[];
  new_user_path: readonly string[];
  instructions: string[];
  summary: string;
}

export const STOREFRONT_CONSISTENCY_RULES: readonly string[] = [
  'One spine everywhere: the storefront expresses the SAME Decision Trigger, avatar core, and signature as the listing set, A+ page, and video — a shopper moving between them should never feel a brand change.',
  'The tagline system is the connective tissue: the same signature-derived words on the hero, the story block, and (where fitting) the listing gallery and A+ close.',
  'Visual identity carries over: the storefront hero and tiles share the palette/lighting register of the listing set — reuse listing main images in the product row verbatim.',
  'When positioning changes, the storefront updates WITH the other surfaces (refine_creative_plan maps the propagation) — a stale storefront quietly contradicts a fresh listing.',
];

/** Build the storefront messaging plan. */
export function buildStorefrontMessagingPlan(input: StorefrontMessagingInput): StorefrontMessagingResult {
  const marketplace = (input.marketplace ?? 'amazon').toLowerCase();
  const trigger = normalizeTrigger(input.decisionTrigger);

  const positioning: PositioningInputs = {
    decisionTrigger: input.decisionTrigger,
    avatarSummary: input.avatarSummary,
    signature: input.signature,
    trustGapSummary: input.trustGapSummary,
    verifiedFacts: input.verifiedFacts,
  };

  return {
    ok: true,
    marketplace,
    decision_trigger: trigger,
    sections: STOREFRONT_SECTIONS.map((s, i) => ({ ...s, section: i + 1 })),
    consistency_rules: STOREFRONT_CONSISTENCY_RULES,
    positioning_inputs: reportPositioningInputs(positioning),
    higgsfield_handoff: HIGGSFIELD_HANDOFF,
    prompt_construction: { steps: IMAGE_PROMPT_CONSTRUCTION, exact_negative_prompt: EXACT_NEGATIVE_PROMPT },
    adjustment_protocol: [
      'Each section is an independent component: change one section\'s copy or visual without touching the rest — but re-check consistency_rules after any change (the storefront exists to rhyme with the other surfaces).',
      'Visual-section mechanical changes route to Higgsfield edit tools: outpaint_image to reach the 3000×600 hero aspect, upscale_image for resolution, remove_background for tile cutouts — regenerate only when the creative direction changed.',
      'A tagline change is a SIGNATURE change — route it through refine_creative_plan so every surface using the line updates together.',
      'After any adjustment, save the updated plan with log_asset (same external_id reconciles the version).',
    ],
    claim_gate:
      'Before any guarantee or specific claim appears in storefront copy, flag it to the user and ask them to confirm they offer/can substantiate it. Only include it once confirmed.',
    evidence_discipline: EVIDENCE_DISCIPLINE,
    never_contain: TIER_C_NEVER_CONTAIN,
    new_user_path: NEW_USER_EASY_PATH,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline. Only verified facts may be stated in storefront copy.`,
      `2) Ground every section in the positioning spine (see positioning_inputs): the Decision Trigger${trigger ? ` (${trigger})` : ''} picks the hero's lead line, the avatar job map names the category tiles, the signature drives the tagline system. Missing elements degrade honestly — plan anyway and name the sharpening input.`,
      '3) For EACH section, compose: (A) the exact copy (claim-gated), (B) for visual sections, the IMAGE_PROMPT per prompt_construction routed per higgsfield_handoff (real product photo as strict reference; outpaint to the hero aspect).',
      '4) Check the whole plan against consistency_rules — the storefront must rhyme with the listing set, A+ page, and video, sharing the tagline system and visual register.',
      '5) Save the plan with log_asset (content_type "amazon") and wire the measurement: design_test (hypothesis = the aligned storefront lifts brand-level CVR / repeat purchase), update_test_milestone as it goes live.',
      '6) Adjust section-by-section via adjustment_protocol, or refine_creative_plan for positioning changes.',
    ],
    summary: `Storefront messaging plan (${marketplace}): ${STOREFRONT_SECTIONS.length} sections (${STOREFRONT_SECTIONS.map((s) => s.key).join(' → ')}) expressing ONE positioning spine — hero banner (3000×600, Higgsfield-ready), empathetic-led brand story, signature-derived tagline system, job-mapped category tiles, and a product row that reuses the winning listing pairs.${trigger ? ` Register tuned to the ${trigger} trigger.` : ''} Claim-gated, consistency-checked against every other surface, saved + measured.`,
  };
}
