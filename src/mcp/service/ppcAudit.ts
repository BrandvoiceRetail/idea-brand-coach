/**
 * Layer 1 (service) — the PPC audit engine (pure, deterministic; no LLM touches a number).
 *
 * Both an OPTIMIZER and a Trust-Gap ON-RAMP. Grounded in AdLabs' published RPC "white-box"
 * bidding method (methods/formulas only, paraphrased + attributed): suggested bid = RPC × target
 * ACOS, where RPC (revenue per click) = ad sales ÷ clicks; changes are read off actual
 * performance, not bid status. Derivations (acos/roas/cpc/cvr) match getFunnelPieceMetrics
 * byte-for-byte (calculation parity): computed ONLY when both inputs are finite and the divisor
 * is non-zero — omitted, never fabricated or divided by zero.
 *
 * The ON-RAMP is the strategically important half: a funnel piece pulling real clicks but
 * converting poorly is NOT a bid problem — the ads work, the listing doesn't — so the audit
 * routes it to run_trust_gap + the creative fix instead of recommending a bid change.
 *
 * PURE: takes already-read data in, returns the audit out (the tool does the DB I/O). Fully
 * unit-testable with no Supabase/identity.
 */

export const DEFAULT_TARGET_ACOS = 0.3;

/** Deterministic thresholds (tunable via input.thresholds). Click-based so they are currency-agnostic. */
export interface PpcThresholds {
  /** Min clicks before a piece is classified (below → insufficient_data). */
  minClicksForJudgement: number;
  /** cvr below this WITH real clicks ⇒ a listing/conversion problem, not a bid problem. */
  conversionCvrFloor: number;
  /** A search term with ≥ this many clicks and ZERO orders ⇒ negate candidate. */
  negateMinClicks: number;
  /** A search term with ≥ this many orders and acos ≤ target ⇒ harvest candidate. */
  harvestMinOrders: number;
}

export const DEFAULT_THRESHOLDS: PpcThresholds = {
  minClicksForJudgement: 15,
  conversionCvrFloor: 0.08,
  negateMinClicks: 10,
  harvestMinOrders: 2,
};

export interface PpcPieceInput {
  brandAssetId: string;
  label?: string;
  spend?: number;
  adSales?: number; // ad-attributed revenue
  clicks?: number;
  orders?: number;
  totalSales?: number; // total organic+paid sales (for TACoS)
}

export interface PpcSearchTermInput {
  searchTerm: string;
  matchType?: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  orders?: number;
  sales?: number;
}

export interface PpcAuditInput {
  /** Target ACOS as a FRACTION 0–1 (e.g. 0.3). Defaults to DEFAULT_TARGET_ACOS. */
  targetAcos?: number;
  pieces: PpcPieceInput[];
  searchTerms?: PpcSearchTermInput[];
  thresholds?: Partial<PpcThresholds>;
}

export type PieceClass = 'healthy' | 'bid_problem' | 'conversion_problem' | 'insufficient_data';

export interface PpcPieceResult {
  brand_asset_id: string;
  label?: string;
  spend?: number;
  ad_sales?: number;
  clicks?: number;
  orders?: number;
  acos?: number;
  roas?: number;
  cpc?: number;
  cvr?: number;
  rpc?: number;
  tacos?: number;
  classification: PieceClass;
  /** RPC-method suggested bid (rpc × targetAcos), present only when rpc is known. */
  suggested_bid?: number;
  recommendation: string;
  /** True when this piece is a conversion problem → route to run_trust_gap. */
  route_to_trust_gap: boolean;
}

export interface HarvestCandidate {
  search_term: string;
  match_type?: string;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  acos?: number;
  suggested_bid?: number;
}

export interface NegateCandidate {
  search_term: string;
  match_type?: string;
  clicks: number;
  spend: number;
}

export interface PpcAuditResult {
  ok: true;
  target_acos: number;
  overall: {
    spend: number;
    ad_sales: number;
    acos?: number;
    roas?: number;
    cpc?: number;
    tacos?: number;
    total_sales?: number;
  };
  pieces: PpcPieceResult[];
  harvest: HarvestCandidate[];
  negate: NegateCandidate[];
  wasted_spend: number;
  bid_method: string;
  structure_flags: string[];
  /** Conversion-problem routing lines — the Trust-Gap on-ramp. */
  on_ramp: string[];
  method_note: string;
  /** What extra data would sharpen the audit (e.g. total_sales for TACoS). */
  needs_input: string[];
  summary: string;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Parity helper: numer/denom only when both finite and denom !== 0 (never fabricate / div-by-zero). */
function ratio(numer: unknown, denom: unknown): number | undefined {
  if (isFiniteNumber(numer) && isFiniteNumber(denom) && denom !== 0) return numer / denom;
  return undefined;
}

const sum = (xs: Array<number | undefined>): number => xs.reduce<number>((a, x) => a + (isFiniteNumber(x) ? x : 0), 0);

const BID_METHOD =
  'RPC white-box bidding (AdLabs method): suggested bid = RPC × target ACOS, where RPC (revenue per click) = ad sales ÷ clicks. Apply changes off your ACTUAL current CPC, not the current bid — always calculate from real performance.';
const METHOD_NOTE =
  'PPC framework adapted from AdLabs\' publicly published Amazon PPC methodology (RPC bidding, ACOS/TACoS split, search-term harvest/negate) — methods and formulas only, in our own words.';

function classifyPiece(
  clicks: number | undefined,
  cvr: number | undefined,
  acos: number | undefined,
  targetAcos: number,
  t: PpcThresholds,
): PieceClass {
  if (!isFiniteNumber(clicks) || clicks < t.minClicksForJudgement) return 'insufficient_data';
  // Real traffic converting poorly = the listing, not the bid (the on-ramp).
  if (isFiniteNumber(cvr) && cvr < t.conversionCvrFloor) return 'conversion_problem';
  // Converts acceptably but ACOS over target = paying too much per click (a bid problem).
  if (isFiniteNumber(acos) && acos > targetAcos) return 'bid_problem';
  return 'healthy';
}

function pieceRecommendation(cls: PieceClass, r: { cvr?: number; suggested_bid?: number; acos?: number }): string {
  switch (cls) {
    case 'conversion_problem':
      return `Your ads are working (they're pulling clicks) but the listing isn't converting them${
        isFiniteNumber(r.cvr) ? ` (${(r.cvr * 100).toFixed(1)}% CVR)` : ''
      }. This is a listing/Trust-Gap problem, not a bid problem — run the Trust Gap on this piece and fix the listing before spending more.`;
    case 'bid_problem':
      return `It converts, but you're overpaying per click (ACOS ${
        isFiniteNumber(r.acos) ? `${(r.acos * 100).toFixed(0)}%` : 'over target'
      }). Lower the bid toward${
        isFiniteNumber(r.suggested_bid) ? ` ~${r.suggested_bid.toFixed(2)}` : ' the RPC × target-ACOS figure'
      }, applied off your current CPC.`;
    case 'healthy':
      return 'On target — hold the bid and reallocate freed budget to pieces with headroom.';
    default:
      return 'Not enough clicks yet to judge — give it more traffic (or a higher bid) before optimising.';
  }
}

/** Build the deterministic PPC audit from already-read ad performance + search-term data. */
export function buildPpcAudit(input: PpcAuditInput): PpcAuditResult {
  const targetAcos = isFiniteNumber(input.targetAcos) && input.targetAcos > 0 ? input.targetAcos : DEFAULT_TARGET_ACOS;
  const t: PpcThresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const needs_input: string[] = [];

  const pieces: PpcPieceResult[] = input.pieces.map((p) => {
    const acos = ratio(p.spend, p.adSales);
    const roas = ratio(p.adSales, p.spend);
    const cpc = ratio(p.spend, p.clicks);
    const cvr = ratio(p.orders, p.clicks);
    const rpc = ratio(p.adSales, p.clicks);
    const tacos = ratio(p.spend, p.totalSales);
    const suggested_bid = isFiniteNumber(rpc) ? rpc * targetAcos : undefined;
    const classification = classifyPiece(p.clicks, cvr, acos, targetAcos, t);
    return {
      brand_asset_id: p.brandAssetId,
      label: p.label,
      spend: p.spend,
      ad_sales: p.adSales,
      clicks: p.clicks,
      orders: p.orders,
      acos,
      roas,
      cpc,
      cvr,
      rpc,
      tacos,
      classification,
      suggested_bid,
      recommendation: pieceRecommendation(classification, { cvr, suggested_bid, acos }),
      route_to_trust_gap: classification === 'conversion_problem',
    };
  });

  // Overall rollup
  const totalSpend = sum(input.pieces.map((p) => p.spend));
  const totalAdSales = sum(input.pieces.map((p) => p.adSales));
  const totalClicks = sum(input.pieces.map((p) => p.clicks));
  const totalSalesVals = input.pieces.map((p) => p.totalSales).filter(isFiniteNumber);
  const totalSales = totalSalesVals.length ? sum(totalSalesVals) : undefined;
  if (totalSales === undefined) needs_input.push('total_sales (organic + paid) per piece — needed to compute TACoS.');

  // Search-term harvest / negate
  const terms = input.searchTerms ?? [];
  const harvest: HarvestCandidate[] = [];
  const negate: NegateCandidate[] = [];
  let wasted_spend = 0;
  for (const s of terms) {
    const clicks = isFiniteNumber(s.clicks) ? s.clicks : 0;
    const orders = isFiniteNumber(s.orders) ? s.orders : 0;
    const spend = isFiniteNumber(s.spend) ? s.spend : 0;
    const sales = isFiniteNumber(s.sales) ? s.sales : 0;
    const termAcos = ratio(spend, sales);
    if (orders >= t.harvestMinOrders && (termAcos === undefined || termAcos <= targetAcos)) {
      const rpc = ratio(sales, clicks);
      harvest.push({
        search_term: s.searchTerm,
        match_type: s.matchType,
        clicks,
        orders,
        spend,
        sales,
        acos: termAcos,
        suggested_bid: isFiniteNumber(rpc) ? rpc * targetAcos : undefined,
      });
    } else if (orders === 0 && clicks >= t.negateMinClicks) {
      negate.push({ search_term: s.searchTerm, match_type: s.matchType, clicks, spend });
      wasted_spend += spend;
    }
  }
  if (terms.length === 0) needs_input.push('Amazon Ads search-term rows (ingest_search_terms) — needed for harvest/negate + per-keyword ACOS.');

  // Structure flags (AdLabs concepts, paraphrased)
  const structure_flags: string[] = [];
  const conversionPieces = pieces.filter((p) => p.classification === 'conversion_problem');
  if (conversionPieces.length) {
    structure_flags.push(
      `${conversionPieces.length} piece(s) are converting poorly on good traffic — cap or pause their spend until the listing is fixed; new spend on a broken listing just buys more non-converters.`,
    );
  }
  if (negate.length) {
    structure_flags.push(
      `${negate.length} search term(s) spent with zero orders — negate them (add as negative exact/phrase) to stop the leak.`,
    );
  }
  if (harvest.length) {
    structure_flags.push(
      `${harvest.length} converting search term(s) — harvest them into dedicated exact-match campaigns/ad groups so you can bid them precisely.`,
    );
  }
  structure_flags.push(
    'Separate brand vs non-brand terms into their own campaigns (different ACOS goals); split any campaign whose products have divergent budgets, placements, or bid-goals.',
  );

  const on_ramp = pieces
    .filter((p) => p.route_to_trust_gap)
    .map((p) => `${p.label ?? p.brand_asset_id}: ${p.recommendation}`);

  const overall = {
    spend: totalSpend,
    ad_sales: totalAdSales,
    acos: ratio(totalSpend, totalAdSales),
    roas: ratio(totalAdSales, totalSpend),
    cpc: ratio(totalSpend, totalClicks),
    tacos: ratio(totalSpend, totalSales),
    total_sales: totalSales,
  };

  const judged = pieces.filter((p) => p.classification !== 'insufficient_data').length;
  const summaryBits: string[] = [
    `PPC audit over ${pieces.length} funnel piece(s) at ${(targetAcos * 100).toFixed(0)}% target ACOS`,
    isFiniteNumber(overall.acos) ? `overall ACOS ${(overall.acos * 100).toFixed(0)}%` : 'overall ACOS n/a',
    isFiniteNumber(overall.tacos) ? `TACoS ${(overall.tacos * 100).toFixed(0)}%` : null,
    `${on_ramp.length} listing/conversion problem(s) to route to the Trust Gap`,
    `${harvest.length} to harvest, ${negate.length} to negate`,
    wasted_spend > 0 ? `~${wasted_spend.toFixed(2)} wasted on zero-order terms` : null,
    judged === 0 ? 'insufficient click volume to judge any piece yet' : null,
  ].filter((x): x is string => Boolean(x));

  return {
    ok: true,
    target_acos: targetAcos,
    overall,
    pieces,
    harvest,
    negate,
    wasted_spend,
    bid_method: BID_METHOD,
    structure_flags,
    on_ramp,
    method_note: METHOD_NOTE,
    needs_input,
    summary: summaryBits.join('; ') + '.',
  };
}
