import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCached, upsertCached, CACHE_TTL } from "../_shared/asinCache.ts";
import { consumeScrapeQuota } from "../_shared/scrapeRateLimit.ts";
import { reviewsFromJson, scrapeAmazonPage, type ScrapedReview } from "../_shared/amazonReviews.ts";

const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

// Fetch guardrails (env-tunable without redeploy via `supabase secrets set`). These gate
// only cache MISSES (real Firecrawl fetches); cache hits are always served, uncounted.
//  - REVIEW_SCRAPE_ENABLED=false   → hard kill-switch (DB-independent), serves cache only.
//  - SCRAPE_USER_DAILY_MAX         → per-user/day fetch cap (catalog-sized + retry headroom).
//  - SCRAPE_GLOBAL_DAILY_MAX       → global/day budget ceiling (× ~5 Firecrawl credits/fetch).
//  - SCRAPE_GLOBAL_WINDOW_MAX      → global fetches per 60s (burst / concurrency ceiling).
const SCRAPE_ENABLED = (Deno.env.get('REVIEW_SCRAPE_ENABLED') ?? 'true').toLowerCase() !== 'false';
const QUOTA_CAPS = {
  userDailyMax: Number(Deno.env.get('SCRAPE_USER_DAILY_MAX')) || 250,
  globalDailyMax: Number(Deno.env.get('SCRAPE_GLOBAL_DAILY_MAX')) || 2000,
  globalWindowMax: Number(Deno.env.get('SCRAPE_GLOBAL_WINDOW_MAX')) || 30,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MS = 2000;

interface ScrapeResult {
  url: string;
  reviews: ScrapedReview[];
  error?: string;
}

/**
 * Extract reviews from Amazon-style pages.
 * Uses patterns adapted from firecrawl-amazon.ts.
 */
function parseAmazonReviews(markdown: string, html: string, sourceUrl: string): ScrapedReview[] {
  const reviews: ScrapedReview[] = [];

  // Strategy 1: Parse structured review blocks from HTML
  // Primary pattern: data-hook="review" is more resilient to DOM depth changes
  const primaryPattern = /<div[^>]*data-hook="review"[^>]*>([\s\S]*?)(?=<div[^>]*data-hook="review"|<\/body|$)/gi;
  // Secondary fallback: id="customer_review" with generous capture
  const fallbackPattern = /<div[^>]*id="customer_review[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*id="customer_review|<div[^>]*data-hook="review"|$)/gi;

  let htmlBlocks = [...html.matchAll(primaryPattern)];
  if (htmlBlocks.length === 0) {
    htmlBlocks = [...html.matchAll(fallbackPattern)];
  }

  for (const block of htmlBlocks) {
    const blockHtml = block[1];

    const nameMatch = blockHtml.match(/class="a-profile-name"[^>]*>([^<]+)/i);
    const ratingMatch = blockHtml.match(/(\d+(?:\.\d+)?)\s*out\s*of\s*5\s*stars/i);
    const titleMatch = blockHtml.match(/data-hook="review-title"[^>]*>[\s\S]*?<span[^>]*>([^<]+)/i);
    const bodyMatch = blockHtml.match(/data-hook="review-body"[^>]*>([\s\S]*?)<\/span>/i);
    const dateMatch = blockHtml.match(/data-hook="review-date"[^>]*>([^<]+)/i);
    const verifiedMatch = blockHtml.match(/Verified Purchase/i);

    if (ratingMatch || bodyMatch) {
      reviews.push({
        reviewerName: nameMatch ? nameMatch[1].trim() : 'Anonymous',
        rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
        title: titleMatch ? titleMatch[1].trim() : '',
        body: bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 2000) : '',
        date: dateMatch ? dateMatch[1].trim() : '',
        verified: !!verifiedMatch,
        source: sourceUrl,
      });
    }
  }

  // Strategy 2: Fallback/supplement with markdown pattern matching
  if (reviews.length < 5) {
    const markdownReviews = parseReviewsFromMarkdown(markdown, sourceUrl);
    for (const mdReview of markdownReviews) {
      // Deduplicate: skip if a substring of the body already exists in HTML-parsed reviews
      const isDuplicate = reviews.some((existing) =>
        mdReview.body.length > 20 &&
        existing.body.includes(mdReview.body.substring(0, 80))
      );
      if (!isDuplicate) {
        reviews.push(mdReview);
      }
    }
  }

  return reviews;
}

/**
 * Extract reviews from generic review pages via markdown patterns.
 * Works as a fallback for non-Amazon sites.
 */
function parseReviewsFromMarkdown(markdown: string, sourceUrl: string): ScrapedReview[] {
  const reviews: ScrapedReview[] = [];

  // Pattern: Rating followed by review text
  // Matches patterns like "5.0 out of 5 stars" or "4 stars" or "Rating: 3/5"
  const ratingBlockPattern = /(?:(\d+(?:\.\d+)?)\s*(?:out\s*of\s*5\s*)?(?:stars?|\/5|★))[^\n]*\n+([\s\S]*?)(?=(?:\d+(?:\.\d+)?)\s*(?:out\s*of\s*5\s*)?(?:stars?|\/5|★)|$)/gi;

  const blocks = markdown.matchAll(ratingBlockPattern);
  for (const block of blocks) {
    const rating = parseFloat(block[1]);
    const content = block[2].trim();

    if (content.length < 10 || rating > 5) continue;

    // Try to extract title from first line
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const title = lines[0]?.length < 200 ? lines[0].trim() : '';
    const body = lines.slice(title ? 1 : 0).join('\n').trim().substring(0, 2000);

    if (body.length > 10) {
      reviews.push({
        reviewerName: 'Anonymous',
        rating,
        title,
        body,
        date: '',
        verified: false,
        source: sourceUrl,
      });
    }
  }

  // Pattern: Structured reviews with headers (common on review sites)
  if (reviews.length === 0) {
    const headerReviewPattern = /#{1,3}\s+(.+)\n+([\s\S]*?)(?=#{1,3}\s+|$)/g;
    const headerBlocks = markdown.matchAll(headerReviewPattern);

    for (const block of headerBlocks) {
      const title = block[1].trim();
      const content = block[2].trim();

      // Look for rating within the content
      const ratingInContent = content.match(/(\d+(?:\.\d+)?)\s*(?:out\s*of\s*5|\/5|stars?|★)/i);

      if (content.length > 30) {
        reviews.push({
          reviewerName: 'Anonymous',
          rating: ratingInContent ? parseFloat(ratingInContent[1]) : 0,
          title,
          body: content.substring(0, 2000),
          date: '',
          verified: false,
          source: sourceUrl,
        });
      }
    }
  }

  return reviews;
}

/**
 * Delay execution for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Only allow scraping of public http(s) URLs. Rejects non-http schemes and
 * private / loopback / link-local / metadata hosts (defense-in-depth against SSRF/abuse).
 */
function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  // URL.hostname brackets IPv6 literals ([::1]); strip them before matching.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local')) return false;
  // Reject ALL IPv6 literals — no legitimate scrape target is a bare IPv6 address. Covers
  // ::1, ::, fe80::/10 (link-local), fc00::/7 (ULA), and ::ffff:<ipv4> metadata-mapped
  // forms (e.g. ::ffff:169.254.169.254), closing the IPv4-mapped SSRF bypass.
  if (host.includes(':')) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = parseInt(m[1]);
    const b = parseInt(m[2]);
    if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) ||
        (a === 100 && b >= 64 && b <= 127)) return false;
  }
  return true;
}

/** True only when the URL's HOST is an amazon.* marketplace (not any URL containing "amazon."). */
function isAmazonHost(raw: string): boolean {
  try {
    return /^(?:www\.)?amazon\.[a-z.]+$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/** Hostname of a URL (cache-row marketplace column; the URL itself is the cache key). */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const body = await req.json().catch(() => ({}));

    // AuthN, two modes. (a) Service-role passthrough (the bulk worker): the bearer is the
    // service-role key, so the caller is trusted infra — take user_id from the body for
    // rate-limit attribution. (b) User mode: verify_jwt alone is insufficient (the anon key
    // is a valid JWT), so getUser() rejects anon and closes unauthenticated credit-abuse.
    let effectiveUserId: string | null;
    if (serviceKey && bearer === serviceKey) {
      effectiveUserId = typeof body?.user_id === 'string' ? body.user_id : null;
    } else {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      // Pass the bearer explicitly: argless getUser() reads the (absent) local
      // session on supabase-js 2.39.x instead of the global Authorization header.
      const { data: { user }, error: authError } = await authClient.auth.getUser(bearer);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      effectiveUserId = user.id;
    }

    if (!firecrawlApiKey) {
      throw new Error('Missing FIRECRAWL_API_KEY environment variable');
    }

    const { urls, maxReviewsPerUrl: maxReviewsRaw = 20 } = body;
    // Cap reviews-per-URL to bound response size (caller-controlled; Firecrawl bills per URL).
    const maxReviewsPerUrl = Math.min(Math.max(1, Number(maxReviewsRaw) || 20), 50);

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cap the number of URLs and reject non-public / internal targets (SSRF/abuse guard).
    const cappedUrls = urls.slice(0, 10).filter((u: unknown) => typeof u === 'string' && isPublicHttpUrl(u));
    if (cappedUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid public http(s) URLs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`Review scraper request: ${cappedUrls.length} URLs`);

    const results: ScrapeResult[] = [];
    // Only rate-limit BETWEEN real Firecrawl fetches — cache hits cost nothing, so they
    // never trigger the 2s delay (key to draining bursts of overlapping catalogs fast).
    let pendingDelay = false;

    for (let i = 0; i < cappedUrls.length; i++) {
      const url = cappedUrls[i];
      const cacheKey = { source: 'firecrawl', dataKind: 'reviews', cacheKey: url, marketplace: hostOf(url) };

      try {
        // Cross-tenant cache: review data is PUBLIC (not tenant-private), so a prior scrape
        // of this URL within CACHE_TTL.reviews (7d) serves EVERY tenant — no Firecrawl call,
        // no credit spend. This is the burst/cost lever for overlapping catalogs + re-runs.
        let reviews = await getCached<ScrapedReview[]>(cacheKey);

        if (reviews) {
          console.log(`  Cache HIT (${reviews.length}) for ${url}`);
        } else {
          // Gate the FETCH only (cache hits above are free + always served). Hard env
          // kill-switch first, then the DB-backed per-user + global budget / burst limiter.
          if (!SCRAPE_ENABLED) {
            results.push({ url, reviews: [], error: 'review scraping is temporarily disabled' });
            continue;
          }
          const quota = await consumeScrapeQuota(effectiveUserId, QUOTA_CAPS);
          if (!quota.allowed) {
            console.log(`  Rate limited (${quota.reason}) for ${url}`);
            results.push({ url, reviews: [], error: `rate limit: ${quota.reason ?? 'scrape quota reached'}` });
            continue;
          }
          if (pendingDelay) {
            await delay(RATE_LIMIT_MS);
            pendingDelay = false;
          }
          console.log(`Scraping (${i + 1}/${cappedUrls.length}): ${url}`);
          // scrapeAmazonPage throws (never returns null) on failure → caught below per-URL.
          const scraped = await scrapeAmazonPage(url, firecrawlApiKey!, { jsonReviews: true, timeoutMs: 45000 });

          // PRIMARY: clean reviews from Firecrawl's structured json extraction.
          reviews = reviewsFromJson(scraped.jsonReviews, url);
          // FALLBACK (json empty): the regex parsers. Use the Amazon HTML parser for any
          // Amazon marketplace host (.com/.co.uk/.de/…), markdown elsewhere.
          if (reviews.length === 0) {
            reviews = isAmazonHost(url)
              ? parseAmazonReviews(scraped.markdown, scraped.html, url)
              : parseReviewsFromMarkdown(scraped.markdown, url);
          }
          // Cache only non-empty results — never poison the cache with a transient
          // 0-review/blocked scrape for 7 days.
          if (reviews.length > 0) await upsertCached(cacheKey, reviews, CACHE_TTL.reviews);
          pendingDelay = true; // a real fetch happened → space the NEXT fetch
          console.log(`  Found ${reviews.length} reviews from ${url}`);
        }

        results.push({ url, reviews: reviews.slice(0, maxReviewsPerUrl) });
      } catch (scrapeError) {
        console.error(`Error scraping ${url}:`, scrapeError);
        results.push({
          url,
          reviews: [],
          error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
        });
      }
    }

    const totalReviews = results.reduce((sum, r) => sum + r.reviews.length, 0);
    console.log(`Review scraper completed: ${totalReviews} reviews from ${results.length} URLs`);

    return new Response(
      JSON.stringify({
        results,
        totalReviews,
        urlsProcessed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in review-scraper function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
