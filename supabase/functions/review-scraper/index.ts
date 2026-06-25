import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MS = 2000;

interface ScrapedReview {
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  source: string;
}

interface ScrapeResult {
  url: string;
  reviews: ScrapedReview[];
  error?: string;
}

interface JsonReview {
  reviewer?: string;
  rating?: number;
  title?: string;
  body?: string;
  date?: string;
  verified?: boolean;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    html: string;
    json?: { reviews?: JsonReview[] };
  };
  creditsUsed?: number;
}

/**
 * Structured-extraction schema: ask Firecrawl's LLM for clean review objects.
 * This is the PRIMARY path — resilient to Amazon's shifting markup (the
 * data-hook="review-body" HTML regex went stale and returns empty bodies). The
 * regex parsers remain as a no-LLM fallback when json is empty.
 */
const REVIEW_JSON_OPTIONS = {
  prompt:
    'Extract the customer reviews shown on this product page. For each review capture the ' +
    'reviewer name, the star rating as a number 1-5, the review title, the full review body ' +
    'text, the date, and whether it is a verified purchase. Only include actual customer ' +
    'reviews — never the product description, specs, or marketing copy.',
  schema: {
    type: 'object',
    properties: {
      reviews: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            reviewer: { type: 'string' },
            rating: { type: 'number' },
            title: { type: 'string' },
            body: { type: 'string' },
            date: { type: 'string' },
            verified: { type: 'boolean' },
          },
          required: ['body'],
        },
      },
    },
    required: ['reviews'],
  },
};

/** Map Firecrawl's structured json reviews to the ScrapedReview contract. */
function reviewsFromJson(jsonReviews: JsonReview[], sourceUrl: string): ScrapedReview[] {
  return jsonReviews
    .filter((r) => typeof r.body === 'string' && r.body.trim().length > 0)
    .map((r) => ({
      reviewerName: r.reviewer?.trim() || 'Anonymous',
      rating: typeof r.rating === 'number' ? r.rating : 0,
      title: r.title?.trim() || '',
      body: r.body!.trim().substring(0, 2000),
      date: r.date?.trim() || '',
      verified: r.verified === true,
      source: sourceUrl,
    }));
}

/**
 * Scrape a single URL using the Firecrawl API.
 * Adapted from firecrawl-amazon.ts patterns.
 */
async function scrapeUrl(
  url: string,
): Promise<{ markdown: string; html: string; jsonReviews: JsonReview[] } | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        // Firecrawl v2: the json format is an OBJECT inside `formats` (NOT a top-level
        // `jsonOptions` key — v2 rejects that with BAD_REQUEST).
        formats: [
          "markdown",
          "html",
          { type: "json", prompt: REVIEW_JSON_OPTIONS.prompt, schema: REVIEW_JSON_OPTIONS.schema },
        ],
        actions: [
          { type: "wait", milliseconds: 3000 },
        ],
        onlyMainContent: false,
        timeout: 45000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl API error (${response.status}):`, errorText);
      // Surface the cause to the per-URL result instead of a generic "Failed to scrape".
      throw new Error(`Firecrawl ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const data: FirecrawlResponse = await response.json();
    const responseData = data.data;

    if (!responseData?.markdown) {
      console.error("Missing markdown in Firecrawl response for:", url, JSON.stringify(data).slice(0, 400));
      throw new Error('Firecrawl returned no page content (possible block/captcha).');
    }

    return {
      markdown: responseData.markdown,
      html: responseData.html || '',
      jsonReviews: responseData.json?.reviews ?? [],
    };
  } catch (error) {
    console.error("Firecrawl scrape error for", url, ":", error);
    throw error;
  }
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
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AuthN: require an authenticated user. verify_jwt alone is insufficient (the public
    // anon key is itself a valid JWT); getUser() rejects the anon token and closes
    // unauthenticated Firecrawl credit-abuse. Both legitimate callers forward a user JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!firecrawlApiKey) {
      throw new Error('Missing FIRECRAWL_API_KEY environment variable');
    }

    const { urls, maxReviewsPerUrl = 20 } = await req.json();

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

    for (let i = 0; i < cappedUrls.length; i++) {
      const url = cappedUrls[i];
      console.log(`Scraping (${i + 1}/${cappedUrls.length}): ${url}`);

      try {
        const scraped = await scrapeUrl(url);

        if (!scraped) {
          results.push({ url, reviews: [], error: 'Failed to scrape URL' });
        } else {
          // PRIMARY: clean reviews from Firecrawl's structured json extraction.
          let reviews: ScrapedReview[] = reviewsFromJson(scraped.jsonReviews, url);
          // FALLBACK (json empty): the regex parsers. Use the Amazon HTML parser for
          // any Amazon marketplace (.com/.co.uk/.de/…), markdown elsewhere.
          if (reviews.length === 0) {
            reviews = /amazon\.[a-z.]+\//i.test(url)
              ? parseAmazonReviews(scraped.markdown, scraped.html, url)
              : parseReviewsFromMarkdown(scraped.markdown, url);
          }

          results.push({
            url,
            reviews: reviews.slice(0, maxReviewsPerUrl),
          });

          console.log(`  Found ${reviews.length} reviews from ${url}`);
        }
      } catch (scrapeError) {
        console.error(`Error scraping ${url}:`, scrapeError);
        results.push({
          url,
          reviews: [],
          error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
        });
      }

      // Rate limit: 2-second delay between requests
      if (i < cappedUrls.length - 1) {
        await delay(RATE_LIMIT_MS);
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
