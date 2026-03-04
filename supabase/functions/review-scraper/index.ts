import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

interface FirecrawlResponse {
  success: boolean;
  data?: {
    markdown: string;
    html: string;
  };
  creditsUsed?: number;
}

/**
 * Scrape a single URL using the Firecrawl API.
 * Adapted from firecrawl-amazon.ts patterns.
 */
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
        onlyMainContent: true,
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

/**
 * Extract reviews from Amazon-style pages.
 * Uses patterns adapted from firecrawl-amazon.ts.
 */
function parseAmazonReviews(markdown: string, html: string, sourceUrl: string): ScrapedReview[] {
  const reviews: ScrapedReview[] = [];

  // Strategy 1: Parse structured review blocks from HTML
  const reviewBlockPattern = /<div[^>]*id="customer_review[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const htmlBlocks = html.matchAll(reviewBlockPattern);

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

  // Strategy 2: Fallback to markdown pattern matching
  if (reviews.length === 0) {
    reviews.push(...parseReviewsFromMarkdown(markdown, sourceUrl));
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Cap the number of URLs to prevent excessive API usage
    const cappedUrls = urls.slice(0, 10);
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
          // Determine parsing strategy based on URL
          let reviews: ScrapedReview[];
          if (url.includes('amazon.com')) {
            reviews = parseAmazonReviews(scraped.markdown, scraped.html, url);
          } else {
            reviews = parseReviewsFromMarkdown(scraped.markdown, url);
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
