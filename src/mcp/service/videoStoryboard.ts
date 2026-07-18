/**
 * Layer 1 — `generate_video_storyboard` director.
 *
 * Produces a positioning-aligned, scene-by-scene VIDEO STORYBOARD plan for a product /
 * brand video — each scene tied to the Decision Trigger, the Avatar's emotional core,
 * and the Trust Gap pillar it closes — with a per-scene Higgsfield `generate_video`
 * execution route so the host can take the composed brief straight to generation.
 *
 * Grounding-director, same posture as `listingImageBrief`: it returns the scene
 * architecture + per-scene direction + the Higgsfield handoff + the adjustment
 * protocol, and the connector coach composes the final per-scene prose + the
 * ready-to-paste VIDEO_PROMPTs for the user's product and resolved context. It NEVER
 * produces video and NEVER fabricates a claim.
 *
 * Scene-level adjustability is a first-class design goal (the new-user promise):
 * every scene is independently re-renderable — one changed component means one
 * recomposed prompt and ONE re-run Higgsfield job, never a full-set regeneration —
 * and mechanical changes route to Higgsfield's edit tools (reframe/upscale/voice).
 */
import { EVIDENCE_DISCIPLINE } from './listingImageBrief.js';
import {
  EXACT_VIDEO_NEGATIVE_PROMPT,
  HIGGSFIELD_HANDOFF,
  NEW_USER_EASY_PATH,
  TIER_C_NEVER_CONTAIN,
  VIDEO_PROMPT_CONSTRUCTION,
  normalizeTrigger,
  reportPositioningInputs,
  type PositioningInputReport,
  type PositioningInputs,
} from './creativeAlignment.js';

/** How each Decision Trigger opens the HOOK scene — the first 3 seconds. */
export const TRIGGER_HOOK_DIRECTION: Record<string, string> = {
  permission:
    'Open on the authority cue in motion — the credential, the clinical detail, the precision mechanism working — before a single word of benefit.',
  recognition:
    "Open inside the customer's moment — the struggle or the moment-before, shot so the viewer thinks 'that is me' before the product appears.",
  identity:
    'Open on the world the customer wants to belong to — the lifestyle in motion, the product arriving as its natural prop.',
  belonging:
    'Open on people and shared purpose — the community/mission moment first, the product as its expression.',
  momentum:
    'Open on visible scale — the crowd, the count, the repeat ritual — social proof moving on screen in the first beat.',
  fear_of_loss:
    'Open on the cost of inaction in motion — the consequence unfolding, the before-state degrading — so waiting itself feels like the loss.',
};

export type SceneEngineMode = 'image_to_video' | 'text_to_video';

export interface StoryboardScene {
  key: string;
  label: string;
  /** What this scene's job is in the film. */
  purpose: string;
  /** Which IDEA pillar / Trust-Gap element it primarily closes. */
  ideaPillar: 'Insight-Driven' | 'Distinctive' | 'Empathetic' | 'Authentic';
  /** Composition + emotional-register direction (what it must communicate, not how). */
  direction: string;
  /** On-screen text rule for this scene. */
  onScreenText: string;
  /** Voiceover direction for this scene. */
  voiceover: string;
  /** Preferred Higgsfield generation mode + why. */
  engineMode: SceneEngineMode;
  /** Suggested share of the film's runtime. */
  durationShare: string;
}

/**
 * The canonical scene library. Formats select an ordered subset; scene keys are the
 * stable component ids the adjustment protocol (and refine_creative_plan) addresses.
 */
export const STORYBOARD_SCENES: readonly StoryboardScene[] = [
  {
    key: 'hook',
    label: 'Hook (first 3 seconds)',
    purpose: 'Stop the scroll / earn the watch against everything else on screen.',
    ideaPillar: 'Distinctive',
    direction:
      'The Decision Trigger leads in MOTION — see TRIGGER_HOOK_DIRECTION for the angle. One idea only; if the hook needs explaining, it is not a hook.',
    onScreenText: 'One short line max, or none — the motion is the message.',
    voiceover: 'Optional single opening line; must land inside 3 seconds.',
    engineMode: 'text_to_video',
    durationShare: '~10% of runtime, never more than 4s.',
  },
  {
    key: 'empathy',
    label: 'The felt moment',
    purpose: "Mirror the customer's emotional reality — 'I see you' before the science.",
    ideaPillar: 'Empathetic',
    direction:
      "The Avatar's felt experience in their real world: the struggle, the moment before, or the relief. The empathetic line LEADS here — this is the set's hero message.",
    onScreenText: 'The empathetic line, verbatim from the resolved avatar core.',
    voiceover: 'The empathetic line or a close variant — warm, specific, unhurried.',
    engineMode: 'text_to_video',
    durationShare: '~20% of runtime.',
  },
  {
    key: 'brand_why',
    label: 'The brand why',
    purpose: 'The founder/mission beat — why this brand exists beyond the sale.',
    ideaPillar: 'Authentic',
    direction:
      'Real story, real specifics — the origin moment or the mission in action. No stock-footage sincerity; if there is real founder/workshop footage, direct THAT.',
    onScreenText: 'One mission line max.',
    voiceover: 'First-person where possible — the founder voice beats a narrator here.',
    engineMode: 'text_to_video',
    durationShare: '~20% of runtime (brand-story format only).',
  },
  {
    key: 'product_reveal',
    label: 'Product reveal',
    purpose: 'The product enters as the answer — the hero shot in motion.',
    ideaPillar: 'Distinctive',
    direction:
      'The actual product, unmistakably itself — slow push/orbit on the real geometry, premium light. This is the fidelity-critical scene: animate from an approved still of the real product.',
    onScreenText: 'Product name or nothing.',
    voiceover: 'Name the product and its one-line promise.',
    engineMode: 'image_to_video',
    durationShare: '~20% of runtime.',
  },
  {
    key: 'proof',
    label: 'Proof / how it works',
    purpose: "Show the top outcome the customer wants and the mechanism that delivers it.",
    ideaPillar: 'Insight-Driven',
    direction:
      'Benefit-first: the outcome visibly happening, then the mechanism. Every number/claim shown or spoken must be a verified fact, verbatim.',
    onScreenText: 'Benefit callouts — short, concrete, claim-gated.',
    voiceover: 'The 1-2 strongest outcomes, stated exactly as verified.',
    engineMode: 'image_to_video',
    durationShare: '~20% of runtime.',
  },
  {
    key: 'trust',
    label: 'Trust beat',
    purpose: 'Close the credibility gap — guarantee, credentials, real social proof.',
    ideaPillar: 'Authentic',
    direction:
      'Make legitimacy felt with real specifics (actual guarantee terms, genuine credentials). Runs through the claim gate before anything is stated.',
    onScreenText: 'The one claim-gated trust line.',
    voiceover: 'Optional — the trust line if not on screen.',
    engineMode: 'text_to_video',
    durationShare: '~10% of runtime.',
  },
  {
    key: 'close',
    label: 'Close / CTA',
    purpose: 'Land the film and tell the viewer what happens next — channel-appropriate.',
    ideaPillar: 'Distinctive',
    direction:
      'End on the product + the distinctive line. Amazon listing video: a confidence close (no off-Amazon CTA, no price/promo). Social: an explicit next step is allowed.',
    onScreenText: 'The positioning statement/distinctive line, then the channel-appropriate CTA.',
    voiceover: 'The closing line — same register as the hook so the film bookends.',
    engineMode: 'image_to_video',
    durationShare: '~10% of runtime.',
  },
];

export interface VideoFormatSpec {
  key: string;
  label: string;
  where: string;
  /** Ordered scene keys drawn from STORYBOARD_SCENES. */
  sceneKeys: readonly string[];
  aspectRatio: string;
  targetDurationSeconds: number;
  channelRules: string;
}

/** The three video formats the director plans for. */
export const VIDEO_FORMATS: readonly VideoFormatSpec[] = [
  {
    key: 'listing_video',
    label: 'Amazon listing video',
    where: 'The product-detail-page video slot (and the video strip in search).',
    sceneKeys: ['hook', 'empathy', 'product_reveal', 'proof', 'trust', 'close'],
    aspectRatio: '16:9',
    targetDurationSeconds: 45,
    channelRules:
      'AMAZON VIDEO POLICY (hard): no pricing, promotions, discount codes or time-sensitive info; no off-Amazon URLs or CTAs; no unverified claims ("#1", "best" need substantiation); the product shown must be exactly the product listed. Design for sound-off first — the film must work with captions alone.',
  },
  {
    key: 'social_short',
    label: 'Social short (Reels / TikTok / Shorts)',
    where: 'Paid + organic social — the top-of-funnel scroll.',
    sceneKeys: ['hook', 'empathy', 'product_reveal', 'close'],
    aspectRatio: '9:16',
    targetDurationSeconds: 22,
    channelRules:
      'Platform-native, not an ad that interrupts: the hook carries everything (most viewers leave in 3s). Captions always on; design for sound-off. An explicit CTA is allowed in the close.',
  },
  {
    key: 'brand_story',
    label: 'Brand story film',
    where: 'Storefront hero, A+ brand row, website, and retargeting.',
    sceneKeys: ['hook', 'empathy', 'brand_why', 'product_reveal', 'close'],
    aspectRatio: '16:9',
    targetDurationSeconds: 60,
    channelRules:
      'The mission carries the film; the product supports it. Real founder/workshop footage beats generated footage wherever it exists — generate only what cannot be shot.',
  },
];

export interface VideoStoryboardInput {
  /** The product / brand the video is for (name + a sentence, or an ASIN). */
  product: string;
  /** One of the format keys; defaults to listing_video. */
  format?: string;
  decisionTrigger?: string;
  avatarSummary?: string;
  positioning_statement?: string;
  trustGapSummary?: string;
  verifiedFacts?: string;
  /** Override the format's target duration. */
  durationSeconds?: number;
  marketplace?: string;
  /** The funnel piece (brand_asset) this video is for, to wire the split-test. */
  brandAssetId?: string;
}

/**
 * How to compose the single multi-panel STORYBOARD IMAGE (execution mode A). The video
 * model reads the text embedded in the panels, so the storyboard image IS the brief.
 */
export const STORYBOARD_IMAGE_SPEC: readonly string[] = [
  'ONE image containing every scene as a panel, in reading order matching the scene list — each panel captioned with its scene label, beat direction, and the exact overlay/VO line (the video model extracts this embedded text).',
  'One locked style across all panels (name it once in the prompt); the product appears exactly per the product reference sheet in every product-bearing panel.',
  'Generate at high visual fidelity (4K if available) at the format\'s aspect ratio — detail in the storyboard becomes quality in the animation. Generate 2 options and pick.',
  'Fix a single panel by EDITING the storyboard image ("ensure panel 5 has the same style as the rest of the film") — never regenerate the whole board for one panel.',
];

/** The two Higgsfield execution modes and when each earns its cost. */
export const EXECUTION_MODES = {
  storyboard_image: {
    label: 'Storyboard-image mode (default — fastest, cheapest)',
    how: 'Compose the storyboard as ONE multi-panel image per storyboard_image_spec → ONE generate_video job with that image as reference ("use the reference storyboards to make the film" + audio direction + "no text") → a full multi-shot sequence with cuts comes back.',
    when: 'Prototyping, social shorts, concept tests, and every new user\'s first film — you see the whole sequence for one job\'s credits. Honest limit: the model hits the story BEATS, not frame-for-frame panels.',
  },
  per_scene: {
    label: 'Per-scene mode (precision)',
    when: 'Fidelity-critical work — the listing-video final cut, any scene where exact product geometry or an exact overlay matters, or a single shot the storyboard-image run got wrong.',
    how: 'One generate_video job per scene, image-to-video from an approved still of the actual product, continuity anchors repeated verbatim across jobs.',
  },
  recommendation:
    'Hybrid: prototype the whole film in storyboard-image mode, then re-render ONLY the scenes that need precision in per-scene mode. Re-running the same multi-shot prompt 2-3 times and cherry-picking moments in edit often beats prompt-tweaking.',
} as const;

/** Set-wide audio direction (both modes). */
export const AUDIO_DIRECTION =
  'Diegetic sound only — natural ambience, environmental foley, subject-driven sound — unless the brand asks for music. Voiceover is generated separately (voice/audio tools) and married in edit. Always say "no text" in the video prompt: overlay text is added in post, generated text garbles.';

/**
 * Proven ad formats that skip hand-storyboarding entirely — the EASIEST path to ad
 * content. These route to Higgsfield's marketing-studio presets; the brand coach
 * supplies only what the preset cannot know (persona, hook, claim-gated script).
 */
export const PRESET_AD_FORMATS: ReadonlyArray<{ key: string; label: string; direction: string }> = [
  {
    key: 'ugc_ad',
    label: 'UGC try-on / review ad',
    direction:
      "Route to the UGC marketing-studio preset. For the full script-level plan (persona cast from the avatar, 3 trigger-angled hook variants, claim-gated talking points, the skeptic flip, honesty rails), call generate_ugc_ad_plan — this storyboard entry is just the routing pointer. 9:16, ~15s.",
  },
  {
    key: 'unboxing',
    label: 'Unboxing ad',
    direction:
      'Route to the unboxing marketing-studio preset with the PACKAGING reference attached (from the reference kit) so the model unboxes the real packaging. Persona + hook + claim gate as with UGC.',
  },
  {
    key: 'hyper_motion',
    label: 'High-motion product ad',
    direction:
      'Route to the high-motion/product-review preset — the big-brand commercial register. Product reference strict; the distinctive line lands as the close.',
  },
];

export interface VideoStoryboardResult {
  ok: true;
  format: VideoFormatSpec;
  decision_trigger: string | null;
  trigger_hook_direction: string | null;
  /** The format's scenes, in order, numbered. */
  scenes: Array<StoryboardScene & { scene: number }>;
  /** What the caller provided vs still needs — the honest degrade surface. */
  positioning_inputs: PositioningInputReport[];
  /** The Higgsfield execution bridge (host-driven: coach prepares, host generates). */
  higgsfield_handoff: typeof HIGGSFIELD_HANDOFF;
  /** The two execution modes + the hybrid recommendation. */
  execution_modes: typeof EXECUTION_MODES;
  /** How to compose the single multi-panel storyboard image (mode A). */
  storyboard_image_spec: readonly string[];
  /** Set-wide audio direction (both modes). */
  audio_direction: string;
  /** Preset ad formats (UGC/unboxing/high-motion) that skip hand-storyboarding. */
  preset_ad_formats: typeof PRESET_AD_FORMATS;
  /** How to construct each scene's ready-to-generate VIDEO_PROMPT. */
  prompt_construction: { steps: readonly string[]; exact_negative_prompt: string };
  /** Scene-level adjustment protocol — one changed component, one re-run job. */
  adjustment_protocol: string[];
  claim_gate: string;
  evidence_discipline: readonly string[];
  qa_checklist: readonly string[];
  never_contain: readonly string[];
  new_user_path: readonly string[];
  instructions: string[];
  summary: string;
}

/** Video-specific QA bar (fidelity-in-motion is the failure mode stills don't have). */
export const VIDEO_QA_CHECKLIST: readonly string[] = [
  'Product geometry, colour, proportions and included components stay true in EVERY frame — motion is where product fidelity breaks; reject any morph/warp.',
  'Every spoken or on-screen claim traces to a verified fact, verbatim; no invented numbers, awards, or guarantees.',
  'The scenes cut together as one film: continuity anchors (palette, lighting, mood) hold across scenes; no style lurches.',
  'The film works with sound OFF (captions/overlays carry the message) AND with sound on.',
  'Channel rules hold (Amazon: no price/promo/off-Amazon CTA); verify the ACTUAL rendered duration/aspect/resolution and report them honestly.',
];

/** Build the video-storyboard plan, tailored to any provided positioning context. */
export function buildVideoStoryboard(input: VideoStoryboardInput): VideoStoryboardResult {
  const format = VIDEO_FORMATS.find((f) => f.key === (input.format ?? 'listing_video')) ?? VIDEO_FORMATS[0];
  const trigger = normalizeTrigger(input.decisionTrigger);
  const hookDirection = trigger ? TRIGGER_HOOK_DIRECTION[trigger] ?? null : null;
  const duration = input.durationSeconds ?? format.targetDurationSeconds;

  const sceneByKey = new Map(STORYBOARD_SCENES.map((s) => [s.key, s]));
  const scenes = format.sceneKeys.map((key, i) => ({ ...(sceneByKey.get(key) as StoryboardScene), scene: i + 1 }));

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
    decision_trigger: trigger,
    trigger_hook_direction: hookDirection,
    scenes,
    positioning_inputs: reportPositioningInputs(positioning),
    higgsfield_handoff: HIGGSFIELD_HANDOFF,
    execution_modes: EXECUTION_MODES,
    storyboard_image_spec: STORYBOARD_IMAGE_SPEC,
    audio_direction: AUDIO_DIRECTION,
    preset_ad_formats: PRESET_AD_FORMATS,
    prompt_construction: { steps: VIDEO_PROMPT_CONSTRUCTION, exact_negative_prompt: EXACT_VIDEO_NEGATIVE_PROMPT },
    adjustment_protocol: [
      'In storyboard-image mode, adjust by EDITING the storyboard image — name the panel ("ensure panel 3 shows the morning kitchen, same style as the rest") — then re-run the single video job: the cheapest whole-film change there is.',
      'In per-scene mode, every scene is an independent component: to change one, recompose ONLY that scene\'s VIDEO_PROMPT (keep the continuity anchors verbatim) and re-run ONE Higgsfield generate_video job — never regenerate the whole set.',
      'Mechanical changes skip regeneration entirely: aspect ratio → reframe; resolution → upscale_video; a voiceover line → the voice/dubbing tools; scene order → re-cut the assembly, no new footage.',
      'A changed overlay/VO line that states a fact re-runs the claim gate before render.',
      'After any adjustment, save the updated storyboard with log_asset (same external_id reconciles the version) so the saved plan always matches what is live.',
      'For positioning changes (new trigger/avatar/positioning statement/trust finding), call refine_creative_plan — it maps exactly which scenes recompose and which stand.',
    ],
    claim_gate:
      'Before any guarantee or specific claim appears on screen or in voiceover, flag it to the user and ask them to confirm they offer/can substantiate it. Only include it once confirmed.',
    evidence_discipline: EVIDENCE_DISCIPLINE,
    qa_checklist: VIDEO_QA_CHECKLIST,
    never_contain: TIER_C_NEVER_CONTAIN,
    new_user_path: NEW_USER_EASY_PATH,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline (verified facts vs strategy signals vs unsupported). Only verified facts may be spoken or shown.`,
      `2) Ground the film in the positioning spine (see positioning_inputs): the Decision Trigger${trigger ? ` (${trigger})` : ''}, the avatar's felt experience, the positioning statement line, and the Trust Gap pillar this video closes. Missing elements degrade per the report — generate anyway and name the one input that sharpens it most.`,
      `3) For EACH scene, compose: (A) one-line context, (B) the shot + motion direction and emotional register, (C) the exact overlay/VO lines (claim-gated), (D) the continuity anchors. Target ~${duration}s total at ${format.aspectRatio}; respect each scene's durationShare.`,
      '4) Pick the execution mode (execution_modes): DEFAULT to storyboard-image mode — build the reference kit per higgsfield_handoff.reference_discipline, compose the ONE multi-panel storyboard image per storyboard_image_spec, then run ONE generate_video job with the storyboard as reference + audio_direction. Use per-scene mode (VIDEO_PROMPTs per prompt_construction) only for fidelity-critical scenes or re-renders; chain segments with the prior clip as video reference for films past the per-job limit. For UGC/unboxing/high-motion ads, skip storyboarding entirely — route via preset_ad_formats. Poll job_status; QA everything against qa_checklist.',
      '5) Generate voiceover separately (voice/audio tools) and marry it in edit — never ask the video model to speak. Audio otherwise per audio_direction.',
      `6) Save the storyboard with log_asset (content_type "${format.key === 'social_short' ? 'social' : 'amazon'}"), log each accepted clip the same way, and wire the split-test: design_test (hypothesis = this video lifts ${format.key === 'listing_video' ? 'CVR on the listing' : 'CTR/engagement on the channel'}), then update_test_milestone as it goes live.`,
      '7) When the user wants a change, use adjustment_protocol — one component, one job — or refine_creative_plan for positioning changes.',
    ],
    summary: `${format.label} storyboard: ${scenes.length} scenes (${format.sceneKeys.join(' → ')}) at ${format.aspectRatio}, ~${duration}s.${trigger ? ` Hook tuned to the ${trigger} trigger.` : ''} Default execution: build the reference kit, compose ONE multi-panel storyboard image, hand it to Higgsfield generate_video for the full multi-shot film (per-scene image-to-video only where precision demands it; marketing-studio presets for UGC/unboxing ads). QA every clip, save + split-test — and adjust panel-by-panel or scene-by-scene, never by full regeneration.`,
  };
}
