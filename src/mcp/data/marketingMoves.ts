/**
 * Phase 5 Agent A — the marketing-move library (manifest slot #17, class FRAMEWORK).
 *
 * This is the versioned, SYSTEM-SIDE reusable library that powers gold Workbook B
 * ("InfinityVault Marketing Investment Audit.xlsx", sheet "Investment Matrix").
 * It is NOT per-user data; the per-user `marketing-audit` generator (Phase 5 Agent B)
 * calibrates this library against the user's resolved BUSINESS-FACT slots (revenue,
 * margins, ad metrics, channel/asset states, inventory risks) and renders the matrix
 * contract (`investmentRowSchema` in ../contracts/marketingAudit.ts).
 *
 * ── Benefit ranges are FUNCTIONS of monthly revenue ────────────────────────────
 * The gold workbook's 1/3/6/12-month benefit bands ("+$200–500", "+$900–1,800", …)
 * were hand-calibrated to InfinityVault's ~$10K/mo revenue. We reverse-engineer each
 * numeric band as a *percentage of monthly revenue*: `pct = gold_dollars / 10000`.
 * Evaluating a move's benefit model at `revenue = CALIBRATION_BASELINE_REVENUE`
 * therefore reproduces the gold dollar band exactly (the unit test asserts ±15%).
 * At any other revenue the band scales linearly — the calibration the gold header
 * promises ("calibrated to your business size … adjust if revenue is materially
 * different than assumed").
 *
 * Cells the gold rendered qualitatively ("Negligible", "Velocity bump as reviews
 * land", "Saves ~$168 + recovers margin") are NOT revenue-scalable, so those
 * horizons carry a `qualitative` band that emits the gold text verbatim — the engine
 * never fabricates a dollar figure where the gold itself declined to give one.
 *
 * All cost/effort/time metadata and the tier legend + estimate caveats are
 * transcribed VERBATIM from the gold fixture (src/mcp/__tests__/fixtures/workbook-b.json).
 */

/** Library schema version. Bump when moves or their calibration models change. */
export const MARKETING_MOVE_LIBRARY_VERSION = '2026-06-06.1' as const;

/**
 * The monthly revenue (USD) the gold Workbook B benefit ranges were calibrated to.
 * Every numeric benefit `pct` satisfies `pct * CALIBRATION_BASELINE_REVENUE === goldDollars`.
 */
export const CALIBRATION_BASELINE_REVENUE = 10_000 as const;

/** Investment tier — mirrors `investmentTierSchema` in the marketing-audit contract. */
export type InvestmentTier = 'T1' | 'T2' | 'T3';

/** Level of effort, verbatim from the gold "Level of effort" column. */
export type EffortLevel =
  | 'Trivial'
  | 'Very low'
  | 'Low'
  | 'Low (just consistent)'
  | 'Low (DIY) / Med (designer)'
  | 'Med'
  | 'High';

/**
 * Brand-asset / channel / catalog states a move may depend on. Reverse-engineered
 * from each move's description; the calibration generator checks these against the
 * resolved BUSINESS-FACT slots (#7 asset states, #10 channel states) to decide
 * applicability and tier adjustment.
 */
export type MovePrerequisite =
  | 'brand_registry' //  Brand Registry enrollment (free A+, Posts, Vine, Brand Referral Bonus)
  | 'video_asset' //     a produced product video (required by Sponsored Brands Video)
  | 'email_list' //      an owned email list / Klaviyo account
  | 'storefront' //      an Amazon storefront
  | 'core_ppc_at_target' // core Sponsored Products at target ACoS (gate for off-Amazon SD)
  | 'proven_ad_structure'; // a proven ad structure on the SKU (gate for Lightning Deal)

/**
 * Applicability conditions — business situations that make a move relevant or
 * irrelevant. Reverse-engineered from the gold descriptions/notes. The calibration
 * generator surfaces a move only when its conditions hold (e.g. an `ltsf_inventory`
 * move is dropped if the user reports no long-term-storage-risk SKUs).
 */
export type ApplicabilityCondition =
  | 'has_listings' //         seller has active Amazon listings
  | 'ltsf_inventory_risk' //  seller has SKUs at long-term-storage-fee / slow-mover risk
  | 'running_ppc' //          seller is currently running Amazon PPC
  | 'wants_offamazon_growth' // seller wants to build off-Amazon / owned channels
  | 'tcg_or_hobby_niche' //   product is in a TCG / hobby / collectible niche
  | 'has_external_traffic'; // seller can drive external traffic (influencer/social)

/**
 * Cash-cost model. The gold "Cash cost" column mixes one-time fees, monthly spend,
 * per-ASIN fees, reallocations, and margin sacrifices — so we keep the verbatim gold
 * string as the source of truth and tag a coarse `kind` the calibrator can branch on.
 */
export interface CashCostModel {
  /**
   * - `free`        — $0 / near-$0 (DIY, free Amazon programs).
   * - `one_time`    — a one-off fee (designer, video, deal fee).
   * - `per_asin`    — a fee charged per enrolled ASIN (Vine).
   * - `monthly`     — recurring monthly spend (ad budget, SaaS).
   * - `reallocation`— no incremental cash; shifts an existing budget.
   * - `margin_cost` — paid in margin per unit rather than cash (S&S/coupon, deals).
   */
  readonly kind: 'free' | 'one_time' | 'per_asin' | 'monthly' | 'reallocation' | 'margin_cost';
  /** Verbatim gold "Cash cost" cell — rendered as-is into the matrix. */
  readonly verbatim: string;
}

/**
 * A single benefit-band horizon. Numeric bands are revenue-scaled; qualitative bands
 * emit the gold text verbatim (the gold declined to give a dollar figure there).
 */
export type BenefitBand =
  | {
      readonly kind: 'numeric';
      /** Low end of the band as a fraction of monthly revenue (gold_low / 10000). */
      readonly pct_low: number;
      /** High end of the band as a fraction of monthly revenue (gold_high / 10000). */
      readonly pct_high: number;
      /** Optional suffix the gold appended (e.g. " cum.", " net", " margin", " (in production)"). */
      readonly suffix?: string;
    }
  | {
      readonly kind: 'qualitative';
      /** Verbatim gold cell (e.g. "Velocity bump as reviews land", "Negligible"). */
      readonly label: string;
    };

/** The four gold benefit horizons. */
export interface BenefitModel {
  readonly mo1: BenefitBand;
  readonly mo3: BenefitBand;
  readonly mo6: BenefitBand;
  readonly mo12: BenefitBand;
}

/** One reusable marketing move. */
export interface MarketingMove {
  /** Stable slug id (kebab-case). Stable across versions for traceability. */
  readonly id: string;
  /** "Investment" — the move name, verbatim. */
  readonly name: string;
  /** Default tier in the gold calibration; the generator may re-tier per business size. */
  readonly tier_default: InvestmentTier;
  /** "What it is" — the move description, verbatim. */
  readonly what_it_is: string;
  /** "Calendar time", verbatim. */
  readonly calendar_time: string;
  /** "Person-hours", verbatim. */
  readonly person_hours: string;
  /** "Level of effort", verbatim. */
  readonly effort: EffortLevel;
  /** Cash-cost model (verbatim string + coarse kind). */
  readonly cash_cost_model: CashCostModel;
  /** Revenue-scaled benefit model across the four horizons. */
  readonly benefit_model: BenefitModel;
  /** Asset/channel/catalog states this move requires before it can run. */
  readonly prerequisites: readonly MovePrerequisite[];
  /** Business situations that make this move relevant. */
  readonly applicability_conditions: readonly ApplicabilityCondition[];
}

/** Convenience: numeric band (revenue-scaled). */
function num(pctLow: number, pctHigh: number, suffix?: string): BenefitBand {
  return suffix === undefined
    ? { kind: 'numeric', pct_low: pctLow, pct_high: pctHigh }
    : { kind: 'numeric', pct_low: pctLow, pct_high: pctHigh, suffix };
}
/** Convenience: qualitative band (verbatim gold text). */
function qual(label: string): BenefitBand {
  return { kind: 'qualitative', label };
}

/**
 * The 19 reusable marketing moves, transcribed from gold fixture B's Investment
 * Matrix. Numeric `pct_*` values are `gold_dollars / CALIBRATION_BASELINE_REVENUE`,
 * so `evaluateBenefitBand(band, 10000)` reproduces the gold band. `as const` freezes
 * the library and gives consumers a literal source of truth.
 */
export const MARKETING_MOVE_LIBRARY = [
  // ── Tier 1 — do first (free/near-free, immediate ROI) ──────────────────────
  {
    id: 'aplus-content-overhaul',
    name: 'A+ Content overhaul (all 3 listings)',
    tier_default: 'T1',
    what_it_is:
      'Rebuild Enhanced Brand Content with comparison module, lifestyle imagery, FAQ. Free with Brand Registry.',
    calendar_time: '1–2 weeks',
    person_hours: '8–12 hrs',
    effort: 'Low (DIY) / Med (designer)',
    cash_cost_model: { kind: 'one_time', verbatim: '$0 DIY  /  $150–400 designer' },
    benefit_model: {
      mo1: num(0.02, 0.05),
      mo3: num(0.09, 0.18),
      mo6: num(0.2, 0.42),
      mo12: num(0.45, 0.9),
    },
    prerequisites: ['brand_registry'],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'listing-copy-seo-refresh',
    name: 'Listing copy + backend SEO refresh',
    tier_default: 'T1',
    what_it_is:
      'Rewrite titles, bullets, description for the 216 Diamond Grain, 288 single, 288 2-pack. Saturate backend keywords (Pokemon, sports cards, MTG, etc.).',
    calendar_time: '3–5 days',
    person_hours: '4–6 hrs',
    effort: 'Low',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: num(0.015, 0.04),
      mo3: num(0.06, 0.14),
      mo6: num(0.14, 0.32),
      mo12: num(0.3, 0.7),
    },
    prerequisites: [],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'restructure-ppc',
    name: 'Restructure PPC per the campaign plan',
    tier_default: 'T1',
    what_it_is:
      'Implement the agreed plan: shift Vintage 216 to near-zero bids, push Diamond Grain, hit 14%/12% ACoS targets on 288 + 2-pack. Already scoped.',
    calendar_time: '1 week to implement, ongoing',
    person_hours: '3 hrs setup + 1 hr/wk monitor',
    effort: 'Low',
    cash_cost_model: { kind: 'monthly', verbatim: '$450/mo (replaces existing ~$618)' },
    benefit_model: {
      // Gold mo1 is a savings statement, not a revenue band → qualitative verbatim.
      mo1: qual('Saves ~$168 + recovers margin'),
      mo3: num(0.06, 0.09, ' cum.'),
      mo6: num(0.15, 0.22, ' cum.'),
      mo12: num(0.35, 0.5, ' cum.'),
    },
    prerequisites: [],
    applicability_conditions: ['running_ppc'],
  },
  {
    id: 'amazon-posts',
    name: 'Amazon Posts (free brand content feed)',
    tier_default: 'T1',
    what_it_is:
      "Auto-shows in competitor listings. Post 2–3x/week. Pure brand exposure on Amazon's owned surface.",
    calendar_time: 'Ongoing',
    person_hours: '30 min/week',
    effort: 'Very low',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: qual('Negligible direct'),
      mo3: num(0.005, 0.015),
      mo6: num(0.02, 0.05),
      mo12: num(0.05, 0.12),
    },
    prerequisites: ['brand_registry'],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'brand-story-storefront',
    name: 'Brand Story module + Storefront cleanup',
    tier_default: 'T1',
    what_it_is:
      'Vertical scroll story above A+ content. Storefront with cross-sell between SL200, 216s, 288s.',
    calendar_time: '1 week',
    person_hours: '4–6 hrs',
    effort: 'Low',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: num(0.008, 0.02),
      mo3: num(0.03, 0.07),
      mo6: num(0.07, 0.16),
      mo12: num(0.16, 0.35),
    },
    prerequisites: ['brand_registry', 'storefront'],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'diy-photography-upgrade',
    name: 'DIY photography upgrade',
    tier_default: 'T1',
    what_it_is:
      'Reshoot hero + lifestyle on white background with cards inside binder. Phone camera + softbox works.',
    calendar_time: '1 weekend',
    person_hours: '6–10 hrs',
    effort: 'Med',
    cash_cost_model: { kind: 'one_time', verbatim: '$0–80 (lights/backdrop)' },
    benefit_model: {
      mo1: num(0.015, 0.04),
      mo3: num(0.06, 0.14),
      mo6: num(0.14, 0.32),
      mo12: num(0.3, 0.7),
    },
    prerequisites: [],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'brand-referral-bonus',
    name: 'Enroll Brand Referral Bonus program',
    tier_default: 'T1',
    what_it_is:
      'Free Amazon program — earn ~10% back on sales from external traffic you drive. Pre-req for influencer/TikTok plays.',
    calendar_time: '30 min',
    person_hours: '0.5 hr',
    effort: 'Trivial',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: qual('$0 (no traffic yet)'),
      mo3: num(0.003, 0.012),
      mo6: num(0.015, 0.04),
      mo12: num(0.04, 0.12),
    },
    prerequisites: ['brand_registry'],
    applicability_conditions: ['has_listings'],
  },
  // ── Tier 2 — queue after inventory order / once cash frees ─────────────────
  {
    id: 'amazon-vine-288-single',
    name: 'Amazon Vine for 288 single (long-term storage risk)',
    tier_default: 'T2',
    what_it_is:
      'Pay to enroll, get 5–30 verified reviews from Vine voices. Critical for the 288 single 1-packs at LTSF risk.',
    calendar_time: '1 day enroll, 2–6 wks reviews',
    person_hours: '1–2 hrs',
    effort: 'Low',
    cash_cost_model: { kind: 'per_asin', verbatim: '$200 per ASIN (~$400 for both)' },
    benefit_model: {
      mo1: qual('Velocity bump as reviews land'),
      mo3: num(0.03, 0.09),
      mo6: num(0.09, 0.24),
      mo12: num(0.2, 0.55),
    },
    prerequisites: ['brand_registry'],
    applicability_conditions: ['ltsf_inventory_risk', 'has_listings'],
  },
  {
    id: 'professional-product-video',
    name: 'Professional product video (one shared video)',
    tier_default: 'T2',
    what_it_is:
      '60–90 sec listing video. Pour cards in, zip it, flip through. Use on all 3 listings + Sponsored Brands video.',
    calendar_time: '2–3 weeks',
    person_hours: '5 hrs your time + freelancer',
    effort: 'Med',
    cash_cost_model: { kind: 'one_time', verbatim: '$300–700 one-time (Fiverr/Upwork)' },
    benefit_model: {
      mo1: num(0.01, 0.03, ' (in production)'),
      mo3: num(0.07, 0.18),
      mo6: num(0.18, 0.42),
      mo12: num(0.4, 0.95),
    },
    prerequisites: [],
    applicability_conditions: ['has_listings'],
  },
  {
    id: 'sponsored-brands-video-sd-retargeting',
    name: 'Sponsored Brands Video + Sponsored Display retargeting',
    tier_default: 'T2',
    what_it_is:
      'New ad types layered onto existing $450 budget. SB Video typically 30–50% lower ACoS than SP for branded queries.',
    calendar_time: '1 week to set up',
    person_hours: '2 hrs setup + monitor',
    effort: 'Low',
    cash_cost_model: { kind: 'reallocation', verbatim: '$0 incremental (reallocate from SP)' },
    benefit_model: {
      mo1: num(0.008, 0.025, ' margin'),
      mo3: num(0.04, 0.1),
      mo6: num(0.1, 0.24),
      mo12: num(0.25, 0.55),
    },
    prerequisites: ['brand_registry', 'video_asset'],
    applicability_conditions: ['running_ppc', 'has_listings'],
  },
  {
    id: 'influencer-seeding-tcg',
    name: 'Influencer seeding (TCG creators on YouTube/TikTok)',
    tier_default: 'T2',
    what_it_is:
      'Send free binders to 10–20 small/mid TCG creators in exchange for honest review/mention. No paid post fee.',
    calendar_time: 'Ongoing, 2-mo ramp',
    person_hours: '3 hrs outreach + 1 hr/wk',
    effort: 'Med',
    cash_cost_model: {
      kind: 'one_time',
      verbatim: '$150–300 (product cost + shipping for 10–15 sends)',
    },
    benefit_model: {
      mo1: qual('Mostly negligible mo 1'),
      mo3: num(0.02, 0.08, ' (lumpy)'),
      mo6: num(0.07, 0.25),
      mo12: num(0.2, 0.7),
    },
    // Gold flags Brand Referral Bonus as a soft pre-req for influencer plays; that
    // lives on the brand-referral-bonus row, so the structured pre-req here is just
    // Brand Registry (needed to enroll Brand Referral Bonus in the first place).
    prerequisites: ['brand_registry'],
    applicability_conditions: ['tcg_or_hobby_niche', 'has_external_traffic'],
  },
  {
    id: 'subscribe-save-coupon-288',
    name: 'Subscribe & Save + coupon stack on 288 single',
    tier_default: 'T2',
    what_it_is: 'Drive sell-through on LTSF-risk inventory. 5% S&S + 5% clippable coupon.',
    calendar_time: '1 day',
    person_hours: '1 hr',
    effort: 'Low',
    cash_cost_model: { kind: 'margin_cost', verbatim: '~10% margin per unit on enrolled' },
    benefit_model: {
      mo1: qual('Velocity +20–40%'),
      mo3: num(0.02, 0.05, ' (clears LTSF risk)'),
      mo6: num(0.05, 0.12),
      mo12: num(0.1, 0.25),
    },
    prerequisites: [],
    applicability_conditions: ['ltsf_inventory_risk', 'has_listings'],
  },
  // ── Tier 3 — defer until base is profitable ────────────────────────────────
  {
    id: 'tiktok-shop-launch',
    name: 'TikTok Shop launch (TCG niche is hot there)',
    tier_default: 'T3',
    what_it_is:
      'List the 3 SKUs on TikTok Shop. Free to join. Pair with organic short-form content (unboxings, before/after pulls).',
    calendar_time: '2 weeks setup, 3-mo ramp',
    person_hours: '6 hrs setup + 3 hrs/wk content',
    effort: 'High',
    cash_cost_model: { kind: 'free', verbatim: '$0 platform / opportunity cost of time' },
    benefit_model: {
      mo1: qual('$0'),
      mo3: num(0.02, 0.08),
      mo6: num(0.08, 0.35),
      mo12: num(0.25, 1.0),
    },
    prerequisites: [],
    applicability_conditions: ['tcg_or_hobby_niche', 'wants_offamazon_growth'],
  },
  {
    id: 'pinterest-organic',
    name: 'Pinterest organic (collector-friendly platform)',
    tier_default: 'T3',
    what_it_is:
      'Pinterest drives long-tail traffic for hobby/collectible niches. 20 pins/week tied to Storefront URL.',
    calendar_time: 'Ongoing',
    person_hours: '2 hrs/wk',
    effort: 'Med',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: qual('Negligible'),
      mo3: num(0.005, 0.02),
      mo6: num(0.02, 0.07),
      mo12: num(0.06, 0.2),
    },
    prerequisites: ['storefront'],
    applicability_conditions: ['tcg_or_hobby_niche', 'wants_offamazon_growth'],
  },
  {
    id: 'email-list-klaviyo',
    name: 'Email list / Klaviyo (off-Amazon brand asset)',
    tier_default: 'T3',
    what_it_is:
      'Insert card in package with QR to sign up for binder care tips + early access. Builds an asset you own.',
    calendar_time: '2 weeks setup, ongoing list build',
    person_hours: '5 hrs setup + 1 hr/wk',
    effort: 'Med',
    cash_cost_model: { kind: 'monthly', verbatim: '$0 free tier → $30–60/mo at 500+ subs' },
    benefit_model: {
      mo1: qual('$0'),
      mo3: num(0.0, 0.01),
      mo6: num(0.015, 0.05),
      mo12: num(0.05, 0.2),
    },
    prerequisites: [],
    applicability_conditions: ['wants_offamazon_growth'],
  },
  {
    id: 'reddit-tcg-forums',
    name: 'Reddit + TCG forum community presence',
    tier_default: 'T3',
    what_it_is:
      'Genuine presence (not spam) in r/PokemonTCG, r/mtgfinance, r/sportscards. Answer questions, mention products when on-topic.',
    calendar_time: 'Ongoing',
    person_hours: '1–2 hrs/wk',
    effort: 'Low (just consistent)',
    cash_cost_model: { kind: 'free', verbatim: '$0' },
    benefit_model: {
      mo1: num(0.005, 0.015),
      mo3: num(0.02, 0.05),
      mo6: num(0.05, 0.15),
      mo12: num(0.12, 0.4),
    },
    prerequisites: [],
    applicability_conditions: ['tcg_or_hobby_niche', 'wants_offamazon_growth'],
  },
  {
    id: 'sponsored-display-offamazon',
    name: 'Sponsored Display audience targeting (off-Amazon)',
    tier_default: 'T3',
    what_it_is:
      'Retarget shoppers across the web who viewed competing binders. Only run once core PPC is at target ACoS.',
    calendar_time: '1 week',
    person_hours: '2 hrs',
    effort: 'Med',
    cash_cost_model: { kind: 'monthly', verbatim: '$100–200/mo trial' },
    benefit_model: {
      // Gold mo1 is a labeled test loss (negative band) → keep verbatim.
      mo1: qual('−$100 (test loss likely)'),
      mo3: num(0.01, 0.04, ' net'),
      mo6: num(0.05, 0.15),
      mo12: num(0.12, 0.4),
    },
    prerequisites: ['core_ppc_at_target'],
    applicability_conditions: ['running_ppc'],
  },
  {
    id: 'lightning-deal-216',
    name: 'Lightning Deal / 7-Day Deal on a 216 SKU',
    tier_default: 'T3',
    what_it_is:
      'Margin sacrifice for ranking boost. Only run after Diamond Grain ad structure proves out.',
    calendar_time: '1 day setup, 7 days run',
    person_hours: '2 hrs',
    effort: 'Low',
    cash_cost_model: { kind: 'margin_cost', verbatim: '$150–300 deal fee + 15–30% off margin' },
    benefit_model: {
      mo1: qual('Big velocity spike'),
      mo3: num(0.03, 0.08, ' (lift carries)'),
      mo6: num(0.07, 0.18),
      mo12: num(0.15, 0.35),
    },
    prerequisites: ['proven_ad_structure'],
    applicability_conditions: ['has_listings', 'running_ppc'],
  },
  {
    id: 'shopify-d2c',
    name: 'Shopify D2C storefront',
    tier_default: 'T3',
    what_it_is:
      'Direct sales channel. Long payoff — only worth it once Amazon house is in order and brand has email list.',
    calendar_time: '1 month setup',
    person_hours: '20+ hrs',
    effort: 'High',
    cash_cost_model: { kind: 'monthly', verbatim: '$30/mo + ~$300 theme/setup' },
    benefit_model: {
      mo1: qual('$0'),
      mo3: num(0.0, 0.02),
      mo6: num(0.02, 0.08),
      mo12: num(0.08, 0.35),
    },
    prerequisites: ['email_list'],
    applicability_conditions: ['wants_offamazon_growth'],
  },
] as const satisfies readonly MarketingMove[];

/** Literal union of every move id in the library. */
export type MarketingMoveId = (typeof MARKETING_MOVE_LIBRARY)[number]['id'];

/** O(1) lookup by id. */
const MOVES_BY_ID: ReadonlyMap<string, MarketingMove> = new Map(
  MARKETING_MOVE_LIBRARY.map((m) => [m.id, m]),
);

/** Look up a move by id; throws on an unknown id (the library is the source of truth). */
export function getMarketingMove(id: MarketingMoveId): MarketingMove {
  const move = MOVES_BY_ID.get(id);
  if (!move) {
    throw new Error(`Unknown marketing move id: ${id}`);
  }
  return move;
}

// ───────────────────────────────────────────────────────────────────────────
// Benefit evaluation — turns a revenue-scaled band into a gold-style dollar band.
// ───────────────────────────────────────────────────────────────────────────

/** US-style integer with thousands separators (gold renders "+$4,500–9,000"). */
function formatDollars(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * Render one benefit band at a given monthly revenue into the gold cell string.
 *
 * - Qualitative bands return their verbatim label unchanged.
 * - Numeric bands scale `pct_* * revenue` and format as a gold-style band:
 *   - both ends 0      → "$0"
 *   - negative single  → "−$N"  (e.g. the SD test-loss row)
 *   - low === high     → "+$N"
 *   - otherwise        → "+$LOW–HIGH"
 *   with any gold suffix appended.
 *
 * At `revenue = CALIBRATION_BASELINE_REVENUE` this reproduces the gold fixture band.
 */
export function evaluateBenefitBand(band: BenefitBand, monthlyRevenue: number): string {
  if (band.kind === 'qualitative') {
    return band.label;
  }
  const low = band.pct_low * monthlyRevenue;
  const high = band.pct_high * monthlyRevenue;
  const suffix = band.suffix ?? '';

  if (low === 0 && high === 0) {
    return `$0${suffix}`;
  }
  if (low < 0 && high < 0) {
    // Negative band (rare; labeled test loss). Render the magnitude with a minus sign.
    const lowMag = formatDollars(Math.abs(low));
    const highMag = formatDollars(Math.abs(high));
    return low === high ? `−$${lowMag}${suffix}` : `−$${highMag}–${lowMag}${suffix}`;
  }
  if (low === high) {
    return `+$${formatDollars(low)}${suffix}`;
  }
  return `+$${formatDollars(low)}–${formatDollars(high)}${suffix}`;
}

/** A move's four benefit horizons rendered at a given revenue. */
export interface EvaluatedBenefits {
  readonly benefit_1mo: string;
  readonly benefit_3mo: string;
  readonly benefit_6mo: string;
  readonly benefit_12mo: string;
}

/** Render a whole move's benefit model at a given monthly revenue. */
export function evaluateMoveBenefits(move: MarketingMove, monthlyRevenue: number): EvaluatedBenefits {
  return {
    benefit_1mo: evaluateBenefitBand(move.benefit_model.mo1, monthlyRevenue),
    benefit_3mo: evaluateBenefitBand(move.benefit_model.mo3, monthlyRevenue),
    benefit_6mo: evaluateBenefitBand(move.benefit_model.mo6, monthlyRevenue),
    benefit_12mo: evaluateBenefitBand(move.benefit_model.mo12, monthlyRevenue),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Verbatim legend + caveats (gold fixture B — rendered into the workbook footer).
// ───────────────────────────────────────────────────────────────────────────

/** "Tier legend:" — verbatim from gold fixture B. */
export const TIER_LEGEND: Readonly<Record<InvestmentTier, string>> = {
  T1: "Do first — free/near-free, immediate ROI, no cash strain. Most of these are leverage moves you can't NOT do.",
  T2: 'Queue for after May inventory order + once Uncapped plan is signed. Small cash, real lift.',
  T3: 'Defer until base is profitable. Higher effort, slower payoff, or requires upstream foundation (email, brand registry assets, etc.).',
} as const;

/** "Notes on benefit estimates:" — verbatim from gold fixture B. */
export const BENEFIT_ESTIMATE_CAVEATS = [
  '• Benefits are revenue lift estimates, not profit. Apply your ~10% post-ad margin target to estimate profit impact.',
  '• Ranges reflect uncertainty — pick the low end if conservative, midpoint for planning.',
  '• Benefits are NOT additive across all rows — they overlap (e.g., A+ content + photography both lift conversion on the same listing).',
  '• 12-month figures assume the work is maintained, not one-and-done.',
  '• Estimates are calibrated to your business size from prior conversations — adjust if revenue is materially different than assumed.',
] as const;

/** "Caveats:" — verbatim from gold fixture B's Recommended Phasing sheet. */
export const ROLLOUT_CAVEATS = [
  '• Estimates assume disciplined execution + maintenance. Skipping any one Tier 1 item materially lowers the range.',
  '• Numbers reflect REVENUE lift, not profit. Apply your post-ad margin target (~10%) to get profit impact.',
  "• Doesn't account for inventory replenishment cash needs — coordinate with cash flow plan.",
  '• Diamond Grain 216 (high stock) is the leverage SKU — most of the lift will flow through it.',
  '• If Vintage 216 stays out of AWD, the price-anchor strategy weakens and Tier 1 estimates compress.',
] as const;
