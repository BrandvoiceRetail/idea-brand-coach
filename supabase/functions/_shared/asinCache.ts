/**
 * Shared cross-tenant fetch cache for competitor data (Competitor-Agents cost lever).
 *
 * Competitor PUBLIC data (listings / reviews / discovery / web pages) is not
 * tenant-private, so one upstream fetch per (source, data_kind, cache_key,
 * marketplace) serves EVERY tenant. Backed by public.competitor_asin_cache
 * (migration 20260618000500), which is SERVICE-ROLE-ONLY (RLS on, no policies)
 * — so this helper uses a service-role client, NOT the caller's auth.
 *
 * Best-effort by design: every function swallows its own errors and degrades to
 * a live fetch (getCached -> null, upsertCached -> no-op). A cache failure must
 * NEVER fail the analysis. Returns null when SUPABASE_SERVICE_ROLE_KEY is absent
 * (e.g. local), so behaviour is identical to a cold cache.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const TABLE = 'competitor_asin_cache';

/** TTL (seconds) by data volatility. Buy-Box is intentionally absent (never cache). */
export const CACHE_TTL = {
  product: 24 * 60 * 60,      // listing/ASIN detail — 24h
  discovery: 24 * 60 * 60,    // top-N competitor search — 24h
  reviews: 7 * 24 * 60 * 60,  // review sample — 7d (thin + slow-changing)
  page: 24 * 60 * 60,         // fetched web/store page — 24h
};

export interface CacheKey {
  source: string;     // 'dataforseo' | 'firecrawl' | 'keepa' | ...
  dataKind: string;   // 'product' | 'discovery' | 'reviews' | 'page'
  cacheKey: string;   // ASIN, normalized keyword/category, or URL
  marketplace: string;
}

/** Lazily build a service-role client (so the module imports without env present). */
function serviceClient() {
  const url = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get('SUPABASE_URL');
  const key = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Read a cached payload if present AND not expired; else null. Never throws. */
export async function getCached<T = unknown>(k: CacheKey): Promise<T | null> {
  const client = serviceClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('payload, expires_at')
      .eq('source', k.source)
      .eq('data_kind', k.dataKind)
      .eq('cache_key', k.cacheKey)
      .eq('marketplace', k.marketplace)
      .maybeSingle();
    if (error || !data) return null;
    const expiresAt = (data as { expires_at?: string }).expires_at;
    if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return null; // expired
    return ((data as { payload?: T }).payload ?? null) as T | null;
  } catch (err) {
    console.error('[asinCache] getCached failed (non-fatal):', err);
    return null;
  }
}

/** Upsert a payload with a TTL. Best-effort; never throws. */
export async function upsertCached(k: CacheKey, payload: unknown, ttlSeconds: number): Promise<void> {
  const client = serviceClient();
  if (!client) return;
  try {
    const now = Date.now();
    await client.from(TABLE).upsert(
      {
        source: k.source,
        data_kind: k.dataKind,
        cache_key: k.cacheKey,
        marketplace: k.marketplace,
        payload,
        fetched_at: new Date(now).toISOString(),
        expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
      },
      { onConflict: 'source,data_kind,cache_key,marketplace' },
    );
  } catch (err) {
    console.error('[asinCache] upsertCached failed (non-fatal):', err);
  }
}
