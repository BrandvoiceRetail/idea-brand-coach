/**
 * Layer 1 — the shared POSITIONING SPINE for every creative-plan director.
 *
 * One brand tells ONE positioning story everywhere a shopper lands: the listing image
 * set, the video, the A+ page, the main-image+title pair in the search grid, and the
 * storefront. This module is the single source of that alignment so each director
 * (listingImageBrief, videoStoryboard, aplusPlan, mainImageTitle, storefrontMessaging)
 * grounds in the SAME four positioning elements and a positioning change propagates
 * deterministically to every surface (refine_creative_plan reads the map — no director
 * invents its own idea of "what changes when the trigger changes").
 *
 * Also owns the Higgsfield execution bridge: the brand coach prepares briefs, the HOST
 * (connector Claude) carries them to the Higgsfield connector (generate_image /
 * generate_video / edit tools) and logs the produced assets back — the same host-driven
 * pattern as Windsor metric ingestion. The coach NEVER claims to render media itself.
 */

/** Every creative surface a plan director owns. `listing_image_set` is the existing brief. */
export const CREATIVE_PLAN_TYPES = [
  'listing_image_set',
  'video_storyboard',
  'aplus_content',
  'main_image_title',
  'storefront_messaging',
  'ugc_ad',
] as const;
export type CreativePlanType = (typeof CREATIVE_PLAN_TYPES)[number];

/** The positioning elements every creative plan must trace to. */
export const POSITIONING_ELEMENT_KEYS = [
  'decision_trigger',
  'avatar_core',
  'signature',
  'trust_gap_pillar',
  'verified_facts',
] as const;
export type PositioningElementKey = (typeof POSITIONING_ELEMENT_KEYS)[number];

export interface PositioningElement {
  key: PositioningElementKey;
  label: string;
  /** What this element is, in coach terms. */
  whatItIs: string;
  /** The MCP tool that resolves it when the user doesn't have it yet. */
  resolveWith: string;
  /** How a plan degrades honestly when this element is missing (never block a new user). */
  whenMissing: string;
}

/**
 * The four-plus-one positioning spine. Order matters: it is the resolve order a NEW user
 * walks (trigger → avatar → signature → trust gap), with verified facts as the standing
 * evidence floor under all of them.
 */
export const POSITIONING_SPINE: readonly PositioningElement[] = [
  {
    key: 'decision_trigger',
    label: 'Decision Trigger',
    whatItIs: 'The one psychological lever this purchase turns on — the angle every hook, hero and headline leads with.',
    resolveWith: 'identify_decision_trigger',
    whenMissing: 'Generate with a neutral benefit-led angle and name identify_decision_trigger as the ONE input that sharpens the whole set.',
  },
  {
    key: 'avatar_core',
    label: 'Avatar emotional core',
    whatItIs: "The customer's felt experience — the struggle, the moment before, the relief — that the empathetic beats must mirror.",
    resolveWith: 'get_avatar (or build_avatar_stage to build one)',
    whenMissing: 'Ask for one sentence about who buys and why it matters to them; use it verbatim as the interim core.',
  },
  {
    key: 'signature',
    label: 'Signature (distinctive line)',
    whatItIs: 'The ownable one-liner that separates this brand from the field — the line taglines, comparison slots and hero overlays derive from.',
    resolveWith: 'generate_signature (persist with persist_signature)',
    whenMissing: 'Use the strongest verified differentiator as a working line and mark it interim — never invent an unsupported claim to fill the slot.',
  },
  {
    key: 'trust_gap_pillar',
    label: 'Trust Gap weakest pillar',
    whatItIs: 'The IDEA pillar the diagnostic scored weakest — the gap this creative set is being built to close.',
    resolveWith: 'run_trust_gap (or assess_idea_dimensions from evidence)',
    whenMissing: 'Weight surfaces evenly and note that a Trust Gap run would tell the user which slot/scene earns the most lift.',
  },
  {
    key: 'verified_facts',
    label: 'Verified product facts',
    whatItIs: 'The user-confirmed claims, dimensions, counts and materials — the only things customer-facing copy may state.',
    resolveWith: 'ingest_evidence / provide_context (and the claim gate before any new claim)',
    whenMissing: 'Produce direction without stated claims and list exactly which facts need confirming before copy is final.',
  },
];

/**
 * The deterministic propagation map: when a positioning element CHANGES, what each
 * creative surface must recompose (and, implicitly, everything not named stays as
 * approved). refine_creative_plan filters this by the changed element(s); the coach
 * uses it both to update the plan in hand and to flag the user's OTHER live plans
 * as stale — one positioning story everywhere, updated everywhere.
 */
export const POSITIONING_PROPAGATION: Record<PositioningElementKey, Record<CreativePlanType, string>> = {
  decision_trigger: {
    listing_image_set: 'Recompose the main-image styling register + the comparison slot angle; gallery copy that led with the old trigger re-leads with the new one.',
    video_storyboard: 'Recompose the HOOK scene (first 3 seconds) and the close; other scenes keep their footage direction unless their overlay line named the old angle.',
    aplus_content: 'Re-anchor the strongest-benefit beat and the emotional close on the new trigger; the product-clarity beat is unaffected.',
    main_image_title: 'Rewrite the distinctive-difference segment of the title and re-check the main-image styling register against the new angle.',
    storefront_messaging: 'Re-lead the store hero line and the brand-story opening; category tiles keep their job-promises.',
    ugc_ad: 'Rewrite the spoken hook variants — the hook IS the trigger in UGC; the body keeps unless a talking point named the old angle.',
  },
  avatar_core: {
    listing_image_set: 'Recompose the lifestyle slot (the empathetic lead) and the benefits slot outcomes; the main image is unaffected.',
    video_storyboard: 'Recompose the EMPATHY scene (setting, casting, felt moment) and the voiceover tone; product scenes keep their direction.',
    aplus_content: 'Recompose the use-case beat and the emotional close around the new felt experience.',
    main_image_title: 'Re-check the avatar-relevant use/outcome segment of the title; the main image is unaffected.',
    storefront_messaging: 'Recompose the brand-story block and re-map category tiles to the new avatar\'s jobs.',
    ugc_ad: "Re-cast the persona (demographic/register/setting) and re-ground the talking points + skeptic flip in the new avatar's vocabulary and top objection.",
  },
  signature: {
    listing_image_set: 'Recompose the comparison slot (the ownable why-this-one line) and any hero overlay derived from the old signature.',
    video_storyboard: 'Swap the signature line wherever it appears as overlay/VO (typically hook or close); footage direction stands.',
    aplus_content: 'Re-thread the distinctive motif and any signature-derived headline across the beats.',
    main_image_title: 'Rewrite the distinctive-difference segment of the title from the new signature.',
    storefront_messaging: 'Regenerate the tagline system and the store-hero overlay line from the new signature.',
    ugc_ad: 'Swap the distinctive line where the script lands it (usually the close); the rest of the script stands.',
  },
  trust_gap_pillar: {
    listing_image_set: 'Re-weight the set: the slot that closes the new weakest pillar gets the strongest treatment (e.g. Authentic → trust slot leads the gallery).',
    video_storyboard: 'Re-weight scene emphasis and duration toward the scene that closes the new pillar (e.g. Empathetic → the empathy scene grows).',
    aplus_content: 'Re-weight which beat carries the page: the beat mapped to the new weakest pillar becomes the visual centrepiece.',
    main_image_title: 'Re-check which coherence angle (distinctive vs proof) the pair should emphasise for the new pillar.',
    storefront_messaging: 'Re-weight the storefront: the section closing the new pillar moves up the page.',
    ugc_ad: 'Re-weight the script: the beat closing the new pillar (e.g. the skeptic flip for Authentic) gets the screen time.',
  },
  verified_facts: {
    listing_image_set: 'Re-run the claim gate on every gallery/features line; update stated facts verbatim; pull any copy whose fact was withdrawn.',
    video_storyboard: 'Re-run the claim gate on every overlay + VO line; re-render ONLY scenes whose stated fact changed.',
    aplus_content: 'Re-run the claim gate on all on-image copy; update facts verbatim in the affected beats only.',
    main_image_title: 'Update the exact-facts segment of the title verbatim (size/count/variant); re-check title compliance.',
    storefront_messaging: 'Re-run the claim gate on hero + tile copy; update stated facts verbatim.',
    ugc_ad: 'Re-run the claim gate on every spoken statement; re-render only the takes whose stated fact changed.',
  },
};

/**
 * The Higgsfield execution bridge: how a brand-coach-prepared brief becomes real media.
 * The HOST carries these steps to the Higgsfield connector tools; the brand coach only
 * directs and receives the results back into the ledger.
 */
export const HIGGSFIELD_HANDOFF = {
  image:
    'Photoreal stills, A+ editorial compositions and storefront banners route to Higgsfield generate_image (use models_explore action:"recommend" if unsure of the model). Give it the composed IMAGE_PROMPT verbatim — including the exact negative prompt. Layout/infographic slots stay with a layout tool (Canva) — Higgsfield image gen is for photography-grade output, not text-grid infographics.',
  video:
    'Two execution modes, both host-driven. (A) STORYBOARD-IMAGE mode — the fast default: generate ONE multi-panel storyboard IMAGE via generate_image (panels in scene order with the beat captions embedded — the video model reads that text), fix individual panels with image EDITS ("ensure panel 5 matches the style of the rest"), then run ONE generate_video job with the storyboard image as reference — it returns a full multi-shot sequence with cuts. Cheapest way to see the whole film. (B) PER-SCENE mode — precision: one generate_video job per scene, image-to-video from an approved still of the actual product, for fidelity-critical scenes. Storyboard-reference mode hits the story BEATS, not frame-for-frame — so prototype in A, then re-render only the shots that need precision in B. For films longer than the model\'s per-job limit (~15s), chain segments: split the film into prompts that flow into each other and attach the PRIOR clip as a video reference so each segment carries the visual language forward.',
  preset_formats:
    "Proven ad formats — UGC try-on, unboxing, high-motion product review — are NOT hand-storyboarded: route them to Higgsfield's marketing-studio presets (prompt templates built on formats that already perform on Meta/TikTok). The brand coach still supplies what the preset cannot know: pick/build the on-screen persona to MATCH the brand's customer avatar (demographic + register), give the hook line from the Decision Trigger, claim-gate every spoken product statement, and attach the product (and the packaging reference for unboxing). 9:16 at ~15s for social.",
  reference_discipline:
    "Build the REFERENCE KIT first, then storyboards, then video: upload the user's REAL product photo (media upload) and generate from it a product reference sheet (multi-view, all angles) — never from imagination; the brand logo; a packaging mock (needed for unboxing formats); and a character sheet for any recurring human, covering EVERY state the film shows (e.g. goggles on AND off), so the video model never has to guess. Run the platform's eligibility check on uploaded references before generating. When a prompt carries multiple references, @-tag WHICH reference each element means — untagged references get confused and waste generations. In every product-bearing generation, cite the reference as strict and list the product invariants (shape, colour, proportions, included components) that must not change.",
  draft_economy:
    'Draft cheap, finish sharp: while iterating, batch 3-4 generations per run and pick (faster convergence than one-at-a-time); generate the storyboard image at high fidelity (4K feeds the video model detail) but prototype VIDEO at a lower resolution to test the concept before spending credits on the final; for multi-shot sequences, re-run the same prompt 2-3 times and cherry-pick the best moments in edit. Iteration is the reality of production — pick the cleanest take and move on.',
  edit_tools:
    'For mechanical changes, use the dedicated Higgsfield edit tool instead of regenerating: reframe (aspect-ratio change), upscale_image / upscale_video (resolution), remove_background (cutouts), outpaint_image (extend a composition, e.g. to a storefront banner width), voice/dubbing tools (swap a voiceover line). Regenerate only when the creative direction itself changed.',
  job_loop:
    'Each generation returns a job — poll job_status until complete, then review the output against the plan\'s QA bar BEFORE showing it as done. If the engine missed the brief (wrong product geometry, garbled text, off-register mood), fix the prompt and re-run that one job — never accept drift.',
  save_back:
    "Log every accepted output to the brand-coach ledger with log_asset (content_type 'amazon' for listing/A+/storefront work, 'social' for social video) and carry the Higgsfield asset URL in the content. Then wire the split-test: design_test with the plan's hypothesis, and stamp asset_created → asset_live via update_test_milestone as it goes live. Close the loop: ingest performance (ingest_content_performance / ingest_campaign_analytics) and read it back (get_campaign_metrics / get_experiment_lift) so the next round of creative repeats what measurably worked — refine_creative_plan takes it from there.",
} as const;

/** The 8-part order for a ready-to-generate VIDEO production prompt (per storyboard scene). */
export const VIDEO_PROMPT_CONSTRUCTION: readonly string[] = [
  'Prefix every scene generation prompt with the exact marker "VIDEO_PROMPT:".',
  '1) Output + accuracy: one clip at the scene\'s duration and the format\'s aspect ratio; the uploaded product photo / approved still is the STRICT visual reference; list the product invariants that must not change.',
  '2) Scene direction: subject, setting, time-of-day/lighting, and the emotional register this scene must land.',
  '3) Motion: what moves and how — camera (push/pan/orbit/static) vs subject action — and the pacing (slow reveal vs energetic cut).',
  '4) On-screen text: the exact overlay line verbatim, or NONE — prefer adding text in post/edit; generated on-screen text garbles.',
  '5) Voiceover/audio: direct diegetic sound only (natural ambience, environmental foley, subject-driven sound) unless the brand wants music; note the VO line but generate speech separately (voice/audio tools), never ask the video model to speak. Say "no text" so the model does not invent overlays.',
  '6) Continuity anchors: repeat the set-wide palette/lighting/mood descriptors verbatim so every scene cuts together as one film.',
  '7) Compliance: no unsupported claims shown or stated, no unsafe use, and the channel\'s policy rules (Amazon listing video: no price/promo/off-Amazon CTAs).',
  '8) Negative prompt: end with the exact video negative paragraph plus product-specific avoid items.',
];

/** The verbatim negative-prompt paragraph to append to every scene generation prompt. */
export const EXACT_VIDEO_NEGATIVE_PROMPT =
  'Negative prompt: avoid warped or morphing product geometry, distorted logos, garbled or drifting on-screen text, extra or deformed hands, flickering artifacts, sudden style shifts between frames, stock-footage watermarks, price tags, discount banners, star ratings, URL overlays, competitor products, and anything that changes the product\'s shape, colour, proportions, or included components.';

/**
 * The new-user easy path: the ordered, minimal route from "I just connected" to a
 * positioning-aligned creative plan. Every director returns this so the coach walks a
 * brand-new user through it one step at a time — and NEVER blocks a plan on the full
 * pipeline (each spine element degrades per `whenMissing`).
 */
export const NEW_USER_EASY_PATH: readonly string[] = [
  '1) get_context_status — see what the user has already given (never re-ask for it).',
  '2) Fill only the missing spine elements, one at a time, smallest first: identify_decision_trigger → a one-line avatar core (or get_avatar) → generate_signature → run_trust_gap. Any ONE of these improves the plan; none of them blocks it.',
  '3) Generate the plan with whatever is known — the plan names which missing input would sharpen it most.',
  '4) Confirm claims through the claim gate (only user-confirmed facts appear in copy).',
  '5) Compose the final briefs/prompts per the plan and hand them to Higgsfield (see the handoff).',
  '6) Save the plan with log_asset so every later adjustment starts from the saved version (refine_creative_plan), and wire the split-test.',
];

/** Tier-C / framework jargon the composed plan must never contain (IDEA-POLICY-TERM-001). */
export const TIER_C_NEVER_CONTAIN: readonly string[] = [
  'Framework terminology: IDEA, Trust Gap, Decision Trigger, buyer state, CAPTURE.',
  'Buyer-state names: Assessor, Protector, Expresser, Connector.',
  'Academic/engine internals: neuroanatomy, System 1/2, S1-S4, confidence scores.',
  'Options for the designer to choose between — give one direction per component.',
];

/** What the caller provided for each spine element (the honest degrade surface). */
export interface PositioningInputReport {
  element: PositioningElementKey;
  label: string;
  status: 'provided' | 'missing';
  /** How to resolve it when missing (tool), or how it was understood when provided. */
  note: string;
}

/** Inputs the directors accept for the spine (all optional — new users start empty). */
export interface PositioningInputs {
  decisionTrigger?: string | null;
  avatarSummary?: string | null;
  signature?: string | null;
  trustGapSummary?: string | null;
  verifiedFacts?: string | null;
}

/**
 * Report which spine elements the caller provided vs still needs — the shared
 * "degrade honestly, name the sharpening input" surface every director returns.
 */
export function reportPositioningInputs(inputs: PositioningInputs): PositioningInputReport[] {
  const provided: Record<PositioningElementKey, string | null | undefined> = {
    decision_trigger: inputs.decisionTrigger,
    avatar_core: inputs.avatarSummary,
    signature: inputs.signature,
    trust_gap_pillar: inputs.trustGapSummary,
    verified_facts: inputs.verifiedFacts,
  };
  return POSITIONING_SPINE.map((el) => {
    const value = provided[el.key];
    const has = typeof value === 'string' && value.trim().length > 0;
    return {
      element: el.key,
      label: el.label,
      status: has ? 'provided' : 'missing',
      note: has ? el.whatItIs : `${el.whenMissing} Resolve with: ${el.resolveWith}.`,
    };
  });
}

/** Normalize a free-text trigger to the canonical six (or null). */
export function normalizeTrigger(trigger?: string | null): string | null {
  if (!trigger) return null;
  return trigger.toLowerCase().replace(/[\s-]/g, '_');
}
