/**
 * Forensic freshness logic - pure functions for testing the skip/scrape decision.
 * Extracted from run-forensic-analysis for testability.
 */

export interface ProductFreshnessData {
  scraped_at: string | null;
  review_count: number;
}

/**
 * Determine if we should skip scraping based on freshness and review presence.
 * Returns true only if BOTH conditions are met:
 * 1. Data was scraped within the freshness window
 * 2. Reviews are actually present (non-zero count)
 *
 * This guards against the edge case where import-product-data successfully
 * updates scraped_at but fails to insert reviews, leaving a fresh timestamp
 * with no usable review data.
 */
export function shouldSkipScrape(
  product: ProductFreshnessData | null,
  freshnessWindowMs: number,
  now: number = Date.now()
): boolean {
  // No product or no scraped_at means we need to scrape
  if (!product || !product.scraped_at) {
    return false;
  }

  // Check freshness
  const scrapedAt = new Date(product.scraped_at).getTime();
  const isFresh = (now - scrapedAt) < freshnessWindowMs;

  // Must be fresh AND have reviews to skip
  return isFresh && product.review_count > 0;
}