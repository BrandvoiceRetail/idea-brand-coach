/**
 * Layer 1 — `generate_aplus_content_plan` director.
 *
 * Produces the full A+ (brand-story) CONTENT PLAN: the continuous long-form editorial
 * composition, beat-by-beat, grounded in the positioning spine. Promotes the compact
 * `aplus_content` fragment the listing-image brief carries into a dedicated,
 * component-addressable plan (each beat is independently adjustable), with the
 * Higgsfield `generate_image` execution route for the editorial composition.
 *
 * Grounding-director: returns the beat architecture + per-beat direction + prompt
 * construction; the connector coach composes the final concepts + ready-to-paste
 * IMAGE_PROMPTs. It NEVER produces images and NEVER fabricates a claim.
 */
import {
  APLUS_DESKTOP,
  EVIDENCE_DISCIPLINE,
  EXACT_NEGATIVE_PROMPT,
  IMAGE_PROMPT_CONSTRUCTION,
  QA_CHECKLIST,
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

export interface AplusBeat {
  key: string;
  label: string;
  /** What this beat's job is in the long-form composition. */
  purpose: string;
  ideaPillar: 'Insight-Driven' | 'Distinctive' | 'Empathetic' | 'Authentic';
  /** Composition + copy direction (what it must communicate, not how). */
  direction: string;
  /** On-image copy rule for this beat. */
  copyRule: string;
}

/**
 * The 5 narrative beats of the continuous editorial composition (APLUS_DESKTOP.structure,
 * made component-addressable so each beat can be adjusted without redoing the page).
 */
export const APLUS_BEATS: readonly AplusBeat[] = [
  {
    key: 'product_intro',
    label: 'Product intro',
    purpose: 'Open the page — the product arrives as the visual hero of an editorial world.',
    ideaPillar: 'Distinctive',
    direction:
      'The product in the concept\'s world, unmistakably itself. The distinctive territory (architecture, light, editorial motif) is established here and threads the whole page.',
    copyRule: 'Product name + one distinctive line. Nothing else.',
  },
  {
    key: 'strongest_benefit',
    label: 'Strongest benefit',
    purpose: 'The one outcome the customer most wants, made the emotional centre of the page.',
    ideaPillar: 'Empathetic',
    direction:
      'Benefit-first and avatar-led: show the outcome as the customer feels it, not as a spec. The empathetic line leads; the Decision Trigger sets the register.',
    copyRule: 'The empathetic/benefit line, short and readable. Claims verbatim only.',
  },
  {
    key: 'product_clarity',
    label: 'Product clarity / detail',
    purpose: 'Answer "what exactly am I getting" — materials, components, dimensions.',
    ideaPillar: 'Insight-Driven',
    direction:
      'The rational layer: close-up detail, real construction, exact contents. Every number verbatim from verified facts; include exact dimensions/quantity ONLY when verified.',
    copyRule: 'Exact facts only — the claim-accuracy beat. Never round, never invent.',
  },
  {
    key: 'use_case',
    label: 'Use case',
    purpose: "The product working in the customer's real life — the job being done.",
    ideaPillar: 'Empathetic',
    direction:
      "The avatar's actual context and moment of use. Doubts this page must resolve get answered visually here (fit, size-in-hand, setting).",
    copyRule: 'One line naming the use/moment. Styling props marked as not included when shown.',
  },
  {
    key: 'emotional_close',
    label: 'Emotional close',
    purpose: 'Land the story — the brand feeling the customer keeps after scrolling.',
    ideaPillar: 'Authentic',
    direction:
      'The mission/feeling beat: close the page on why this brand, with the positioning statement line. Real specifics over generic sincerity.',
    copyRule: 'The positioning statement/brand line. Any trust claim (guarantee/credential) is claim-gated.',
  },
];

export interface AplusPlanInput {
  product: string;
  decisionTrigger?: string;
  avatarSummary?: string;
  positioning_statement?: string;
  trustGapSummary?: string;
  verifiedFacts?: string;
  marketplace?: string;
  brandAssetId?: string;
}

export interface AplusPlanResult {
  ok: true;
  marketplace: string;
  decision_trigger: string | null;
  /** The continuous long-form editorial format (shared with the listing-image brief). */
  format: typeof APLUS_DESKTOP;
  beats: Array<AplusBeat & { beat: number }>;
  /** Mobile is where most shoppers read A+ — legibility rules for the same composition. */
  mobile_rules: readonly string[];
  brand_registry_note: string;
  positioning_inputs: PositioningInputReport[];
  higgsfield_handoff: typeof HIGGSFIELD_HANDOFF;
  prompt_construction: { steps: readonly string[]; exact_negative_prompt: string };
  /** Beat-level adjustment protocol. */
  adjustment_protocol: string[];
  claim_gate: string;
  evidence_discipline: readonly string[];
  qa_checklist: readonly string[];
  never_contain: readonly string[];
  new_user_path: readonly string[];
  instructions: string[];
  summary: string;
}

export const APLUS_MOBILE_RULES: readonly string[] = [
  'Most A+ impressions are MOBILE: every copy line must stay legible at phone width — short lines, high contrast, never over critical product detail.',
  'The strongest-benefit beat must land in the first phone-screen of scroll; do not bury the emotional centre below the fold.',
  'Write keyword-bearing alt text for each uploaded module image (accessibility + indexing) — it is part of the plan, not an afterthought.',
];

/** Build the A+ content plan, tailored to any provided positioning context. */
export function buildAplusPlan(input: AplusPlanInput): AplusPlanResult {
  const marketplace = (input.marketplace ?? 'amazon').toLowerCase();
  const trigger = normalizeTrigger(input.decisionTrigger);

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
    format: APLUS_DESKTOP,
    beats: APLUS_BEATS.map((b, i) => ({ ...b, beat: i + 1 })),
    mobile_rules: APLUS_MOBILE_RULES,
    brand_registry_note:
      'A+ Content requires Brand Registry. If the seller is not brand-registered, park this plan and put the same story into the listing gallery (generate_listing_image_brief) until registry lands.',
    positioning_inputs: reportPositioningInputs(positioning),
    higgsfield_handoff: HIGGSFIELD_HANDOFF,
    prompt_construction: { steps: IMAGE_PROMPT_CONSTRUCTION, exact_negative_prompt: EXACT_NEGATIVE_PROMPT },
    adjustment_protocol: [
      'Each beat is an independent component: to change one, recompose ONLY that beat\'s segment of the composition (keep the concept\'s connecting devices — light, shadow, architectural lines — verbatim) and regenerate the composition once with the updated prompt.',
      'A copy-only change (a line, a fact) re-runs the claim gate on the changed line, then updates the prompt\'s exact-copy section — nothing else moves.',
      'Resolution/extension changes route to Higgsfield edit tools (upscale_image, outpaint_image), not regeneration.',
      'After any adjustment, save the updated plan with log_asset (same external_id reconciles the version).',
      'For positioning changes (new trigger/avatar/positioning statement/trust finding), call refine_creative_plan — it maps which beats recompose and which stand.',
    ],
    claim_gate:
      'Before including any guarantee or specific claim on the page, flag it to the user and ask them to confirm they offer/can substantiate it. Only include it once confirmed.',
    evidence_discipline: EVIDENCE_DISCIPLINE,
    qa_checklist: QA_CHECKLIST,
    never_contain: TIER_C_NEVER_CONTAIN,
    new_user_path: NEW_USER_EASY_PATH,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline. Only verified facts may appear as on-image copy.`,
      `2) Ground the page in the positioning spine (see positioning_inputs): the Decision Trigger${trigger ? ` (${trigger})` : ''} sets the register, the avatar core leads the strongest-benefit and use-case beats, the positioning statement closes, and the Trust Gap pillar decides which beat carries the page. Missing elements degrade honestly — generate anyway and name the sharpening input.`,
      '3) Produce 4 distinct CONCEPTS per the format (materially different territory/composition/motif), 2 versions each — each concept runs the 5 beats top-to-bottom as ONE continuous composition (target 1472x3008), never stacked template modules.',
      '4) For each concept, write the ready-to-generate prompt with prompt_construction (the "IMAGE_PROMPT:" marker + the 8-part order + the exact negative prompt) and route per higgsfield_handoff: real product photo as strict reference → Higgsfield generate_image; extend/upscale with outpaint_image/upscale_image as needed; QA against qa_checklist and mobile_rules.',
      '5) Run the claim gate on every stated claim; verify actual output dimensions honestly.',
      '6) Save the plan with log_asset (content_type "amazon") and wire the split-test: design_test (hypothesis = this A+ page lifts CVR for the piece), then update_test_milestone as it goes live.',
      '7) Adjust beat-by-beat via adjustment_protocol, or refine_creative_plan for positioning changes.',
    ],
    summary: `A+ content plan (${marketplace}): 4 long-form editorial concepts × 5 beats (${APLUS_BEATS.map((b) => b.key).join(' → ')}) as ONE continuous composition at 1472x3008 — never stacked template modules.${trigger ? ` Register tuned to the ${trigger} trigger.` : ''} Compose per-beat direction + IMAGE_PROMPTs grounded in the positioning spine, hand to Higgsfield generate_image with the real product photo as strict reference, QA (desktop + mobile), save + split-test — and adjust beat-by-beat.`,
  };
}
