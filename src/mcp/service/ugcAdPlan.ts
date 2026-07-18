/**
 * Layer 1 — `generate_ugc_ad_plan` director.
 *
 * Produces a script-level UGC AD PLAN: the casual, selfie-register ad format (try-on,
 * review, unboxing, problem-solution) planned as a first-class creative asset — persona
 * spec derived from the brand's customer avatar, hook variants from the Decision
 * Trigger, claim-gated talking points in the avatar's own vocabulary, and the
 * Higgsfield marketing-studio execution route.
 *
 * UGC is a VOLUME format: the plan ships multiple hook variants over one body, tests
 * them as paid-social variants, and scales the winner — so the testing loop is part
 * of the plan, not an afterthought.
 *
 * Grounding-director: returns the script architecture + persona spec + compliance
 * rails; the connector coach composes the final scripts and preset inputs. It NEVER
 * produces video and NEVER fabricates a claim — and it never dresses the AI presenter
 * up as a real customer.
 */
import { EVIDENCE_DISCIPLINE } from './listingImageBrief.js';
import {
  HIGGSFIELD_HANDOFF,
  NEW_USER_EASY_PATH,
  TIER_C_NEVER_CONTAIN,
  normalizeTrigger,
  reportPositioningInputs,
  type PositioningInputReport,
  type PositioningInputs,
} from './creativeAlignment.js';

/** How each Decision Trigger opens a SPOKEN UGC hook — the first line out of the presenter's mouth. */
export const UGC_TRIGGER_HOOK_ANGLE: Record<string, string> = {
  permission:
    'Open on the credential/authority cue in first person — "my dermatologist actually told me…" register (only with a verified basis).',
  recognition:
    'Open inside the felt problem — "if your mornings look like this…" — the viewer recognizes themselves before the product appears.',
  identity:
    'Open on the aspiration — "the girls who get it, get it" register — belonging to the world the avatar wants.',
  belonging:
    'Open on the shared-community moment — "everyone in my group chat has been asking about…".',
  momentum:
    'Open on visible social proof — "okay so apparently everyone owns this now and I finally get why…".',
  fear_of_loss:
    'Open on the cost of waiting — "I wish someone had told me this before I wasted money on…".',
};

export interface UgcScriptBeat {
  key: string;
  label: string;
  purpose: string;
  ideaPillar: 'Insight-Driven' | 'Distinctive' | 'Empathetic' | 'Authentic';
  /** Spoken-register direction (what the presenter communicates, not corporate copy). */
  direction: string;
}

/** The UGC script architecture — the arc that makes the format convert. */
export const UGC_SCRIPT_BEATS: readonly UgcScriptBeat[] = [
  {
    key: 'hook',
    label: 'Spoken hook (first 2 seconds)',
    purpose: 'Stop the scroll with a line the avatar would actually say.',
    ideaPillar: 'Distinctive',
    direction:
      'One spoken line, casual register, trigger-led (see UGC_TRIGGER_HOOK_ANGLE). This is the TEST VARIABLE — write 3 variants over the same body.',
  },
  {
    key: 'context',
    label: 'Why I got this',
    purpose: "First-person recognition — the presenter's version of the avatar's felt problem.",
    ideaPillar: 'Empathetic',
    direction:
      "The avatar's struggle in the presenter's own words — specific and lived-in ('my third binder this year fell apart'), never a marketing paraphrase.",
  },
  {
    key: 'trial',
    label: 'Real-time use / reaction',
    purpose: 'The product visibly doing its job — the moment UGC exists for.',
    ideaPillar: 'Authentic',
    direction:
      'Genuine handling, real-time reaction, imperfect camera work is FINE (polish kills the format). Product fidelity is not negotiable — exactly the real product from the reference kit.',
  },
  {
    key: 'talking_points',
    label: 'Benefit talking points',
    purpose: 'The 2-3 outcomes the avatar cares about, said like a friend would say them.',
    ideaPillar: 'Insight-Driven',
    direction:
      "Casual phrasing, avatar vocabulary (from reviews/job map), every factual statement claim-gated and verbatim — 'it holds 400 cards' only if 400 is verified.",
  },
  {
    key: 'objection_flip',
    label: 'The skeptic flip',
    purpose: 'Disarm the top objection with the "I thought X, but…" arc.',
    ideaPillar: 'Authentic',
    direction:
      "Pull the top objection from the avatar's objection map and flip it honestly — skepticism admitted, then resolved by the product experience, never dismissed.",
  },
  {
    key: 'cta',
    label: 'Close / CTA',
    purpose: 'The platform-appropriate next step.',
    ideaPillar: 'Distinctive',
    direction:
      'Casual close + explicit CTA on social ("linked below"); on-Amazon placements keep the listing-video policy instead (no price/promo/off-Amazon CTA).',
  },
];

export interface UgcFormatSpec {
  key: string;
  label: string;
  /** Which script beats this format runs, in order. */
  beatKeys: readonly string[];
  direction: string;
}

/** The UGC formats, each mapping to a Higgsfield marketing-studio preset family. */
export const UGC_FORMATS: readonly UgcFormatSpec[] = [
  {
    key: 'review',
    label: 'Review / talking-head',
    beatKeys: ['hook', 'context', 'trial', 'talking_points', 'objection_flip', 'cta'],
    direction: 'The full arc — the workhorse UGC ad. Route to the UGC review preset.',
  },
  {
    key: 'try_on',
    label: 'Try-on / haul',
    beatKeys: ['hook', 'trial', 'talking_points', 'cta'],
    direction: 'Trial-led and fast — the product on/in use within 3 seconds. Route to the try-on preset.',
  },
  {
    key: 'unboxing',
    label: 'Unboxing',
    beatKeys: ['hook', 'trial', 'talking_points', 'cta'],
    direction:
      'Anticipation-led: the packaging carries the first beat — attach the packaging reference from the kit so the model unboxes the REAL packaging. Route to the unboxing preset.',
  },
  {
    key: 'problem_solution',
    label: 'Problem → solution',
    beatKeys: ['hook', 'context', 'trial', 'objection_flip', 'cta'],
    direction: 'Empathy-led: the felt problem gets the screen time; the product arrives as relief.',
  },
];

/** The persona is CAST from the customer avatar — never a random preset face. */
export const UGC_PERSONA_SPEC: readonly string[] = [
  "Cast to the avatar: demographic, styling, and setting match the Avatar 2.0 portrait — the viewer should see THEMSELVES (or who they're becoming), not a generic influencer.",
  "Voice register comes from the avatar's vocabulary (reviews / job map): the words they'd use, the pace they'd talk at.",
  'Pick the closest Higgsfield preset persona, or build a custom one; for recurring campaigns make a character sheet covering every state shown so later ads stay consistent.',
  'The setting is the avatar\'s real context (their kitchen, their car, their desk) — not a studio.',
];

/** Honesty rails specific to AI UGC — the Authentic pillar applies to the format itself. */
export const UGC_COMPLIANCE: readonly string[] = [
  'The AI presenter is an ACTOR/PRESENTER, never framed as a real customer: no "verified buyer" claims, no fake review language, no invented usage history stated as fact.',
  'Follow the placement\'s disclosure rules for AI-generated/branded content (platform ad policies; FTC endorsement guides for US audiences).',
  'Every factual spoken statement passes the claim gate — casual register is not a license to round or invent.',
  'On-Amazon placements: UGC-style video must still follow listing-video policy (no price/promo/time-sensitive claims, no off-Amazon CTAs).',
];

/** UGC is a volume format — the testing loop is part of the plan. */
export const UGC_TESTING_PLAN: readonly string[] = [
  'Ship 3 hook variants over ONE body per format — the hook is the test variable; everything else stays constant.',
  'Wire the test: design_test (hypothesis = hook X lifts thumb-stop/CTR for this piece), update_test_milestone as variants go live.',
  'Read results with ingest_content_performance + get_campaign_metrics; scale the winning hook, kill the rest.',
  'Refresh on fatigue (CTR decay / frequency creep): refine_creative_plan swaps the hook or setting — the persona and body stay.',
];

export interface UgcAdPlanInput {
  product: string;
  /** One of the UGC format keys; defaults to review. */
  ugcFormat?: string;
  decisionTrigger?: string;
  avatarSummary?: string;
  positioning_statement?: string;
  trustGapSummary?: string;
  verifiedFacts?: string;
  /** Where the ad will run (meta / tiktok / amazon_listing / …). Optional. */
  platform?: string;
  brandAssetId?: string;
}

export interface UgcAdPlanResult {
  ok: true;
  format: UgcFormatSpec;
  platform: string;
  decision_trigger: string | null;
  trigger_hook_angle: string | null;
  /** The format's script beats, in order, numbered. */
  beats: Array<UgcScriptBeat & { beat: number }>;
  persona_spec: readonly string[];
  compliance: readonly string[];
  testing_plan: readonly string[];
  positioning_inputs: PositioningInputReport[];
  higgsfield_handoff: typeof HIGGSFIELD_HANDOFF;
  adjustment_protocol: string[];
  claim_gate: string;
  evidence_discipline: readonly string[];
  never_contain: readonly string[];
  new_user_path: readonly string[];
  instructions: string[];
  summary: string;
}

/** Build the UGC ad plan, tailored to any provided positioning context. */
export function buildUgcAdPlan(input: UgcAdPlanInput): UgcAdPlanResult {
  const format = UGC_FORMATS.find((f) => f.key === (input.ugcFormat ?? 'review')) ?? UGC_FORMATS[0];
  const trigger = normalizeTrigger(input.decisionTrigger);
  const platform = (input.platform ?? 'meta').toLowerCase();

  const beatByKey = new Map(UGC_SCRIPT_BEATS.map((b) => [b.key, b]));
  const beats = format.beatKeys.map((key, i) => ({ ...(beatByKey.get(key) as UgcScriptBeat), beat: i + 1 }));

  const positioning: PositioningInputs = {
    decisionTrigger: input.decisionTrigger,
    avatarSummary: input.avatarSummary,
    positioning_statement: input.positioning_statement,
    trustGapSummary: input.trustGapSummary,
    verifiedFacts: input.verifiedFacts,
  };

  return {
    ok: true,
    format,
    platform,
    decision_trigger: trigger,
    trigger_hook_angle: trigger ? UGC_TRIGGER_HOOK_ANGLE[trigger] ?? null : null,
    beats,
    persona_spec: UGC_PERSONA_SPEC,
    compliance: UGC_COMPLIANCE,
    testing_plan: UGC_TESTING_PLAN,
    positioning_inputs: reportPositioningInputs(positioning),
    higgsfield_handoff: HIGGSFIELD_HANDOFF,
    adjustment_protocol: [
      'The hook, the persona, the setting, and each talking point are independent components: swap one, keep the rest verbatim, re-run one preset generation.',
      'A changed spoken fact re-runs the claim gate before re-render; an unchanged approved line does not re-open the gate.',
      'Creative fatigue = a hook/setting refresh via refine_creative_plan, not a new campaign.',
      'After any adjustment, save the updated plan with log_asset (same external_id reconciles the version).',
    ],
    claim_gate:
      'Before the presenter states any specific claim (a number, a guarantee, a credential), flag it to the user and ask them to confirm they can substantiate it. Only include it once confirmed.',
    evidence_discipline: EVIDENCE_DISCIPLINE,
    never_contain: TIER_C_NEVER_CONTAIN,
    new_user_path: NEW_USER_EASY_PATH,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline; only verified facts may be spoken.`,
      `2) Ground the script in the positioning spine (see positioning_inputs): the Decision Trigger${trigger ? ` (${trigger})` : ''} angles the hooks, the avatar core supplies the persona spec + vocabulary + the objection to flip. Missing elements degrade honestly — plan anyway and name the sharpening input.`,
      '3) CAST the persona per persona_spec (avatar-matched preset or custom + character sheet), and compose the script: 3 hook variants (per trigger_hook_angle) over ONE body running the beats in order, every spoken fact claim-gated, register per the beat directions.',
      `4) Execute per higgsfield_handoff.preset_formats: the ${format.key} marketing-studio preset, 9:16 at ~15s, product (and packaging, for unboxing) attached from the reference kit, eligibility-checked. Batch the hook variants; QA each output for product fidelity and compliance.`,
      '5) Check compliance before anything ships: presenter framing, disclosure, platform/Amazon policy.',
      `6) Save the plan + accepted outputs with log_asset (content_type "${platform === 'amazon_listing' ? 'amazon' : 'social'}") and run testing_plan — ship the variants, read the numbers, scale the winner.`,
      '7) Adjust component-by-component via adjustment_protocol, or refine_creative_plan for positioning changes.',
    ],
    summary: `UGC ${format.label} ad plan (${platform}): ${beats.length} beats (${format.beatKeys.join(' → ')}), persona cast from the customer avatar, 3 trigger-angled hook variants over one body, every spoken fact claim-gated, AI-presenter honesty rails on.${trigger ? ` Hooks tuned to the ${trigger} trigger.` : ''} Execute via the Higgsfield ${format.key} marketing-studio preset (9:16, ~15s, reference kit attached), then test hooks → scale the winner → refresh on fatigue.`,
  };
}
