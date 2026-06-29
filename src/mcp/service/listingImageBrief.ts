/**
 * Layer 1 — `generate_listing_image_brief` director.
 *
 * Produces an Amazon-optimised, IDEA-incorporated **listing image SET** design brief:
 * one brief per slot (main + gallery), each tied to the Decision Trigger, the Avatar's
 * emotional core, and the Trust Gap pillar it closes — ready to hand to a photographer,
 * a photoreal AI image generator, or Genrupt. This is the grounding-director: it returns
 * the full framework + per-slot direction + execution routing, and the connector coach
 * composes the final per-slot prose + the ready-to-paste image prompts for the user's
 * specific product and resolved IDEA context.
 *
 * Why this exists (from live coach sessions + Trevor's Slack):
 *  - The coach did not know Amazon image conventions and kept misfiring Canva's
 *    generate-design (which produces LAYOUTS/briefs-as-images, not photoreal product
 *    shots), and even put a badge + dark background on the MAIN image — which Amazon's
 *    main-image policy forbids. This framework encodes those conventions so it can't.
 *  - Trevor's Genrupt test: strong rational, "emotionally thin"; the empathetic line must
 *    LEAD the lifestyle/hero slot, and claims + sizing must be preserved exactly (Genrupt
 *    distorted both). The claim gate + empathetic-leads rule are baked in.
 *
 * It generates BRIEFS, never images, and never fabricates a claim.
 */

/** The six IDEA Decision Triggers → image direction (Skill 10 — Design Brief Generator). */
export const TRIGGER_IMAGE_DIRECTION: Record<string, string> = {
  permission:
    'Hero communicates expertise/authority at a glance — credentials, certification, clinical/precision cues visible without reading text.',
  recognition:
    "Mirror the customer's emotional reality before the product benefit — the struggle, the moment before, or the relief. This is where the empathetic line LEADS.",
  identity:
    'Signal cultural belonging and aspiration — the product in the context of who the customer wants to be (community / lifestyle / status).',
  belonging:
    'Show community and brand purpose — people, mission, story; the product as an expression of shared values.',
  momentum:
    'Lead with social-proof scale — customers served, review volume, repeat-purchase rate; make the scale visible immediately.',
  fear_of_loss:
    'Communicate the cost of inaction — before/after, the consequence of delay; frame waiting as the loss.',
};

export type SlotEngine = 'photoreal' | 'infographic';

export interface ImageSlot {
  slot: number;
  key: string;
  label: string;
  /** What this slot's job is in the Amazon set. */
  purpose: string;
  /** Which IDEA pillar / Trust-Gap element it primarily closes. */
  ideaPillar: 'Insight-Driven' | 'Distinctive' | 'Empathetic' | 'Authentic';
  /** photoreal = product photography (real shoot / photoreal AI gen / Genrupt — NOT Canva
   *  layout-gen); infographic = text/badge/graphic layout (Canva is the right tool here). */
  engine: SlotEngine;
  /** Per-slot composition + emotional-register direction (what it must communicate, not how). */
  direction: string;
  /** Amazon convention guardrails specific to this slot. */
  amazonRules: string;
}

/**
 * The canonical Amazon listing image-set architecture (Trevor's Genrupt 6-slot strategy,
 * reconciled with Amazon's image policy). Slot 1 is the MAIN image and is deliberately
 * constrained; the IDEA work (triggers, badges, lifestyle, comparison, trust) lives in the
 * gallery slots where Amazon permits text and graphics.
 */
export const LISTING_IMAGE_SLOTS: readonly ImageSlot[] = [
  {
    slot: 1,
    key: 'main',
    label: 'Main image (hero)',
    purpose: 'Earn the click against the competitive field in the search grid.',
    ideaPillar: 'Distinctive',
    engine: 'photoreal',
    direction:
      'Professional product photography of the actual product, filling ~85% of the frame, clean and premium. The Decision Trigger shows through styling/angle/finish ONLY — never through added text. This is the one slot that must look like a real retail product shot.',
    amazonRules:
      'AMAZON MAIN-IMAGE POLICY (hard): pure white background (RGB 255,255,255); product is the only subject; NO text, logos, badges, watermarks, borders, props, or inset graphics; ≥85% frame; 2000×2000px+ for zoom; RGB JPEG/PNG/TIFF. A badge or dark/gradient background here is a policy violation — put those in the gallery.',
  },
  {
    slot: 2,
    key: 'lifestyle',
    label: 'Lifestyle / the moment',
    purpose: 'Connect emotionally — the felt experience, product in real context/use.',
    ideaPillar: 'Empathetic',
    engine: 'photoreal',
    direction:
      "The empathetic core LEADS here (Trevor: say 'I see you' before the science). Show the product in the customer's real world / the transformation / the moment of relief. A short empathetic overlay line is allowed and should be the hero message of the set.",
    amazonRules:
      'Gallery slot: lifestyle photography, real context, dramatic/ambient lighting allowed. Minimal text overlay OK. Keep it photoreal (shoot / photoreal AI gen / Genrupt — not a Canva layout).',
  },
  {
    slot: 3,
    key: 'benefits',
    label: 'Benefits (benefit-first)',
    purpose: "The top 2-3 outcomes the customer actually wants (the Avatar's desired end-state).",
    ideaPillar: 'Insight-Driven',
    engine: 'infographic',
    direction:
      'Lead with the benefit (the outcome), not the feature. Pull the desired outcomes straight from the Avatar 2.0 portrait + review evidence. Each benefit gets a clear icon + a short, concrete line.',
    amazonRules:
      'Gallery infographic: product + benefit callouts. Canva/graphic layout is the right tool here. Benefit language must trace to real evidence, never invented.',
  },
  {
    slot: 4,
    key: 'features',
    label: 'Features / how it works',
    purpose: 'The rational proof and the mechanism — answer "what exactly am I getting / how does it work".',
    ideaPillar: 'Insight-Driven',
    engine: 'infographic',
    direction:
      'Specs, materials, dimensions, the system/steps. This is the Deliberate (rational) layer doing its job. Every number/claim here must be exact.',
    amazonRules:
      'Gallery infographic. CLAIM/SIZE ACCURACY IS CRITICAL — Genrupt distorted claims and relative product sizing here. Preserve the user-confirmed facts verbatim; do not invent or round.',
  },
  {
    slot: 5,
    key: 'comparison',
    label: 'Comparison / why this one',
    purpose: 'The distinctive, ownable angle vs the alternatives the buyer is weighing.',
    ideaPillar: 'Distinctive',
    engine: 'infographic',
    direction:
      'The ownable creative leap (the "battle-ready" kind of distinctive line — true to a real insight, surprising, testable), framed as why-this-over-the-field. A comparison table or a clear us-vs-them contrast.',
    amazonRules:
      'Gallery infographic/contextual. If it compares to named competitors, keep claims defensible. The distinctive line is a hypothesis to TEST, not a stated fact.',
  },
  {
    slot: 6,
    key: 'trust',
    label: 'Trust / credentials',
    purpose: 'Close the Authentic gap — guarantee, certifications, real reviews, founder/brand.',
    ideaPillar: 'Authentic',
    engine: 'infographic',
    direction:
      'Make legitimacy felt, not generic. Real specifics (actual guarantee terms, real review pulls, genuine credentials) beat stock "dermatologist recommended"-style wallpaper. Tie to the brand\'s authentic voice.',
    amazonRules:
      'Gallery infographic. Any guarantee/claim runs through the claim gate (confirm with the user before including). No stock-photo authority cosplay.',
  },
];

/**
 * A+ (brand-story) content brief. Adapted from the `desktop-premium-aplus-creator` skill
 * (evidence-led premium A+ craft): treat A+ as ONE continuous long-form editorial image,
 * not a stack of template modules. For brand-registered sellers; richer sibling of the
 * gallery slots.
 */
export const APLUS_DESKTOP = {
  format:
    'Desktop A+ = ONE continuous long-form editorial composition (target 1472x3008), connected top-to-bottom by product-derived devices (light, shadow, reflection, architectural lines) — NOT stacked banners, card grids, or template modules.',
  structure:
    'Produce 4 distinct concepts (each a materially different creative idea / composition / atmosphere / motif), 2 versions each. Each concept is ~4-5 connected narrative beats: product intro -> strongest benefit -> product clarity/detail -> use case -> emotional close. Product stays the visual hero.',
  territories:
    'Derive territory from the product (e.g. cinematic architectural story, monochrome museum editorial, human-centred carry/use journey, seasonal/occasion story) — do not apply blindly.',
} as const;

/** The 8-part order for a ready-to-generate production prompt (creative-framework). */
export const IMAGE_PROMPT_CONSTRUCTION: readonly string[] = [
  'Prefix every generation prompt with the exact marker "IMAGE_PROMPT:".',
  '1) Output + accuracy: one image at the target size; the uploaded product photo is the STRICT visual reference; list the product invariants that must not change.',
  '2) Art direction: working title, the distinctive world/composition, the top-to-bottom visual path, and how transitions stay continuous.',
  '3) Narrative beats: 4-5 connected moments (intro, strongest benefit, product clarity, use case, emotional close as fits).',
  '4) Exact on-image copy: quote every required line verbatim, short and readable; include exact dimensions/quantity/accessory-exclusions ONLY when verified.',
  '5) Design system: typography + hierarchy, palette, lighting, textures, mood, text placement + negative space.',
  '6) Conversion goals: name the doubts/questions this image must resolve and which use cases to show.',
  '7) Compliance: ban unsupported claims and unsafe scenes; mark visible accessories as styling props when applicable.',
  '8) Negative prompt: end with the exact negative paragraph plus product-specific avoid items (prohibited shape changes, false inclusions, unsafe use, invented features).',
];

/** The verbatim negative-prompt paragraph to append to every generation prompt. */
export const EXACT_NEGATIVE_PROMPT =
  'Negative prompt: avoid separate stacked banners, ribbon strips, boxed modules, harsh horizontal dividers, cheap infographic panels, excessive icons, busy collage grids, cramped text, fake badge claims, discount graphics, star ratings, pricing, URL text, competitor comparisons, generic stock-photo poses, and anything that looks like standard Amazon template A+.';

/** Evidence triage — strengthens the claim-accuracy guardrail Trevor flagged on Genrupt. */
export const EVIDENCE_DISCIPLINE: readonly string[] = [
  'Separate every input into: VERIFIED FACTS (safe to state), STRATEGY SIGNALS (visual direction only, not a claim), and UNSUPPORTED (exclude from customer-facing copy).',
  'Do not convert a shopper question into a claim. Do not treat AI shopping-agent (e.g. Rufus) answers as independent proof — use them to find gaps, then ground claims in real product facts.',
  'Reject mismatched evidence: a review about another product, size, or variant is not proof for this product — state the exclusion briefly.',
  'Record only visible, defensible facts from the product image (shape, proportions, materials, included components). Never invent construction, accessories, finishes, certifications, performance, or compatibility.',
  'No prices, discounts, ratings, review counts, URLs, competitor names, fake awards, or guarantees in the image copy.',
];

/** Final QA bar before the brief is considered done (quality-control). */
export const QA_CHECKLIST: readonly string[] = [
  'Product shape, colour, components, and proportions stay recognizable; the product is the hero.',
  'Every customer-facing fact traces to supplied evidence; no shopper-agent speculation stated as fact.',
  'Each image reads as one composition (no stacked banners/cards/modules); concepts differ materially.',
  'Text is concise, legible, and not over critical product detail; styling props are not shown as included.',
  'Verify ACTUAL pixel dimensions; if the generator did not hit the target, report it honestly — never claim a size that was not produced, and do not resize/crop without the user asking.',
];

export interface ListingImageBriefInput {
  /** The product / listing the image set is for (name + a sentence, or an ASIN). */
  product: string;
  /** One of the six Decision Triggers (lowercased), if already identified. Optional. */
  decisionTrigger?: string;
  /** A short summary of the Avatar 2.0 emotional core, if the coach has it. Optional. */
  avatarSummary?: string;
  /** The Trust Gap finding (weakest pillar + score), if known. Optional. */
  trustGapSummary?: string;
  /** Marketplace; defaults to amazon. */
  marketplace?: string;
  /** The funnel piece (brand_asset) this set is for, to wire the split-test. Optional. */
  brandAssetId?: string;
}

export interface ListingImageBriefResult {
  ok: true;
  marketplace: string;
  decision_trigger: string | null;
  trigger_image_direction: string | null;
  slots: readonly ImageSlot[];
  /** Which engine each slot should be produced with — the routing the coach kept getting wrong. */
  execution_routing: Record<string, string>;
  /** Hard rules the composed brief must honour. */
  rules: string[];
  /** The claim gate the coach must apply before including any guarantee/claim. */
  claim_gate: string;
  /** What the composed brief must never contain (Tier-C + framework jargon). */
  never_contain: string[];
  /** A+ (brand-story) content brief — long-form editorial, for brand-registered sellers. */
  aplus_content: typeof APLUS_DESKTOP;
  /** How to construct a ready-to-generate production prompt + the exact negative prompt. */
  prompt_construction: { steps: readonly string[]; exact_negative_prompt: string };
  /** Evidence triage — what may be stated vs only used for visual direction vs excluded. */
  evidence_discipline: readonly string[];
  /** The final QA bar applied to every produced image. */
  qa_checklist: readonly string[];
  /** Step-by-step instructions for the coach to compose + save the brief. */
  instructions: string[];
  summary: string;
}

/** Build the listing-image-set brief framework, tailored to any provided IDEA context. */
export function buildListingImageBrief(input: ListingImageBriefInput): ListingImageBriefResult {
  const marketplace = (input.marketplace ?? 'amazon').toLowerCase();
  const trigger = input.decisionTrigger?.toLowerCase().replace(/[\s-]/g, '_') ?? null;
  const triggerDirection = trigger ? TRIGGER_IMAGE_DIRECTION[trigger] ?? null : null;

  return {
    ok: true,
    marketplace,
    decision_trigger: trigger,
    trigger_image_direction: triggerDirection,
    slots: LISTING_IMAGE_SLOTS,
    execution_routing: {
      photoreal:
        'Slots marked engine=photoreal (main, lifestyle) are PRODUCT PHOTOGRAPHY. Route them to: real product photography, a photoreal AI image generator (Midjourney / DALL-E / Google Imagen) with photography-grade prompts, or Genrupt (Trevor\'s evaluated workflow). Do NOT use Canva generate-design for these — it produces document/layout graphics, not photoreal product shots (this is the loop to avoid).',
      infographic:
        'Slots marked engine=infographic (benefits, features, comparison, trust) are graphic layouts with text/badges. Canva is the right tool here — give it the per-slot copy + structure. Assemble these from the user\'s real assets where possible.',
      provide_prompts:
        'For each photoreal slot, output a ready-to-paste image-generation PROMPT (subject = the actual product, the slot\'s emotional register, lighting, background per the Amazon rules, 2000×2000, photorealistic, no text on the main). For each infographic slot, output the copy + layout direction.',
    },
    rules: [
      'MAIN image = pure white background, product only, NO added text/badges/graphics (Amazon policy). All IDEA/trigger/badge/lifestyle work goes in the GALLERY slots.',
      'The EMPATHETIC line leads the lifestyle/hero slot — acknowledge the customer\'s felt experience before any spec or claim (the gap Trevor found in the Genrupt set).',
      'Preserve every user-confirmed fact verbatim — claims, concentrations, dimensions, relative sizing. Genrupt distorted claims and bottle sizing; the brief must pin them.',
      'Each slot states what it must COMMUNICATE and the emotional register, not the composition/colour/font (that is the designer\'s/generator\'s job) — unless a visual is directly tied to the trigger.',
      'A designer or generator who has never heard of IDEA must be able to execute the brief with no further conversation.',
    ],
    claim_gate:
      'Before including any guarantee or specific claim (e.g. "lifetime warranty", a clinical percentage), flag it to the user and ask them to confirm they offer/can substantiate it. Only include it once confirmed.',
    never_contain: [
      'Framework terminology: IDEA, Trust Gap, Decision Trigger, buyer state, CAPTURE.',
      'Buyer-state names: Assessor, Protector, Expresser, Connector.',
      'Academic/engine internals: neuroanatomy, System 1/2, S1-S4, confidence scores.',
      'Options for the designer to choose between — give one direction per slot.',
    ],
    aplus_content: APLUS_DESKTOP,
    prompt_construction: { steps: IMAGE_PROMPT_CONSTRUCTION, exact_negative_prompt: EXACT_NEGATIVE_PROMPT },
    evidence_discipline: EVIDENCE_DISCIPLINE,
    qa_checklist: QA_CHECKLIST,
    instructions: [
      `1) Triage the inputs for "${input.product}" using evidence_discipline (verified facts vs strategy signals vs unsupported). Record only defensible product facts; reject mismatched evidence.`,
      `2) Ground the set in the user's IDEA context: the Decision Trigger${trigger ? ` (${trigger})` : ' (identify it first via identify_decision_trigger if unknown)'}, the Avatar 2.0 emotional core${input.avatarSummary ? '' : ' (pull from get_avatar / the avatar build)'}, and the Trust Gap pillar to close${input.trustGapSummary ? '' : ' (from run_trust_gap)'}.`,
      '3) For EACH slot above, compose a Skill-10 brief: (A) one-line context for the recipient, (B) image/shot direction + emotional register + the trust signal, (C) copy/overlay direction (gallery slots only), (D) where it goes. Lead the lifestyle slot with the empathetic line.',
      '4) For every photoreal slot, write a ready-to-generate prompt using prompt_construction (the "IMAGE_PROMPT:" marker + the 8-part order + the exact negative prompt). Route photoreal to photography / Midjourney / DALL-E / Genrupt, NOT Canva layout-gen; infographic slots get copy + layout for Canva.',
      '5) If the seller is Brand-Registered and wants A+, also produce the aplus_content brief: 4 distinct long-form editorial concepts (continuous, not stacked modules) at the target size.',
      '6) Run the claim gate on any guarantee/claim, then the qa_checklist on the result. Keep all confirmed facts exact; verify actual output dimensions honestly.',
      '7) Save the brief with log_asset (content_type "amazon"), and open the split-test with design_test (hypothesis = this set lifts CTR on the main + CVR on the gallery for this piece). Stamp asset_created → asset_live via update_test_milestone as the real images are produced and go live, then re-measure.',
    ],
    summary: `Amazon ${marketplace} listing image-set brief: ${LISTING_IMAGE_SLOTS.length} slots (main is white-bg product photography with no added text; gallery carries the IDEA work) + optional A+ long-form editorial. ${trigger ? `Tuned to the ${trigger} trigger. ` : ''}Triage evidence, compose per-slot briefs grounded in the Avatar + Trust Gap + Decision Trigger, write IMAGE_PROMPT production prompts (with the exact negative prompt) routed to a real image engine (not Canva layout-gen), preserve all claims, QA, and wire the split-test.`,
  };
}
