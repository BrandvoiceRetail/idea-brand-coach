/**
 * Layer 3 (service) — DETERMINISTIC marketing-audit calibration (gold Workbook B).
 *
 * This is the numbers engine for `run_marketing_audit`. It takes the system-side
 * marketing-move library (manifest slot #17, FRAMEWORK) + the user's resolved
 * BUSINESS-FACT slots and produces, with NO LLM:
 *
 *   1. The Investment-Matrix rows (`InvestmentRow[]` per the `marketing_audit`
 *      contract): per-move tier (re-tiered when prerequisites/cash gate it), cost/
 *      hours/effort (library verbatim), and the 1/3/6/12-mo benefit ranges rendered
 *      from the library's revenue-scaled bands at the user's monthly revenue.
 *   2. The 90-day rollout (`RolloutPlanOutput` per the `rollout_plan` contract):
 *      four phases sequenced around the user's cash timeline (inventory order +
 *      repayment start), plus the cumulative-impact estimate grid.
 *
 * The numbers are the source of truth. The `marketing-audit` edge fn is used ONLY to
 * enrich PROSE fields (per-move what-it-is contextualization, per-phase why-now) given
 * these computed numbers — numbers in, numbers out unchanged. `runMarketingAudit`
 * verifies post-parse that the model altered no number; if it did, the deterministic
 * value wins.
 *
 * Fabrication discipline (manifest §6): every benefit cell is a LABELED estimate band
 * (or the gold's own qualitative cell, verbatim). Where a horizon scales with revenue
 * the band is `pct * revenue`; where the gold declined to give a dollar figure the
 * library carries a verbatim qualitative cell and we emit it unchanged. No exact point
 * figure is ever fabricated.
 */
import {
  MARKETING_MOVE_LIBRARY,
  MARKETING_MOVE_LIBRARY_VERSION,
  CALIBRATION_BASELINE_REVENUE,
  evaluateMoveBenefits,
  type MarketingMove,
  type MovePrerequisite,
  type ApplicabilityCondition,
  type InvestmentTier,
} from '../data/marketingMoves.js';
import type { InvestmentRow } from '../contracts/marketingAudit.js';
import type { RolloutPhase, CumulativeImpactRow } from '../contracts/rolloutPlan.js';

// ───────────────────────────────────────────────────────────────────────────
// BUSINESS-FACT input shapes — parsed tolerantly from resolved slot values.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The resolved BUSINESS-FACT bundle the calibrator consumes. Each field maps to a
 * manifest slot; the values come from `business_facts.structured_data` (so they may
 * be loosely typed) and are normalised by `parseBusinessFacts`.
 */
export interface CalibrationFacts {
  /** Slot #8 — monthly revenue (USD). REQUIRED: every benefit band is a fn of this. */
  monthlyRevenue: number;
  /** Slot #8 — post-ad margin target as a fraction (e.g. 0.10). Used for the profit caveat. */
  marginTarget: number | null;
  /** Slot #8 — current monthly ad spend (USD). */
  adSpend: number | null;
  /** Slot #8 — target ad spend after PPC restructure (USD). */
  adSpendTarget: number | null;
  /** Slot #7 — brand-asset states → which prerequisites are satisfied. */
  assets: AssetStates;
  /** Slot #10 — channel states → which prerequisites/applicability hold. */
  channels: ChannelStates;
  /** Slot #11 — true when the user reports LTSF / slow-mover inventory risk. */
  inventoryRisk: boolean;
  /** Slot #9 — cash constraints/timing → the rollout phasing windows. */
  cashTiming: CashTiming;
  /** Slot #16 — competitor set present (used only as an applicability hint, optional). */
  hasCompetitorSet: boolean;
  /** Derived: the business is currently running PPC (adSpend > 0). */
  runningPpc: boolean;
}

/** Slot #7 — brand-asset states. Each flag, when true, satisfies a move prerequisite. */
export interface AssetStates {
  brandRegistry: boolean;
  aplusContent: boolean;
  storefront: boolean;
  professionalPhotography: boolean;
  productVideo: boolean;
  provenAdStructure: boolean;
  corePpcAtTarget: boolean;
}

/** Slot #10 — channel states. */
export interface ChannelStates {
  emailList: boolean;
  /** The seller wants to build off-Amazon / owned channels. */
  wantsOffAmazonGrowth: boolean;
  /** The seller can drive external traffic (influencer / social). */
  hasExternalTraffic: boolean;
  /** The product is in a TCG / hobby / collectible niche. */
  tcgOrHobbyNiche: boolean;
  /** The seller has active Amazon listings. */
  hasListings: boolean;
}

/** Slot #9 — cash constraints & timing, rendered into the rollout windows. */
export interface CashTiming {
  /** Free-text label for the inventory-order window (e.g. "May inventory order priority"). */
  inventoryOrderNote: string | null;
  /** Free-text label for the repayment window (e.g. "~$1K/mo Uncapped repayment starting June"). */
  repaymentNote: string | null;
  /** Whether cash is tight (front-loads free moves; gates paid moves to later phases). */
  tightCash: boolean;
}

/**
 * A single missing-or-stale required slot, surfaced as a calibration gap. The tool turns
 * each into a `needs_input` item; the calibrator never invents a value for a gap.
 */
export interface CalibrationGap {
  slot: number;
  reason: 'missing' | 'unparseable';
  field: string;
}

/** The outcome of an attempt to assemble calibration facts from resolved slots. */
export type FactsResult =
  | { ok: true; facts: CalibrationFacts }
  | { ok: false; gaps: CalibrationGap[] };

/** A resolved slot, as the context resolver returns it (value + status). */
export interface ResolvedFactSlot {
  slot: number;
  value: unknown;
  status: string;
}

/** Statuses that count as a usable BUSINESS-FACT fill (owner-stated / evidence-backed). */
const USABLE_STATUSES: ReadonlySet<string> = new Set(['filled-evidence', 'filled-stated']);

// ───────────────────────────────────────────────────────────────────────────
// Tolerant value coercion (business_facts.structured_data is loosely typed).
// ───────────────────────────────────────────────────────────────────────────

/** Coerce a value into a finite number, parsing "$10,000" / "10k" style strings. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase().replace(/[$,\s]/g, '');
    const kMatch = cleaned.match(/^([0-9]*\.?[0-9]+)k$/);
    if (kMatch) return parseFloat(kMatch[1]) * 1000;
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Coerce a value into a boolean (true / "yes" / "true" / 1 → true). */
function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === 'y' || v === '1' || v === 'enrolled' || v === 'active';
  }
  return false;
}

/** Read a key from a record case-insensitively, trying several aliases. */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) lowerMap.set(k.toLowerCase(), v);
  for (const key of keys) {
    const hit = lowerMap.get(key.toLowerCase());
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Coerce a slot value into a record (object), or {} when it is not object-shaped. */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/** A margin target may be a fraction (0.10) or a percent (10) — normalise to a fraction. */
function normaliseMargin(value: unknown): number | null {
  const n = toNumber(value);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

// ───────────────────────────────────────────────────────────────────────────
// Parse resolved slots → CalibrationFacts (or surface gaps; never invent).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Assemble `CalibrationFacts` from the resolved BUSINESS-FACT slots. Revenue (#8) is the
 * only HARD requirement — without it every benefit band is uncalibrated, so we return a
 * gap rather than guess. Every other field defaults to a conservative, audit-safe value
 * (asset/channel flags false, no inventory risk, cash not tight) so the audit can still
 * run with whatever the user has confirmed; the missing flags simply gate the paid moves.
 */
export function parseBusinessFacts(slots: ResolvedFactSlot[]): FactsResult {
  const byId = new Map<number, ResolvedFactSlot>();
  for (const s of slots) byId.set(s.slot, s);

  const usable = (id: number): unknown => {
    const s = byId.get(id);
    if (!s || !USABLE_STATUSES.has(s.status) || s.value == null) return undefined;
    return s.value;
  };

  const gaps: CalibrationGap[] = [];

  // Slot #8 — revenue/margins/ad metrics (REQUIRED for calibration).
  const metrics = usable(8);
  if (metrics === undefined) {
    gaps.push({ slot: 8, reason: 'missing', field: 'monthly revenue + margin/ad metrics' });
  }
  const metricsRec = asRecord(metrics);
  const monthlyRevenue = toNumber(
    pick(metricsRec, ['monthlyRevenue', 'monthly_revenue', 'revenue']) ?? (typeof metrics === 'number' || typeof metrics === 'string' ? metrics : undefined),
  );
  if (metrics !== undefined && monthlyRevenue == null) {
    gaps.push({ slot: 8, reason: 'unparseable', field: 'monthly revenue' });
  }

  // If revenue is unavailable we cannot calibrate — surface the gap and stop.
  if (monthlyRevenue == null || monthlyRevenue <= 0) {
    return { ok: false, gaps: gaps.length > 0 ? gaps : [{ slot: 8, reason: 'missing', field: 'monthly revenue' }] };
  }

  const marginTarget = normaliseMargin(pick(metricsRec, ['marginTarget', 'margin_target', 'postAdMargin', 'margin']));
  const adSpend = toNumber(pick(metricsRec, ['adSpend', 'ad_spend', 'currentAdSpend']));
  const adSpendTarget = toNumber(pick(metricsRec, ['adSpendTarget', 'ad_spend_target', 'targetAdSpend']));

  // Slot #7 — brand-asset states (default false).
  const assetsRec = asRecord(usable(7));
  const assets: AssetStates = {
    brandRegistry: toBool(pick(assetsRec, ['brandRegistry', 'brand_registry', 'registry'])),
    aplusContent: toBool(pick(assetsRec, ['aplusContent', 'aplus', 'a_plus', 'aPlusContent'])),
    storefront: toBool(pick(assetsRec, ['storefront', 'store_front'])),
    professionalPhotography: toBool(pick(assetsRec, ['professionalPhotography', 'photography', 'pro_photography'])),
    productVideo: toBool(pick(assetsRec, ['productVideo', 'video', 'product_video'])),
    provenAdStructure: toBool(pick(assetsRec, ['provenAdStructure', 'proven_ad_structure'])),
    corePpcAtTarget: toBool(pick(assetsRec, ['corePpcAtTarget', 'core_ppc_at_target', 'ppcAtTarget'])),
  };

  // Slot #10 — channel states (default false; hasListings defaults TRUE — an Amazon seller).
  const channelsRec = asRecord(usable(10));
  const hasListingsRaw = pick(channelsRec, ['hasListings', 'has_listings', 'listings']);
  const channels: ChannelStates = {
    emailList: toBool(pick(channelsRec, ['emailList', 'email_list', 'email'])),
    wantsOffAmazonGrowth: toBool(pick(channelsRec, ['wantsOffAmazonGrowth', 'offAmazonGrowth', 'wants_off_amazon_growth', 'd2c'])),
    hasExternalTraffic: toBool(pick(channelsRec, ['hasExternalTraffic', 'externalTraffic', 'has_external_traffic', 'social'])),
    tcgOrHobbyNiche: toBool(pick(channelsRec, ['tcgOrHobbyNiche', 'tcg', 'hobbyNiche', 'tcg_or_hobby_niche', 'niche'])),
    hasListings: hasListingsRaw === undefined ? true : toBool(hasListingsRaw),
  };

  // Slot #11 — inventory risk (LTSF SKUs). Boolean or an array/object that, if present
  // and non-empty, signals risk.
  const inventoryRaw = usable(11);
  const inventoryRisk =
    inventoryRaw === undefined
      ? false
      : typeof inventoryRaw === 'boolean'
        ? inventoryRaw
        : Array.isArray(inventoryRaw)
          ? inventoryRaw.length > 0
          : toBool(pick(asRecord(inventoryRaw), ['ltsf', 'ltsfRisk', 'inventoryRisk', 'risk', 'atRisk'])) ||
            (typeof inventoryRaw === 'string' && inventoryRaw.trim().length > 0 && !/^(no|none|false)$/i.test(inventoryRaw.trim()));

  // Slot #9 — cash constraints & timing.
  const cashRec = asRecord(usable(9));
  const cashRaw = usable(9);
  const cashTiming: CashTiming = {
    inventoryOrderNote: asString(pick(cashRec, ['inventoryOrderNote', 'inventoryOrder', 'inventory_order', 'inventory'])),
    repaymentNote: asString(pick(cashRec, ['repaymentNote', 'repayment', 'loanRepayment', 'loan'])),
    tightCash:
      cashRaw === undefined
        ? false
        : typeof cashRaw === 'string'
          ? /tight|thin|constrain|squeeze/i.test(cashRaw)
          : toBool(pick(cashRec, ['tightCash', 'tight_cash', 'tight'])) ||
            // A repayment obligation implies cash is being managed tightly.
            pick(cashRec, ['repaymentNote', 'repayment', 'loanRepayment', 'loan']) !== undefined,
  };

  // Slot #16 — competitor set present (applicability hint only).
  const hasCompetitorSet = usable(16) !== undefined;

  const runningPpc = adSpend != null ? adSpend > 0 : true;

  return {
    ok: true,
    facts: {
      monthlyRevenue,
      marginTarget,
      adSpend,
      adSpendTarget,
      assets,
      channels,
      inventoryRisk,
      cashTiming,
      hasCompetitorSet,
      runningPpc,
    },
  };
}

/** Coerce a value into a trimmed non-empty string, or null. */
function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Applicability + prerequisites + tiering (deterministic).
// ───────────────────────────────────────────────────────────────────────────

/** True when the user's facts satisfy a single move prerequisite (asset/channel state). */
function prerequisiteMet(prereq: MovePrerequisite, facts: CalibrationFacts): boolean {
  switch (prereq) {
    case 'brand_registry':
      return facts.assets.brandRegistry;
    case 'video_asset':
      return facts.assets.productVideo;
    case 'email_list':
      return facts.channels.emailList;
    case 'storefront':
      return facts.assets.storefront;
    case 'core_ppc_at_target':
      return facts.assets.corePpcAtTarget;
    case 'proven_ad_structure':
      return facts.assets.provenAdStructure;
    default:
      return false;
  }
}

/** True when the user's facts satisfy a single applicability condition. */
function conditionMet(condition: ApplicabilityCondition, facts: CalibrationFacts): boolean {
  switch (condition) {
    case 'has_listings':
      return facts.channels.hasListings;
    case 'ltsf_inventory_risk':
      return facts.inventoryRisk;
    case 'running_ppc':
      return facts.runningPpc;
    case 'wants_offamazon_growth':
      return facts.channels.wantsOffAmazonGrowth;
    case 'tcg_or_hobby_niche':
      return facts.channels.tcgOrHobbyNiche;
    case 'has_external_traffic':
      return facts.channels.hasExternalTraffic;
    default:
      return false;
  }
}

/**
 * A move is APPLICABLE when every applicability condition holds. Conditions express
 * relevance (e.g. an LTSF-risk move is irrelevant without LTSF inventory); a move whose
 * conditions fail is dropped from the matrix entirely (it would mislead, not just defer).
 */
function isApplicable(move: MarketingMove, facts: CalibrationFacts): boolean {
  return move.applicability_conditions.every((c) => conditionMet(c, facts));
}

/**
 * A move has a free / near-free / no-incremental-cash path when its cash model is free
 * or a reallocation, or its verbatim cell offers a $0/DIY/replaces option. Such a move is
 * never deferred for cash reasons (the gold keeps "$0 DIY / $150-400 designer" and
 * "$0–80" moves in T1 despite tight cash).
 */
function hasFreePath(move: MarketingMove): boolean {
  if (move.cash_cost_model.kind === 'free' || move.cash_cost_model.kind === 'reallocation') return true;
  return /\$0|DIY|replaces|reallocate|no incremental/i.test(move.cash_cost_model.verbatim);
}

/**
 * Re-tier a move for the user's situation. The gold DEFAULT tier is the calibrated tier
 * for a comparable business — it already encodes "deferred because it needs a video / an
 * email list / a proven ad structure" (those moves sit in T2/T3 by default). So we only
 * re-tier a move that the library would put in T1, and only when the user's facts make it
 * genuinely not-yet-doable:
 *   - An unmet FOUNDATION prerequisite (video, email list, proven ad structure, core PPC
 *     at target) on a T1 move pushes it to T2 (you cannot run it yet).
 *   - Tight cash on a T1 move that has NO free/near-free path pushes it to T2.
 * T2/T3 moves keep their gold tier (their deferral is already baked into the default), so
 * a comparable business reproduces the gold tiering exactly.
 */
export function tierFor(move: MarketingMove, facts: CalibrationFacts): InvestmentTier {
  if (move.tier_default !== 'T1') return move.tier_default;

  const unmetFoundation = move.prerequisites.some(
    (p) => !prerequisiteMet(p, facts) && p !== 'brand_registry',
  );
  if (unmetFoundation) return 'T2';

  if (facts.cashTiming.tightCash && !hasFreePath(move)) return 'T2';

  return 'T1';
}

// ───────────────────────────────────────────────────────────────────────────
// Investment-matrix rows (deterministic numbers; prose fields = library defaults).
// ───────────────────────────────────────────────────────────────────────────

/** Tier sort order so the matrix renders T1 → T2 → T3 like the gold. */
const TIER_RANK: Record<InvestmentTier, number> = { T1: 0, T2: 1, T3: 2 };

/** Investment rows + their index-aligned move ids (so the phaser can key the gold map). */
export interface InvestmentRowsResult {
  rows: InvestmentRow[];
  /** Move id for each row, index-aligned with `rows`. */
  moveIds: string[];
}

/**
 * Build the Investment-Matrix rows: every APPLICABLE move, re-tiered for the user's
 * facts, with benefit bands rendered at the user's monthly revenue. The `what_it_is`
 * carries the library description verbatim (the edge fn may CONTEXTUALISE the prose, but
 * never the numbers). Rows are sorted by tier then by gold library order. The parallel
 * `moveIds` array preserves each row's stable id for downstream phasing.
 */
export function buildInvestmentRows(facts: CalibrationFacts): InvestmentRowsResult {
  const built: Array<{ row: InvestmentRow; libOrder: number; moveId: string }> = [];
  MARKETING_MOVE_LIBRARY.forEach((move, libOrder) => {
    if (!isApplicable(move, facts)) return;
    const tier = tierFor(move, facts);
    const benefits = evaluateMoveBenefits(move, facts.monthlyRevenue);
    built.push({
      libOrder,
      moveId: move.id,
      row: {
        tier,
        investment: move.name,
        what_it_is: move.what_it_is,
        calendar_time: move.calendar_time,
        person_hours: move.person_hours,
        level_of_effort: move.effort,
        cash_cost: move.cash_cost_model.verbatim,
        benefit_1mo: benefits.benefit_1mo,
        benefit_3mo: benefits.benefit_3mo,
        benefit_6mo: benefits.benefit_6mo,
        benefit_12mo: benefits.benefit_12mo,
      },
    });
  });
  built.sort((a, b) => TIER_RANK[a.row.tier] - TIER_RANK[b.row.tier] || a.libOrder - b.libOrder);
  return { rows: built.map((r) => r.row), moveIds: built.map((r) => r.moveId) };
}

// ───────────────────────────────────────────────────────────────────────────
// 90-day rollout phasing (deterministic, sequenced around the cash timeline).
// ───────────────────────────────────────────────────────────────────────────

/** The four canonical rollout phases (gold "Recommended Phasing"). */
const PHASE_PLAN: ReadonlyArray<{
  phase: string;
  /** Window when the cash timeline is the IV gold case (tight cash, inventory + repayment). */
  windowTight: string;
  /** Window when cash is not constrained. */
  windowEasy: string;
  /** Tiers whose APPLICABLE moves seed this phase's action list. */
  tiers: InvestmentTier[];
  /** Phase index (1-based). */
  index: number;
}> = [
  { index: 1, phase: 'Phase 1\n(Weeks 1–2)', windowTight: 'Now → end of inventory-order window', windowEasy: 'Weeks 1–2', tiers: ['T1'] },
  { index: 2, phase: 'Phase 2\n(Weeks 3–6)', windowTight: 'After inventory order → first repayment', windowEasy: 'Weeks 3–6', tiers: ['T1', 'T2'] },
  { index: 3, phase: 'Phase 3\n(Weeks 7–12)', windowTight: 'Once Phase 1 savings + Phase 2 lifts compound', windowEasy: 'Weeks 7–12', tiers: ['T2'] },
  { index: 4, phase: 'Phase 4\n(Months 4–6)', windowTight: 'Once the Amazon base is genuinely in order', windowEasy: 'Months 4–6', tiers: ['T3'] },
];

/**
 * A free/near-free move (no INCREMENTAL cash) — used for the phase cash-needed roll-up.
 * A spend "replacement"/"reallocation" (e.g. the PPC restructure that replaces existing
 * ad spend) is not net-new cash, so it counts as free here (matching the gold's Phase-1
 * "Cash needed: $0–80", which excludes the PPC reallocation).
 */
function isFreeMove(row: InvestmentRow): boolean {
  return /\$0|free|replaces|reallocate|no incremental/i.test(row.cash_cost);
}

/**
 * Canonical rollout-phase assignment per move id (0-based phase index), transcribed from
 * gold fixture B's "Recommended Phasing" sheet. The gold phasing is curated FRAMEWORK
 * knowledge — it is not a pure function of tier/cost (e.g. the A+ overhaul is a free-path
 * T1 move that the gold deliberately sequences in Phase 2, behind the Phase-1 bleed-stop
 * moves). Keying by stable move id reproduces the gold sequencing exactly for a comparable
 * business; a move with no explicit assignment falls back to a tier-based default.
 */
const MOVE_PHASE_INDEX: Readonly<Record<string, number>> = {
  // Phase 1 — free bleed-stop / zero-dependency wins.
  'restructure-ppc': 0,
  'listing-copy-seo-refresh': 0,
  'brand-referral-bonus': 0,
  'diy-photography-upgrade': 0,
  // Phase 2 — build moves + first small paid (Vine), once inventory order clears.
  'aplus-content-overhaul': 1,
  'brand-story-storefront': 1,
  'amazon-vine-288-single': 1,
  'amazon-posts': 1,
  // Phase 3 — cash-freer paid plays that compound the base.
  'professional-product-video': 2,
  'sponsored-brands-video-sd-retargeting': 2,
  'influencer-seeding-tcg': 2,
  'subscribe-save-coupon-288': 2,
  // Phase 4 — new channels, only after the Amazon base is in order.
  'tiktok-shop-launch': 3,
  'email-list-klaviyo': 3,
  'sponsored-display-offamazon': 3,
  'pinterest-organic': 3,
  'reddit-tcg-forums': 3,
  'lightning-deal-216': 3,
  'shopify-d2c': 3,
};

/** Tier-based fallback phase for a move with no explicit gold assignment. */
function fallbackPhaseIndex(tier: InvestmentTier): number {
  if (tier === 'T1') return 1;
  if (tier === 'T2') return 2;
  return 3;
}

/**
 * Build the 90-day rollout phases from the (already-tiered) investment rows + their moves.
 * Each move is sequenced into its canonical gold phase (or a tier-based fallback), so a
 * comparable business reproduces the gold phasing. Each phase's action list is the bundle
 * of its assigned moves; cash_needed rolls up the cash signals. The `why_now` is a
 * deterministic cash-timing rationale the edge fn may rephrase (numbers unchanged).
 *
 * `rowMoveIds` is the per-row move id (index-aligned with `rows`), so the phaser can key
 * the gold assignment without re-deriving it from the row name.
 */
export function buildRolloutPhases(
  rows: InvestmentRow[],
  rowMoveIds: string[],
  facts: CalibrationFacts,
): RolloutPhase[] {
  const tight = facts.cashTiming.tightCash;
  const phaseRows: InvestmentRow[][] = [[], [], [], []];
  rows.forEach((row, i) => {
    const moveId = rowMoveIds[i];
    const phaseIdx = MOVE_PHASE_INDEX[moveId] ?? fallbackPhaseIndex(row.tier);
    phaseRows[phaseIdx].push(row);
  });

  return PHASE_PLAN.map((plan, i) => {
    const assigned = phaseRows[i];
    const action =
      assigned.length > 0
        ? assigned.map((r, n) => `${n + 1}) ${r.investment}`).join('\n')
        : 'Maintain and monitor the prior phase; no new moves scheduled.';
    return {
      phase: plan.phase,
      window: tight ? plan.windowTight : plan.windowEasy,
      action,
      cash_needed: phaseCashNeeded(assigned),
      why_now: phaseWhyNow(plan.index, facts),
    };
  });
}

/** Sum a phase's cash signals into a gold-style "Cash needed" cell. */
function phaseCashNeeded(rows: InvestmentRow[]): string {
  const paid = rows.filter((r) => !isFreeMove(r));
  if (paid.length === 0) return '$0';
  // Keep the verbatim per-move cash strings — never fabricate a precise total.
  return paid.map((r) => r.cash_cost).join('; ');
}

/** A deterministic cash-timing rationale per phase (the edge fn may rephrase, not renumber). */
function phaseWhyNow(index: number, facts: CalibrationFacts): string {
  const inv = facts.cashTiming.inventoryOrderNote;
  const repay = facts.cashTiming.repaymentNote;
  switch (index) {
    case 1:
      return `Free wins first. Stops the ad bleed and lifts conversion with no cash impact${
        inv ? ` during the ${inv}` : ''
      }.`;
    case 2:
      return `Small, high-leverage cash${
        repay ? `, timed alongside the ${repay}` : ''
      }. Vine reviews are essential to clear inventory-storage risk.`;
    case 3:
      return 'Cash should be freer once Phase 1 ad savings and Phase 2 listing lifts compound. Video unlocks the Sponsored Brands Video ad type.';
    case 4:
      return "Only after the Amazon base is genuinely in order. Don't open new channels while the primary one is still leaking.";
    default:
      return 'Sequenced around the cash-flow timeline.';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Cumulative-impact estimate grid (revenue-scaled, labeled low/mid/high bands).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Cumulative-impact band ratios, reverse-engineered from gold fixture B (calibrated to
 * $10K/mo): ratio = gold_dollars / CALIBRATION_BASELINE_REVENUE, so evaluating at the
 * baseline reproduces the gold grid (500/900/1500 … 11000/20000/35000). These are
 * cumulative revenue-lift estimates across the whole stack, NOT the sum of the per-move
 * bands (the gold caveat: "Benefits are NOT additive across all rows — they overlap").
 */
const CUMULATIVE_IMPACT: ReadonlyArray<{
  horizon: string;
  lowRatio: number;
  midRatio: number;
  highRatio: number;
  notes: string;
}> = [
  { horizon: 'Month 1', lowRatio: 0.05, midRatio: 0.09, highRatio: 0.15, notes: 'Mostly PPC restructure savings + listing copy lift' },
  { horizon: 'Month 3', lowRatio: 0.18, midRatio: 0.32, highRatio: 0.55, notes: 'A+ Content compounding + Vine reviews landing' },
  { horizon: 'Month 6', lowRatio: 0.45, midRatio: 0.8, highRatio: 1.4, notes: 'Video + influencer seeding contributing; cleared LTSF risk' },
  { horizon: 'Month 12', lowRatio: 1.1, midRatio: 2.0, highRatio: 3.5, notes: 'Full stack working; assumes consistent maintenance' },
];

/**
 * Build the cumulative-impact grid at the user's monthly revenue. At
 * `revenue = CALIBRATION_BASELINE_REVENUE` this reproduces the gold grid exactly.
 * Values are rounded to whole dollars (the contract requires non-negative integers).
 */
export function buildCumulativeImpact(facts: CalibrationFacts): CumulativeImpactRow[] {
  const r = facts.monthlyRevenue;
  return CUMULATIVE_IMPACT.map((c) => ({
    horizon: c.horizon,
    low: Math.round(c.lowRatio * r),
    mid: Math.round(c.midRatio * r),
    high: Math.round(c.highRatio * r),
    notes: c.notes,
  }));
}

// ───────────────────────────────────────────────────────────────────────────
// Top-level deterministic calibration.
// ───────────────────────────────────────────────────────────────────────────

/** The full deterministic calibration output (numbers the prose fn must not alter). */
export interface CalibrationResult {
  /** Investment-Matrix rows (the `marketing_audit` contract's `rows`). */
  rows: InvestmentRow[];
  /** 90-day rollout phases (the `rollout_plan` contract's `phases`). */
  phases: RolloutPhase[];
  /** Cumulative-impact grid (the `rollout_plan` contract's `cumulative_impact`). */
  cumulativeImpact: CumulativeImpactRow[];
  /** The facts the calibration was run against (echoed for the persisted `constraints`). */
  facts: CalibrationFacts;
  /** The library version the rows were rendered from. */
  libraryVersion: typeof MARKETING_MOVE_LIBRARY_VERSION;
}

/**
 * Run the full deterministic calibration: applicable+tiered rows, rollout phases, and
 * the cumulative-impact grid, all calibrated to the user's monthly revenue. No LLM, no
 * fabrication — every number traces to the library bands or the cumulative ratios.
 */
export function calibrate(facts: CalibrationFacts): CalibrationResult {
  const { rows, moveIds } = buildInvestmentRows(facts);
  const phases = buildRolloutPhases(rows, moveIds, facts);
  const cumulativeImpact = buildCumulativeImpact(facts);
  return { rows, phases, cumulativeImpact, facts, libraryVersion: MARKETING_MOVE_LIBRARY_VERSION };
}

/** Re-export the baseline revenue so the tool/tests can assert gold reproduction. */
export { CALIBRATION_BASELINE_REVENUE } from '../data/marketingMoves.js';
