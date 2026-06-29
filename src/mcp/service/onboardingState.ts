/**
 * Layer 1 (pure-ish logic) — onboarding state + playbook for `run_onboarding`.
 *
 * The coach calls `run_onboarding` when the user has NOT onboarded yet (no funnel
 * data) or asks to (re-)run onboarding, instead of the user pasting a prompt. This
 * module reads the caller's onboarding state (RLS-scoped) and returns the canonical,
 * ordered playbook the host then EXECUTES (the server cannot read Windsor itself —
 * the host pulls Windsor `get_data` and calls the ingest tools). One source of truth
 * for the onboarding workflow: the playbook lives here, not duplicated in a pasted
 * prompt or the always-on server instructions.
 */
import { getUserSupabase } from '../supabaseUser.js';

/** A snapshot of how far the caller has progressed through onboarding. */
export interface OnboardingState {
  /** Customer avatars the user has built. */
  avatarCount: number;
  /** Funnel pieces (brand_assets) — one per active touchpoint. */
  funnelPieceCount: number;
  /** Whether ANY analytics metrics have been ingested (campaign_metrics). */
  hasAnyMetrics: boolean;
}

export interface OnboardingResult {
  /** True once the user has at least one funnel piece AND some metrics stored. */
  already_onboarded: boolean;
  state: OnboardingState;
  /** What the coach should do next. */
  next: 'onboard' | 'refresh';
  /** The ordered steps the coach must execute now (host-side; pulls Windsor + ingests). */
  playbook: string;
  /** One-line human summary for the chat. */
  summary: string;
}

export class OnboardingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OnboardingError';
  }
}

/** Count rows in an RLS-scoped table; 0 on any read error (degrade, don't throw). */
async function countRows(table: string): Promise<number> {
  const supabase = getUserSupabase();
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (error) throw new OnboardingError(`failed to read ${table}: ${error.message}`, error);
  return count ?? 0;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const [avatarCount, funnelPieceCount, metricCount] = await Promise.all([
    countRows('avatars'),
    countRows('brand_assets'),
    countRows('campaign_metrics'),
  ]);
  return { avatarCount, funnelPieceCount, hasAnyMetrics: metricCount > 0 };
}

/** The full first-run onboarding workflow — the coach executes these in order. */
const FULL_PLAYBOOK = [
  'ONBOARD THIS BRAND — run these steps now, in order. Narrate each step in one plain line; never invent facts or numbers.',
  '1) BRAND CONTEXT: read what you already know about the user\'s products, customers, and reviews (this connector + your own knowledge). Fill gaps by asking ONE question at a time — never assume.',
  '2) FUNNEL PIECES: call list_funnel_inventory; for each active touchpoint that is missing (listing/PDP, ads, email, social, etc.) create it with upsert_funnel_touchpoint (one piece = one active brand asset, with its journey stage). Use the returned brand_asset_id.',
  '3) CONNECT + PULL PRIMITIVES (fast): check the user\'s Windsor connectors with get_connectors, then pull ONLY raw count/currency PRIMITIVES — never pre-computed rate columns. By source: amazon_sp (Seller Central, by child ASIN) → sessions, page_views, units_ordered, order_items, ordered_product_sales; amazon_ads → impressions, clicks, spend, orders, sales; ga4 → sessions, transactions, revenue; tiktok_shop → views, clicks, orders, revenue. Request the WHOLE window in ONE get_data call per source, at DAILY granularity, pulling all primitives at once: the date RANGE drives how long Amazon takes to assemble the report, not the field count. These ASIN-grain reports are ASYNC, so a timeout is PRIMING, not failure: a slow first call often times out WHILE Amazon finishes building and CACHES the report server-side, so RETRY THE SAME range (same window, same fields) and the retry usually returns the cached report instantly. Do NOT narrow the window or fall back to single-day calls on a first timeout: that abandons the report Amazon is already building and primes nothing. You may prime several DIFFERENT ranges or sources in one turn (each is an independent report), but firing the same call twice at once will not help, the catch needs the brief gap the next turn gives. Only narrow (30d, then 7d) if the same-range retry still fails after 2 to 3 tries; backfill older history later. Inherently-rate signals with no count primitive (return_rate, repeat_rate, new_to_brand) may be pulled as provided. For relevant registered-but-off sources, offer get_connector_authorization_url rather than leaving a piece "—".',
  '4) MAP + STORE PRIMITIVES: map each primitive to a piece + journey_stage + metric_name (impressions→impressions, clicks→clicks, spend→spend, sessions→sessions, page_views→views, units_ordered→units_sold, order_items→orders, ordered_product_sales/revenue→revenue; plus return_rate/repeat_rate/new_to_brand where provided as fractions 0–1). DO NOT pull or store ctr, cvr, aov, acos or roas — the app DERIVES every rate from the primitives over the window (ctr=clicks/impressions, cvr=units÷sessions [Amazon unit-session %], aov=revenue/orders): correct window aggregation and far faster to pull. Ensure a campaign (list_campaigns / create_campaign), then store via ingest_campaign_analytics / ingest_funnel_analytics with campaign_id + brand_asset_id + journey_stage + source="windsor". Where a primitive truly isn\'t available, mark "—" — never fabricate.',
  '5) DIAGNOSE: run the Trust Gap, then tell the user their score and which funnel piece is weakest and WHY — the ONE thing to fix first.',
].join('\n');

/** A lighter refresh path once already onboarded — re-pull + re-diagnose, don\'t recreate. */
const REFRESH_PLAYBOOK = [
  'REFRESH METRICS — the brand is already set up; do NOT recreate pieces. Run these in order:',
  '1) Re-pull the latest history from each connected Windsor source (get_connectors → get_data; daily granularity, source by source), pulling ONLY raw primitives (sessions, page_views, units_ordered, order_items, ordered_product_sales, impressions, clicks, spend) — never derived rates (ctr/cvr/aov/acos/roas), which the app computes from primitives. These reports are ASYNC: if an ASIN-grain window times out, RETRY THE SAME range first (the timeout primed it; the retry catches the cached report); only narrow (30d, then 7d) if retries still fail. Re-ingest against the existing pieces (source="windsor") in one bulk call; re-uploads reconcile per-day, no duplicates.',
  '2) Prompt the user to enable any registered-but-off connectors that would fill remaining "—" gaps.',
  '3) Re-run the Trust Gap and report what moved + the current weakest piece.',
].join('\n');

export async function runOnboarding(force = false): Promise<OnboardingResult> {
  const state = await getOnboardingState();
  const alreadyOnboarded = state.funnelPieceCount > 0 && state.hasAnyMetrics;

  if (alreadyOnboarded && !force) {
    return {
      already_onboarded: true,
      state,
      next: 'refresh',
      playbook: REFRESH_PLAYBOOK,
      summary: `You\'re already onboarded — ${state.funnelPieceCount} funnel piece(s) with metrics stored. To pull the latest numbers, follow the refresh steps; to rebuild from scratch, run onboarding again with force=true.`,
    };
  }

  return {
    already_onboarded: false,
    state,
    next: 'onboard',
    playbook: FULL_PLAYBOOK,
    summary: force
      ? 'Re-running full onboarding from the top.'
      : `Let\'s onboard your brand. You have ${state.funnelPieceCount} funnel piece(s) and ${state.hasAnyMetrics ? 'some' : 'no'} metrics so far — follow the steps to pull your full history and find your Trust Gap.`,
  };
}
