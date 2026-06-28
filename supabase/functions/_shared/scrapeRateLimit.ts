/**
 * Cross-tenant scrape rate limiter for the Firecrawl chokepoint (review-scraper).
 *
 * Consumes ONE fetch unit against three caps — per-user/day, global/day (the budget
 * ceiling / cost kill-switch), and global/60s-window (burst & concurrency ceiling) — via
 * the atomic `consume_scrape_quota` RPC (migration scrape_rate_limiter). Counts only ACTUAL
 * Firecrawl fetches; cache hits never call this.
 *
 * Service-role-only (the RPC is revoked from anon/authenticated). FAIL-OPEN by design: if
 * the limiter is unavailable (no service key locally, or the RPC errors) we allow the fetch
 * rather than break the feature — the env hard kill-switch (REVIEW_SCRAPE_ENABLED) is the
 * DB-independent hard stop.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface ScrapeQuotaCaps {
  userDailyMax: number;
  globalDailyMax: number;
  globalWindowMax: number;
}

export interface ScrapeQuotaResult {
  allowed: boolean;
  reason?: string;
}

function serviceClient() {
  const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env;
  const url = env?.get('SUPABASE_URL');
  const key = env?.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Consume one fetch unit for `userId`. Returns {allowed:false, reason} when a cap is hit. */
export async function consumeScrapeQuota(
  userId: string | null,
  caps: ScrapeQuotaCaps,
): Promise<ScrapeQuotaResult> {
  const client = serviceClient();
  if (!client) return { allowed: true }; // limiter unavailable → don't block (fail-open)
  try {
    const { data, error } = await client.rpc('consume_scrape_quota', {
      p_user: userId,
      p_user_daily_max: caps.userDailyMax,
      p_global_daily_max: caps.globalDailyMax,
      p_global_window_max: caps.globalWindowMax,
    });
    if (error) {
      console.error('[scrapeRateLimit] rpc failed (fail-open):', error.message);
      return { allowed: true };
    }
    const r = (data ?? {}) as { allowed?: boolean; reason?: string };
    return { allowed: r.allowed !== false, reason: r.reason };
  } catch (err) {
    console.error('[scrapeRateLimit] failed (fail-open):', err);
    return { allowed: true };
  }
}
