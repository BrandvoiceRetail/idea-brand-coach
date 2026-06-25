// Background drainer for the bulk review-scrape queue (scrape_jobs / scrape_job_items).
//
// Claims pending items (atomic SKIP-LOCKED claim → parallel drainers grab disjoint sets),
// scrapes each via review-scraper in SERVICE-ROLE MODE (which already does the cache +
// per-user/global rate limit, attributed to the item's user_id), freezes the reviews as
// evidence (service-role, explicit user_id), and updates progress. Self-re-triggers while
// pending work remains, so a single kick drains the whole queue over time. Throughput is
// bounded by the rate limiter; on a rate-limit denial it backs off (stops self-triggering)
// and waits for the next external nudge (bulk_ingest_evidence / get_ingest_job).
//
// Kickable by service-role (self-trigger) or any authenticated user; the WORK uses
// service-role internally. No service-role key ever leaves Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// Drain-only shared secret for the pg_cron safety-net (least privilege: can only trigger
// a drain, which is itself rate-limited). Separate from the service-role key.
const DRAIN_SECRET = Deno.env.get('DRAIN_CRON_SECRET') ?? '';

const BATCH = 5;          // items claimed per round
const MAX_ITEMS = 200;    // hard ceiling per invocation
const MAX_WALL_MS = 110_000;

interface JobItem {
  id: string;
  job_id: string;
  user_id: string;
  asin: string | null;
  url: string;
}
interface ScrapedReview { reviewerName?: string; rating?: number; title?: string; body?: string }
interface ParsedReview { reviewer?: string; rating?: number; body: string }

function svc() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Map a scraped review to ParsedReview (title folded into body; sentinels dropped). */
function toParsed(r: ScrapedReview): ParsedReview | null {
  const body = [r.title?.trim(), r.body?.trim()].filter(Boolean).join(' — ');
  if (!body) return null;
  const out: ParsedReview = { body };
  if (r.reviewerName && r.reviewerName !== 'Anonymous') out.reviewer = r.reviewerName;
  if (typeof r.rating === 'number' && r.rating > 0) out.rating = r.rating;
  return out;
}

/** Scrape one URL via review-scraper's service-role mode on behalf of `userId`. */
async function scrapeOne(url: string, userId: string): Promise<{ reviews: ScrapedReview[]; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/review-scraper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ urls: [url], user_id: userId, maxReviewsPerUrl: 20 }),
  });
  if (!res.ok) return { reviews: [], error: `review-scraper HTTP ${res.status}` };
  const data = await res.json().catch(() => ({}));
  const r0 = data?.results?.[0];
  return { reviews: r0?.reviews ?? [], error: r0?.error };
}

/** Drain the queue: claim → scrape → freeze → update, self-re-triggering while work remains. */
async function drain(): Promise<{ processed: number; remaining: number; backoff: boolean }> {
  const client = svc();
  const start = Date.now();
  let processed = 0;
  let backoff = false;
  const touchedJobs = new Set<string>();
  const jobMeta = new Map<string, { product_id: string | null; avatar_id: string | null }>();

  try {
    while (processed < MAX_ITEMS && Date.now() - start < MAX_WALL_MS) {
      const { data: claimed, error: claimErr } = await client.rpc('claim_scrape_items', { p_limit: BATCH });
      if (claimErr) { console.error('claim failed:', claimErr.message); break; }
      const items = (claimed ?? []) as JobItem[];
      if (items.length === 0) break;

      for (const item of items) {
        touchedJobs.add(item.job_id);
        try {
          const { reviews, error } = await scrapeOne(item.url, item.user_id);

          if (error && /rate limit/i.test(error)) {
            // Budget exhausted → release the item back to pending and back off (no hammering).
            await client.from('scrape_job_items')
              .update({ status: 'pending', error, updated_at: new Date().toISOString() }).eq('id', item.id);
            backoff = true;
            break;
          }
          if (error) {
            // A real scrape error (block/HTTP) — fail the item so it's visible, not silent 0.
            await client.from('scrape_job_items')
              .update({ status: 'failed', error, updated_at: new Date().toISOString() }).eq('id', item.id);
            processed++;
            continue;
          }

          const parsed = reviews.map(toParsed).filter((r): r is ParsedReview => r !== null);
          if (parsed.length > 0) {
            if (!jobMeta.has(item.job_id)) {
              const { data: job } = await client.from('scrape_jobs')
                .select('product_id, avatar_id').eq('id', item.job_id).maybeSingle();
              jobMeta.set(item.job_id, { product_id: job?.product_id ?? null, avatar_id: job?.avatar_id ?? null });
            }
            const meta = jobMeta.get(item.job_id)!;
            await client.from('evidence_snapshots').insert({
              user_id: item.user_id,
              avatar_id: meta.avatar_id,
              source: item.asin ? `bulk:asin:${item.asin}` : `bulk:${item.url}`,
              reviews: parsed,
            });
            if (meta.product_id) {
              await client.from('user_product_reviews').insert(parsed.map((r) => ({
                product_id: meta.product_id,
                reviewer_name: r.reviewer ?? null,
                rating: r.rating ?? null,
                body: r.body,
                source_url: item.url,
              })));
            }
          }
          await client.from('scrape_job_items')
            .update({ status: 'done', reviews_count: parsed.length, error: null, updated_at: new Date().toISOString() })
            .eq('id', item.id);
          processed++;
        } catch (err) {
          await client.from('scrape_job_items')
            .update({ status: 'failed', error: err instanceof Error ? err.message : String(err), updated_at: new Date().toISOString() })
            .eq('id', item.id);
          processed++;
        }
      }
      if (backoff) break;
    }

    for (const jid of touchedJobs) await client.rpc('refresh_scrape_job', { p_job: jid });

    const { count: pending } = await client.from('scrape_job_items')
      .select('id', { count: 'exact', head: true }).eq('status', 'pending');

    // Self-re-trigger if work remains and we're not backing off (chain stays single per kick).
    if (!backoff && (pending ?? 0) > 0) {
      const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
      const next = fetch(`${SUPABASE_URL}/functions/v1/process-scrape-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
        body: '{}',
      }).catch(() => {});
      if (waitUntil) waitUntil(next);
    }

    return { processed, remaining: pending ?? 0, backoff };
  } catch (err) {
    console.error('process-scrape-jobs drain error:', err);
    return { processed, remaining: -1, backoff };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Gate who may KICK the drain: service-role (self-trigger), the drain-only cron secret
  // (pg_cron safety-net), or any authenticated user. The WORK always uses service-role.
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '');
  const trustedKick = (SERVICE_KEY && bearer === SERVICE_KEY) || (DRAIN_SECRET && bearer === DRAIN_SECRET);
  if (!trustedKick) {
    const u = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await u.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Drain in the background so the kick returns immediately (202). Fall back to awaiting
  // when waitUntil is unavailable (so it still works without the edge background runtime).
  const waitUntil = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
  const work = drain();
  if (waitUntil) {
    waitUntil(work);
    return new Response(JSON.stringify({ status: 'draining' }), {
      status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const result = await work;
  return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
