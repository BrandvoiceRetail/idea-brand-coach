/**
 * import-product-data — Amazon listing importer.
 *
 * Sellers import one or more Amazon listings by ASIN. For each ASIN this function
 * scrapes the Amazon DP page ONCE via Firecrawl v2, parses the
 * listing fields AND the ~8 embedded reviews (modern review hooks — see
 * `parse-amazon.ts`), and persists them to `user_products` + `user_product_reviews`
 * under the caller's own (RLS-scoped) session.
 *
 * Note: the dedicated `/product-reviews/` pages are login-walled (verified dead
 * 2026-06-04), so we never fetch them — the /dp/ page is the single source.
 *
 * Contract:
 *   req:  { asins: string[] }              (cap 5, each /^[A-Z0-9]{10}$/i)
 *   200:  { status: "ok", results: [{ asin, ok, productId?, title?, rating?,
 *                                      reviewCount?, reviewsSaved?, error? }] }
 *   401:  { error }                        (unauthenticated)
 *   400:  { error }                        (bad input)
 *
 * Auth: self-authenticates via the caller's Authorization header (anon-key client
 * + Bearer token → getUser). config.toml sets verify_jwt = false to match repo
 * convention; the same user-scoped client performs all writes so RLS applies.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { isLikelyRealListing, parseAmazonProduct, type ParsedAmazonProduct, type ParsedReview } from "./parse-amazon.ts";
import { buildAmazonDpUrl, reviewsFromJson, scrapeAmazonPage, type JsonReview } from "../_shared/amazonReviews.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ASINS = 5;
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;
const INTER_ASIN_DELAY_MS = 2000;

interface ImportResultItem {
  asin: string;
  ok: boolean;
  productId?: string;
  title?: string;
  rating?: number;
  reviewCount?: number;
  reviewsSaved?: number;
  error?: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Choose the review set for a listing: whichever strategy extracted MORE.
 * Firecrawl's structured-JSON extraction (rides the same scrape request)
 * covers the layouts where the hook regexes silently return zero (the
 * 2026-07-06 Graham listings); the hook parser still wins on classic layouts
 * where it reads all ~8 embedded reviews to the LLM extractor's ~5.
 */
function chooseReviews(jsonReviews: JsonReview[], hookReviews: ParsedReview[], asin: string): ParsedReview[] {
  const fromJson = reviewsFromJson(jsonReviews, buildAmazonDpUrl(asin));
  if (fromJson.length <= hookReviews.length) return hookReviews;
  return fromJson.map((r) => ({
    reviewerName: r.reviewerName,
    rating: r.rating,
    title: r.title,
    body: r.body,
    date: r.date,
    verified: r.verified,
  }));
}

/**
 * Persist a parsed product + its reviews for a user. Upserts the product
 * (onConflict user_id,asin) and snapshot-replaces its reviews (delete + insert).
 * Returns the product id and number of reviews saved.
 */
async function persistProduct(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  asin: string,
  product: ParsedAmazonProduct,
): Promise<{ productId: string; reviewsSaved: number }> {
  const { data: upserted, error: upsertError } = await supabaseClient
    .from('user_products')
    .upsert(
      {
        user_id: userId,
        asin,
        title: product.title,
        price: product.price > 0 ? product.price : null,
        rating: product.rating > 0 ? product.rating : null,
        review_count: product.reviewCount,
        bullets: product.bullets,
        description: product.description || null,
        images: product.images,
        source_url: buildAmazonDpUrl(asin),
        status: 'completed',
        scraped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,asin' },
    )
    .select('id')
    .single();

  if (upsertError || !upserted) {
    throw new Error(`Failed to upsert product: ${upsertError?.message ?? 'unknown error'}`);
  }

  const productId = upserted.id as string;

  // Snapshot replace: clear prior reviews for this product, then insert fresh.
  const { error: deleteError } = await supabaseClient
    .from('user_product_reviews')
    .delete()
    .eq('product_id', productId);

  if (deleteError) {
    throw new Error(`Failed to clear prior reviews: ${deleteError.message}`);
  }

  let reviewsSaved = 0;
  if (product.reviews.length > 0) {
    const rows = product.reviews.map((review) => ({
      product_id: productId,
      reviewer_name: review.reviewerName || null,
      rating: review.rating >= 0 && review.rating <= 5 ? review.rating : null,
      title: review.title || null,
      body: review.body,
      review_date: review.date || null,
      verified_purchase: review.verified,
      source_url: buildAmazonDpUrl(asin),
    }));

    const { error: insertError } = await supabaseClient
      .from('user_product_reviews')
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert reviews: ${insertError.message}`);
    }
    reviewsSaved = rows.length;
  }

  return { productId, reviewsSaved };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Config ────────────────────────────────────────────────────────────────
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    console.error('[import-product-data] FIRECRAWL_API_KEY not configured');
    return jsonResponse({ error: 'Firecrawl API key not configured.' }, 500);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseClient.auth.getUser(token);
  if (!user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  const userId = user.id;

  // ── Parse + validate request ────────────────────────────────────────────
  let asins: unknown;
  try {
    const body = await req.json();
    asins = body?.asins;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!Array.isArray(asins) || asins.length === 0) {
    return jsonResponse({ error: 'asins must be a non-empty array' }, 400);
  }
  if (asins.length > MAX_ASINS) {
    return jsonResponse({ error: `Too many ASINs (max ${MAX_ASINS})` }, 400);
  }
  if (!asins.every((a) => typeof a === 'string' && ASIN_PATTERN.test(a))) {
    return jsonResponse({ error: 'Each ASIN must match /^[A-Z0-9]{10}$/i' }, 400);
  }
  const asinList = (asins as string[]).map((a) => a.toUpperCase());

  // ── Process each ASIN sequentially (per-ASIN try/catch; never fail batch) ──
  const results: ImportResultItem[] = [];

  for (let i = 0; i < asinList.length; i++) {
    const asin = asinList[i];

    if (i > 0) {
      await delay(INTER_ASIN_DELAY_MS);
    }

    try {
      // One Firecrawl request carries markdown + html + the structured review
      // extraction (throws on failure; caught per-ASIN below).
      const scraped = await scrapeAmazonPage(buildAmazonDpUrl(asin), firecrawlApiKey, {
        jsonReviews: true,
        timeoutMs: 30000,
      });

      const parsed = parseAmazonProduct(scraped.markdown, scraped.html, asin);
      if (!parsed.success || !parsed.data) {
        results.push({ asin, ok: false, error: parsed.error ?? 'Failed to parse listing' });
        continue;
      }

      const product: ParsedAmazonProduct = {
        ...parsed.data,
        reviews: chooseReviews(scraped.jsonReviews, parsed.data.reviews, asin),
      };

      // Amazon serves its error/dog page with HTTP 200, so a nonexistent ASIN
      // would otherwise persist as a garbage product and pollute the Trust Gap
      // evidence and coach context. Reject before any write.
      if (!isLikelyRealListing(product)) {
        console.error(`[import-product-data] rejected non-listing page | asin=${asin} | title="${(product.title ?? '').slice(0, 120)}"`);
        results.push({ asin, ok: false, error: 'No Amazon listing found for this ASIN. Double-check it and try again.' });
        continue;
      }

      const { productId, reviewsSaved } = await persistProduct(
        supabaseClient,
        userId,
        asin,
        product,
      );

      results.push({
        asin,
        ok: true,
        productId,
        title: product.title,
        rating: product.rating,
        reviewCount: product.reviewCount,
        reviewsSaved,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[import-product-data] Failed for ${asin}:`, message);
      results.push({ asin, ok: false, error: message });
    }
  }

  return jsonResponse({ status: 'ok', results }, 200);
});
