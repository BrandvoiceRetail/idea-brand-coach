/**
 * Regex for matching an ASIN within an Amazon product URL.
 * Matches /dp/, /gp/product/, or /product-reviews/ followed by 10 alphanumeric characters.
 */
const AMAZON_URL_ASIN_REGEX = /\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i;

/**
 * Regex for matching a raw 10-character alphanumeric ASIN.
 */
const RAW_ASIN_REGEX = /^[A-Z0-9]{10}$/i;

/**
 * Extract an ASIN from a single input string.
 * Accepts a raw ASIN (e.g., "B0CJBQ7F5C") or an Amazon product URL.
 * Returns the ASIN in uppercase, or null if no valid ASIN is found.
 */
export function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (RAW_ASIN_REGEX.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const urlMatch = trimmed.match(AMAZON_URL_ASIN_REGEX);
  if (urlMatch) {
    return urlMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Parse a textarea value containing multiple lines of ASINs or Amazon URLs.
 * Splits by newline, extracts ASINs from each line, deduplicates,
 * and returns an array of unique uppercase ASINs.
 */
export function parseAsinInput(text: string): string[] {
  const lines = text.split('\n');
  const seen = new Set<string>();
  const results: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const asin = extractAsin(trimmed);
    if (asin && !seen.has(asin)) {
      seen.add(asin);
      results.push(asin);
    }
  }

  return results;
}

/**
 * Convert an ASIN to an Amazon product reviews page URL.
 */
export function asinToReviewUrl(asin: string): string {
  return `https://www.amazon.com/product-reviews/${asin}`;
}
