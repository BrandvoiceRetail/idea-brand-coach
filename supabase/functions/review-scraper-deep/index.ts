import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MS = 2000;
const MAX_ASINS = 5;
const MAX_PAGES_PER_STAR = 3;

const STAR_FILTER_MAP: Record<string, string> = {
  '1': 'one_star',
  '2': 'two_star',
  '3': 'three_star',
  '4': 'four_star',
  '5': 'five_star',
};

const ALL_STAR_FILTERS = ['1', '2', '3', '4', '5'];

interface ScrapedReview {
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  source: string;
}

interface DeepScrapeRequest {
  asins: string[];
  pagesPerStar?: number;
  starFilters?: string[];
}

interface AsinResult {
  asin: string;
  reviews: ScrapedReview[];
  starDistribution: Record<string, number>;
  error?: string;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    html: string;
  };
  creditsUsed?: number;
}

/** Scrape a single URL using the Firecrawl API. */
async function scrapeUrl(url: string): Promise<{ markdown: string; html: string } | null> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "html"],
        actions: [
          { type: "wait", milliseconds: 3000 },
        ],
        onlyMainContent: false,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl API error (${response.status}):`, errorText);
      return null;
    }

    const data: FirecrawlResponse = await response.json();
    const responseData = data.data;

    if (!responseData?.markdown) {
      console.error("Missing markdown in Firecrawl response for:", url);
      return null;
    }

    return {
      markdown: responseData.markdown,
      html: responseData.html || '',
    };
  } catch (error) {
    console.error("Firecrawl scrape error for", url, ":", error);
    return null;
  }
}

/** Extract reviews from Amazon HTML using data-hook and id-based patterns, with markdown fallback. */
function parseAmazonReviews(markdown: string, html: string, sourceUrl: string): ScrapedReview[] {
  const reviews: ScrapedReview[] = [];

  const primaryPattern = /<div[^>]*data-hook="review"[^>]*>([\s\S]*?)(?=<div[^>]*data-hook="review"|<\/body|$)/gi;
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

  if (reviews.length < 5) {
    const markdownReviews = parseReviewsFromMarkdown(markdown, sourceUrl);
    for (const mdReview of markdownReviews) {
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

/** Extract reviews from markdown patterns as a fallback parsing strategy. */
function parseReviewsFromMarkdown(markdown: string, sourceUrl: string): ScrapedReview[] {
  const reviews: ScrapedReview[] = [];

  const ratingBlockPattern = /(?:(\d+(?:\.\d+)?)\s*(?:out\s*of\s*5\s*)?(?:stars?|\/5|★))[^\n]*\n+([\s\S]*?)(?=(?:\d+(?:\.\d+)?)\s*(?:out\s*of\s*5\s*)?(?:stars?|\/5|★)|$)/gi;

  const blocks = markdown.matchAll(ratingBlockPattern);
  for (const block of blocks) {
    const rating = parseFloat(block[1]);
    const content = block[2].trim();

    if (content.length < 10 || rating > 5) continue;

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

  if (reviews.length === 0) {
    const headerReviewPattern = /#{1,3}\s+(.+)\n+([\s\S]*?)(?=#{1,3}\s+|$)/g;
    const headerBlocks = markdown.matchAll(headerReviewPattern);

    for (const block of headerBlocks) {
      const title = block[1].trim();
      const content = block[2].trim();

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

/** Generate a normalized dedup key from the first 100 chars of review body text. */
function deduplicationKey(body: string): string {
  return body
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

/** Deduplicate reviews by comparing normalized body text prefixes. */
function deduplicateReviews(reviews: ScrapedReview[]): ScrapedReview[] {
  const seen = new Set<string>();
  const unique: ScrapedReview[] = [];

  for (const review of reviews) {
    if (!review.body || review.body.length < 10) {
      unique.push(review);
      continue;
    }

    const key = deduplicationKey(review.body);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(review);
    }
  }

  return unique;
}

/** Build the Amazon review URL for a given ASIN, star filter, and page number. */
function buildReviewUrl(asin: string, starFilter: string, pageNumber: number): string {
  const filterValue = STAR_FILTER_MAP[starFilter];
  return `https://www.amazon.com/product-reviews/${asin}?filterByStar=${filterValue}&pageNumber=${pageNumber}`;
}

/** Compute star distribution from a list of reviews. */
function computeStarDistribution(reviews: ScrapedReview[]): Record<string, number> {
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const review of reviews) {
    const rounded = Math.round(review.rating);
    if (rounded >= 1 && rounded <= 5) {
      distribution[String(rounded)]++;
    }
  }
  return distribution;
}

/** Delay execution for rate limiting. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scrape all reviews for a single ASIN across star filters and pages. */
async function scrapeAsin(
  asin: string,
  starFilters: string[],
  pagesPerStar: number,
): Promise<AsinResult> {
  const allReviews: ScrapedReview[] = [];
  let totalScrapes = 0;
  let failedScrapes = 0;

  for (const star of starFilters) {
    for (let page = 1; page <= pagesPerStar; page++) {
      const url = buildReviewUrl(asin, star, page);
      console.log(`  Scraping ASIN ${asin} | ${star}-star | page ${page}: ${url}`);

      try {
        const scraped = await scrapeUrl(url);

        if (scraped) {
          const reviews = parseAmazonReviews(scraped.markdown, scraped.html, url);
          allReviews.push(...reviews);
          console.log(`    Found ${reviews.length} reviews`);
        } else {
          failedScrapes++;
          console.warn(`    Failed to scrape ${url}`);
        }
      } catch (error) {
        failedScrapes++;
        console.error(`    Error scraping ${url}:`, error);
      }

      totalScrapes++;

      // Rate limit between requests
      await delay(RATE_LIMIT_MS);
    }
  }

  const totalExpected = starFilters.length * pagesPerStar;
  if (failedScrapes >= totalExpected) {
    return {
      asin,
      reviews: [],
      starDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      error: `All ${totalExpected} scrape attempts failed for ASIN ${asin}`,
    };
  }

  const dedupedReviews = deduplicateReviews(allReviews);
  const starDistribution = computeStarDistribution(dedupedReviews);

  console.log(`  ASIN ${asin} complete: ${allReviews.length} raw → ${dedupedReviews.length} unique reviews`);

  return {
    asin,
    reviews: dedupedReviews,
    starDistribution,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!firecrawlApiKey) {
      throw new Error('Missing FIRECRAWL_API_KEY environment variable');
    }

    const body: DeepScrapeRequest = await req.json();
    const { asins, pagesPerStar: rawPagesPerStar, starFilters: rawStarFilters } = body;

    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return new Response(
        JSON.stringify({ error: 'asins array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cappedAsins = asins.slice(0, MAX_ASINS);
    const pagesPerStar = Math.min(Math.max(rawPagesPerStar || 1, 1), MAX_PAGES_PER_STAR);
    const starFilters = (rawStarFilters && rawStarFilters.length > 0)
      ? rawStarFilters.filter((s) => STAR_FILTER_MAP[s])
      : ALL_STAR_FILTERS;

    const totalCalls = cappedAsins.length * starFilters.length * pagesPerStar;
    console.log(
      `Deep review scraper: ${cappedAsins.length} ASINs × ${starFilters.length} stars × ${pagesPerStar} pages = ${totalCalls} requests`
    );

    const results: AsinResult[] = [];

    for (const asin of cappedAsins) {
      console.log(`Processing ASIN: ${asin}`);
      const result = await scrapeAsin(asin, starFilters, pagesPerStar);
      results.push(result);
    }

    const totalReviews = results.reduce((sum, r) => sum + r.reviews.length, 0);
    console.log(`Deep review scraper completed: ${totalReviews} total reviews from ${results.length} ASINs`);

    return new Response(
      JSON.stringify({
        results,
        totalReviews,
        asinsProcessed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in review-scraper-deep function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
