/**
 * Shared Amazon page scrape + review extraction (the single extraction seam).
 *
 * Lifted verbatim from review-scraper (the proven implementation) so that
 * import-product-data and review-scraper share ONE Firecrawl call shape and ONE
 * review-extraction strategy chain. History that motivates this seam: the
 * regex-hook extractors have gone stale twice (data-hook="review-body" →
 * "reviewText" 2026-06-04; layouts with no static review markup at all
 * 2026-07-06), each time silently returning zero reviews. Firecrawl's
 * structured-JSON extraction is the PRIMARY strategy; the callers keep their
 * regex parsers as the no-LLM fallback.
 *
 * No Deno globals here: the caller passes the Firecrawl key, so this module
 * stays portable and unit-reviewable.
 */

/** Default Amazon marketplace for ASIN-only imports (US). */
export const DEFAULT_MARKETPLACE_HOST = 'amazon.com';

/** Build an Amazon DP URL from ASIN and optional marketplace host. */
export function buildAmazonDpUrl(asin: string, marketplaceHost = DEFAULT_MARKETPLACE_HOST): string {
  return `https://www.${marketplaceHost}/dp/${asin}`;
}

/** A review as extracted by Firecrawl's structured-JSON format. */
export interface JsonReview {
  reviewer?: string;
  rating?: number;
  title?: string;
  body?: string;
  date?: string;
  verified?: boolean;
}

/** The normalized review contract both edge fns speak. */
export interface ScrapedReview {
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
  source: string;
}

interface FirecrawlResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    json?: { reviews?: JsonReview[] };
  };
  creditsUsed?: number;
}

/**
 * Structured-extraction schema: ask Firecrawl's LLM for clean review objects.
 * Resilient to Amazon's shifting markup — the reason this seam exists.
 */
export const REVIEW_JSON_OPTIONS = {
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
export function reviewsFromJson(jsonReviews: JsonReview[], sourceUrl: string): ScrapedReview[] {
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

/** Strip the Firecrawl key and any bearer tokens from text before it is logged/returned. */
export function redactSecret(text: string, firecrawlApiKey?: string): string {
  let out = text.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [redacted]');
  if (firecrawlApiKey) out = out.split(firecrawlApiKey).join('[redacted]');
  return out;
}

export interface ScrapeAmazonPageOptions {
  /** Also run Firecrawl's structured review extraction on the same request. */
  jsonReviews?: boolean;
  /** Firecrawl-side timeout for the page. */
  timeoutMs?: number;
}

/**
 * Scrape one page via Firecrawl v2 (markdown + html + optional structured
 * reviews IN THE SAME REQUEST — no second scrape, no extra credit spend).
 * Throws (never returns null) on failure with a redacted, cause-bearing
 * message; the per-item caller catches and records it.
 *
 * Firecrawl v2 gotcha (hard-won): the json format is an OBJECT inside
 * `formats` — a top-level `jsonOptions` key is rejected with BAD_REQUEST.
 */
export async function scrapeAmazonPage(
  url: string,
  firecrawlApiKey: string,
  opts: ScrapeAmazonPageOptions = {},
): Promise<{ markdown: string; html: string; jsonReviews: JsonReview[] }> {
  const { jsonReviews = true, timeoutMs = 45000 } = opts;

  const formats: unknown[] = ['markdown', 'html'];
  if (jsonReviews) {
    formats.push({ type: 'json', prompt: REVIEW_JSON_OPTIONS.prompt, schema: REVIEW_JSON_OPTIONS.schema });
  }

  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats,
      actions: [{ type: 'wait', milliseconds: 3000 }],
      onlyMainContent: false,
      timeout: timeoutMs,
    }),
  });

  if (!response.ok) {
    const errorText = redactSecret(await response.text(), firecrawlApiKey).slice(0, 300);
    console.error(`[amazonReviews] Firecrawl error (${response.status}) for ${url}:`, errorText);
    throw new Error(`Firecrawl ${response.status}: ${errorText}`);
  }

  const payload = await response.json() as FirecrawlResponse;
  const data = payload.data;

  if (!data?.markdown) {
    // Log only the response keys — never the raw body (may carry content/metadata).
    console.error('[amazonReviews] Missing markdown in Firecrawl response for:', url, 'keys:', Object.keys(data ?? {}));
    throw new Error('Firecrawl returned no page content (possible block/captcha).');
  }

  return {
    markdown: data.markdown,
    html: data.html || '',
    jsonReviews: data.json?.reviews ?? [],
  };
}
