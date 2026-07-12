/**
 * Layer 1 (service) — first-party Amazon Ads SEARCH-TERM ingestion + read over ad_search_terms.
 *
 * The seller's OWN search-term report grain (per-keyword impressions/clicks/spend/orders/sales),
 * pulled host-side through Windsor `amazon_ads` and upserted here — the same host-driven pattern
 * as campaign_metrics (analyticsIngestService), one grain finer (a keyword dimension the campaign
 * spine lacks). Feeds run_ppc_audit (search-term harvest/negate + per-keyword ACOS).
 *
 * Every write runs on the JWT-bound client so RLS scopes rows to `auth.uid()`; brand_asset
 * ownership is verified before any row is attached (RLS read + the DB owner-guard trigger, defense
 * in depth). Restatable data (Amazon revises terms) → upsert on the natural key. HONEST no_data: a
 * row is kept only if it has a non-empty search_term AND at least one finite metric; an all-empty
 * batch returns ok:false/no_data — never fabricates a keyword or a number.
 */
import { getUserSupabase } from '../supabaseUser.js';
import { getIdentity } from '../context/identity.js';
import { resolveBrandId } from './avatarOwnership.js';
import type { MetricSource } from './campaignTypes.js';

const TABLE = 'ad_search_terms';
const BRAND_ASSETS_TABLE = 'brand_assets';
const COLS =
  'id, user_id, brand_id, brand_asset_id, campaign_id, search_term, match_type, measured_date, impressions, clicks, spend, orders, sales, source, created_at, updated_at';
/** Matches uq_ad_search_terms_natural exactly (supabase-js onConflict takes column NAMES). */
const CONFLICT_TARGET = 'user_id,brand_asset_id,campaign_id,search_term,match_type,measured_date';

export type SearchTermMatchType = 'exact' | 'phrase' | 'broad' | 'auto' | 'unknown';
export const SEARCH_TERM_MATCH_TYPES: readonly SearchTermMatchType[] = ['exact', 'phrase', 'broad', 'auto', 'unknown'];

/** One parsed search-term row the host supplies (from the Amazon Ads search-term report). */
export interface SearchTermInput {
  search_term: string;
  match_type?: SearchTermMatchType;
  brand_asset_id?: string | null;
  campaign_id?: string | null;
  measured_date: string; // YYYY-MM-DD
  impressions?: number;
  clicks?: number;
  spend?: number;
  orders?: number;
  sales?: number;
}

/** A persisted ad_search_terms row, as read back. */
export interface SearchTermRow {
  id: string;
  user_id: string;
  brand_id: string | null;
  brand_asset_id: string | null;
  campaign_id: string | null;
  search_term: string;
  match_type: SearchTermMatchType;
  measured_date: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SearchTermIngestResult {
  ok: boolean;
  ingested: number;
  rows: SearchTermRow[];
  note?: string;
}

/** Raised when a search-term DB call fails or a referenced funnel piece is not owned. */
export class SearchTermError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SearchTermError';
  }
}

function requireUserId(): string {
  const { userId } = getIdentity();
  if (!userId) throw new SearchTermError('no authenticated user id in scope');
  return userId;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** A finite metric or 0 — search-term counts are real facts; absent fields default to 0, not null. */
const num = (v: unknown): number => (isFiniteNumber(v) ? v : 0);

/** A row is meaningful only if it names a term AND carries at least one finite metric. */
function isUsable(r: SearchTermInput): boolean {
  if (!r.search_term || !r.search_term.trim()) return false;
  return [r.impressions, r.clicks, r.spend, r.orders, r.sales].some(isFiniteNumber);
}

/** Verify every referenced funnel piece (brand_asset_id) belongs to the caller (mirrors the analytics gate). */
async function requireOwnedBrandAssets(ids: Iterable<string>): Promise<void> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return;
  const supabase = getUserSupabase();
  const { data, error } = await supabase.from(BRAND_ASSETS_TABLE).select('id').in('id', unique);
  if (error) throw new SearchTermError(`failed to verify funnel piece ownership: ${error.message}`, error);
  const found = new Set((data as Array<{ id: string }> | null)?.map((r) => r.id) ?? []);
  if (found.size !== unique.length) throw new SearchTermError('funnel piece (brand_asset) not found or not owned');
}

/** Best-effort brand resolution — the table allows a null brand_id, so a brand-less caller still ingests. */
async function resolveBrandIdSafe(): Promise<string | null> {
  try {
    return await resolveBrandId();
  } catch {
    return null;
  }
}

/**
 * Upsert the seller's search-term rows on the natural key (re-ingest safe). Drops rows without a
 * term or any finite metric (honest no_data). `source` defaults to windsor (the host-driven pull).
 */
export async function ingestSearchTerms(
  rows: SearchTermInput[],
  source: MetricSource = 'windsor',
): Promise<SearchTermIngestResult> {
  const usable = rows.filter(isUsable);
  if (usable.length === 0) return { ok: false, ingested: 0, rows: [], note: 'no_data' };

  await requireOwnedBrandAssets(usable.map((r) => r.brand_asset_id).filter((id): id is string => Boolean(id)));

  const supabase = getUserSupabase();
  const userId = requireUserId();
  const brandId = await resolveBrandIdSafe();

  const insert = usable.map((r) => ({
    user_id: userId,
    brand_id: brandId,
    brand_asset_id: r.brand_asset_id ?? null,
    campaign_id: r.campaign_id ?? null,
    search_term: r.search_term.trim(),
    match_type: r.match_type ?? 'unknown',
    measured_date: r.measured_date,
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    spend: num(r.spend),
    orders: num(r.orders),
    sales: num(r.sales),
    source,
    // updated_at is DB-defaulted (now()); never send a client clock.
  }));

  const { data, error } = await supabase.from(TABLE).upsert(insert, { onConflict: CONFLICT_TARGET }).select(COLS);
  if (error) throw new SearchTermError(`failed to ingest search terms: ${error.message}`, error);

  const written = (data as SearchTermRow[] | null) ?? [];
  return { ok: written.length > 0, ingested: written.length, rows: written };
}

/** Read the caller's search-term rows for a piece and/or a date window (for run_ppc_audit). */
export async function getSearchTerms(params: {
  brandAssetId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<SearchTermRow[]> {
  const supabase = getUserSupabase();
  let query = supabase.from(TABLE).select(COLS).order('spend', { ascending: false });
  if (params.brandAssetId) query = query.eq('brand_asset_id', params.brandAssetId);
  if (params.from) query = query.gte('measured_date', params.from);
  if (params.to) query = query.lte('measured_date', params.to);
  query = query.limit(params.limit ?? 2000);
  const { data, error } = await query;
  if (error) throw new SearchTermError(`failed to read search terms: ${error.message}`, error);
  return (data as SearchTermRow[] | null) ?? [];
}
