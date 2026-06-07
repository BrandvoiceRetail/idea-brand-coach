/**
 * Amazon /dp/ Product Parser — pure, dependency-free.
 *
 * Ported from the production-proven scraper in
 * `infinityvault/core-os/lib/firecrawl-amazon.ts` (listing fields) and extended
 * with embedded-review extraction for `/dp/{asin}` pages.
 *
 * IMPORTANT — review extraction uses Amazon's MODERN review hooks, verified live
 * 2026-06-04:
 *   - review block:   <div|li data-hook="review">
 *   - body:           data-hook="reviewText"   (NOT the legacy "review-body")
 *   - title:          data-hook="reviewTitle"
 *   - rating:         "{n} out of 5 stars" inside the block
 *   - reviewer:       <span class="a-profile-name">
 *   - date:           data-hook="review-date"
 *   - verified:       presence of data-hook="avp-badge"
 * A /dp/ page embeds ~8 reviews. The dedicated `/product-reviews/` pages are
 * login-walled (verified dead 2026-06-04) — do not rely on them.
 *
 * This module is intentionally dependency-free so it can be duplicated verbatim
 * into the `import-product-data` edge function (Deno bundles only the function's
 * own folder + `_shared`). The twin lives at
 * `supabase/functions/import-product-data/parse-amazon.ts`.
 */

/** A single review embedded in a /dp/ page. */
export interface ParsedReview {
  reviewerName: string;
  rating: number;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

/** A single product image with its position and role. */
export interface ParsedProductImage {
  url: string;
  type: 'main' | 'secondary';
  position: number;
}

/** Structured product data parsed from an Amazon /dp/ listing. */
export interface ParsedAmazonProduct {
  asin: string;
  title: string;
  price: number;
  rating: number;
  reviewCount: number;
  bullets: string[];
  description: string;
  images: ParsedProductImage[];
  reviews: ParsedReview[];
  parsedAt: string;
}

/** Result envelope for {@link parseAmazonProduct}. */
export interface ParseAmazonResult {
  success: boolean;
  data?: ParsedAmazonProduct;
  error?: string;
}

const MAX_BULLETS = 10;
const MAX_IMAGES = 15;
const MAX_DESCRIPTION_CHARS = 2000;
const MIN_REVIEW_BODY_CHARS = 10;

/**
 * Parse Amazon /dp/ markdown + HTML into structured product data.
 *
 * @param markdown - Firecrawl `data.markdown` for the /dp/ page.
 * @param html - Firecrawl `data.html` for the /dp/ page.
 * @param asin - The ASIN being parsed (echoed into the result).
 */
export function parseAmazonProduct(
  markdown: string,
  html: string,
  asin: string,
): ParseAmazonResult {
  try {
    const title = extractTitle(markdown, html);
    const price = extractPrice(markdown);
    const rating = extractRating(markdown);
    const reviewCount = extractReviewCount(markdown);
    const bullets = extractBullets(markdown, html);
    const description = extractDescription(markdown);
    const images = extractImages(markdown, html);
    const reviews = extractReviews(html);

    return {
      success: true,
      data: {
        asin,
        title,
        price,
        rating,
        reviewCount,
        bullets: bullets.slice(0, MAX_BULLETS),
        description,
        images,
        reviews,
        parsedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Extract the product title (HTML productTitle → markdown heading → first long line). */
function extractTitle(markdown: string, html: string): string {
  // PRIORITY 1: HTML productTitle (most reliable)
  const htmlTitleMatch = html.match(/<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i);
  if (htmlTitleMatch) {
    return htmlTitleMatch[1].trim();
  }

  // PRIORITY 2: Markdown heading (skip accessibility headings)
  const markdownHeadings = markdown.match(/^#\s+(.+)$/gm);
  if (markdownHeadings) {
    const accessibilityKeywords = [
      'Product summary', 'Keyboard shortcut', 'Skip to main content',
      'Navigation', 'Menu',
    ];

    for (const heading of markdownHeadings) {
      const headingText = heading.replace(/^#\s+/, '').trim();
      const isAccessibility = accessibilityKeywords.some((k) => headingText.includes(k));

      if (!isAccessibility && headingText.length > 50) {
        return headingText;
      }
    }
  }

  // PRIORITY 3: First long line
  const lines = markdown.split('\n').filter((line) => line.trim().length > 50);
  return lines[0]?.trim() || 'Unknown Title';
}

/** Extract the first price from markdown. Returns 0 when none found. */
function extractPrice(markdown: string): number {
  const pricePatterns = [
    /\$(\d+\.\d{2})/,
    /Price:\s*\$(\d+\.\d{2})/i,
    /(\d+\.\d{2})\s*USD/i,
  ];

  for (const pattern of pricePatterns) {
    const priceMatch = markdown.match(pattern);
    if (priceMatch) {
      return parseFloat(priceMatch[1]);
    }
  }

  return 0;
}

/** Extract the star rating from markdown. Returns 0 when none found. */
function extractRating(markdown: string): number {
  const ratingPatterns = [
    /(\d+\.\d+)\s*out\s*of\s*5\s*stars/i,
    /(\d+\.\d+)\s*★/,
    /(\d+\.\d+)\s*stars/i,
  ];

  for (const pattern of ratingPatterns) {
    const ratingMatch = markdown.match(pattern);
    if (ratingMatch) {
      return parseFloat(ratingMatch[1]);
    }
  }

  return 0;
}

/** Extract the review/rating count from markdown. Returns 0 when none found. */
function extractReviewCount(markdown: string): number {
  const reviewPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*ratings/i,
    /(\d{1,3}(?:,\d{3})*)\s*reviews/i,
    /(\d+)\s*customer\s*reviews/i,
  ];

  for (const pattern of reviewPatterns) {
    const reviewMatch = markdown.match(pattern);
    if (reviewMatch) {
      return parseInt(reviewMatch[1].replace(/,/g, ''), 10);
    }
  }

  return 0;
}

/**
 * Extract the inner HTML of the element whose opening tag begins at `openTagStart`,
 * by walking <div> open/close tags and tracking depth. The naive non-greedy regex
 * (`[\\s\\S]*?<\\/div>`) stops at the FIRST close tag, which truncated Amazon's
 * nested feature-bullets markup to ~1 bullet.
 */
function extractBalancedDivInner(html: string, openTagStart: number): string {
  const openTagEnd = html.indexOf('>', openTagStart);
  if (openTagEnd === -1) return '';

  const tagPattern = /<div\b[^>]*>|<\/div>/gi;
  tagPattern.lastIndex = openTagEnd + 1;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    depth += match[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      return html.slice(openTagEnd + 1, match.index);
    }
  }
  return '';
}

/** Extract feature bullets (HTML feature-bullets → filtered markdown bullets). */
function extractBullets(markdown: string, html: string): string[] {
  const bullets: string[] = [];

  // PRIORITY 1: HTML feature-bullets (depth-aware — see extractBalancedDivInner)
  const featureBulletsOpen = html.search(/<div[^>]*id="feature-bullets"[^>]*>/i);

  if (featureBulletsOpen !== -1) {
    const bulletsSection = extractBalancedDivInner(html, featureBulletsOpen);
    const htmlBullets = bulletsSection.match(
      /<span[^>]*class="a-list-item"[^>]*>([\s\S]*?)<\/span>/gi,
    );

    if (htmlBullets) {
      for (const bullet of htmlBullets) {
        const cleaned = bullet
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleaned.length > 20 && cleaned.length < 500) {
          bullets.push(cleaned);
        }
      }
    }
  }

  // PRIORITY 2: Markdown bullets with filtering
  if (bullets.length === 0) {
    const markdownBullets = markdown.match(/^[*-]\s+(.+)$/gm);
    if (markdownBullets) {
      const excludePatterns = [
        /^Customer Questions/i,
        /^Product Details/i,
        /^Technical Details/i,
        /^Additional Information/i,
        /^See more product details/i,
        /^\d+\.\d+\s*out of/i,
        /^Reviewed in/i,
        /^Read more$/i,
        /^Show more$/i,
      ];

      for (const bullet of markdownBullets) {
        const cleaned = bullet.replace(/^[*-]\s+/, '').trim();
        const shouldExclude = excludePatterns.some((pattern) => pattern.test(cleaned));

        if (!shouldExclude && cleaned.length > 20 && cleaned.length < 500) {
          bullets.push(cleaned);
        }
      }
    }
  }

  return bullets;
}

/** Extract the product description from markdown, capped at 2000 chars. */
function extractDescription(markdown: string): string {
  const descriptionMatch = markdown.match(
    /(?:Product Description|Description|About this item)[:\s]*\n+((?:.+\n?)+)/i,
  );
  if (descriptionMatch) {
    return descriptionMatch[1].trim().substring(0, MAX_DESCRIPTION_CHARS);
  }
  return '';
}

/** Extract product images (imageBlock → fallback to all media images), capped at 15. */
function extractImages(markdown: string, html: string): ParsedProductImage[] {
  const images: ParsedProductImage[] = [];
  const imageBaseIds = new Map<string, string>();
  const imagePattern = /https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9+_-]+)\./g;

  // PRIORITY 1: imageBlock section
  const imageBlockMatch = html.match(/<div[^>]*id="imageBlock"[^>]*>([\s\S]*?)<\/div>/i);

  if (imageBlockMatch) {
    const imageSection = imageBlockMatch[1];
    for (const match of imageSection.matchAll(imagePattern)) {
      const fullUrl = match[0];
      const baseId = match[1];
      if (!imageBaseIds.has(baseId)) {
        imageBaseIds.set(baseId, fullUrl);
      }
    }
  }

  // PRIORITY 2: Fallback to all images (markdown then HTML)
  if (imageBaseIds.size === 0) {
    for (const match of markdown.matchAll(imagePattern)) {
      const fullUrl = match[0];
      const baseId = match[1];
      if (!imageBaseIds.has(baseId)) {
        imageBaseIds.set(baseId, fullUrl);
      }
    }
    for (const match of html.matchAll(imagePattern)) {
      const fullUrl = match[0];
      const baseId = match[1];
      if (!imageBaseIds.has(baseId)) {
        imageBaseIds.set(baseId, fullUrl);
      }
    }
  }

  // Convert to high-res URLs (limit to 15)
  const imageUrls = Array.from(imageBaseIds.values()).slice(0, MAX_IMAGES);
  imageUrls.forEach((url, index) => {
    images.push({
      url: toHighResUrl(url),
      type: index === 0 ? 'main' : 'secondary',
      position: index + 1,
    });
  });

  return images;
}

/** Normalize a media-amazon image URL to a high-res variant with a valid extension. */
function toHighResUrl(url: string): string {
  if (url.endsWith('.') && !url.includes('._')) {
    // e.g. "https://m.media-amazon.com/images/I/41YxhSU+q9L."
    return `${url}_AC_SL1500_.jpg`;
  }

  if (url.match(/\._[A-Z0-9_]+\./)) {
    // e.g. "._AC_UL320_." → "._AC_SL1500_."
    let fixedUrl = url.replace(/\._[A-Z0-9_]+\./, '._AC_SL1500_.');
    if (!fixedUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
      fixedUrl += 'jpg';
    }
    return fixedUrl;
  }

  if (!url.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return `${url}.jpg`;
  }

  return url;
}

/**
 * Extract embedded reviews from /dp/ HTML using Amazon's modern review hooks.
 * Expect ~8 reviews per page.
 */
function extractReviews(html: string): ParsedReview[] {
  const reviews: ParsedReview[] = [];
  const blockPattern = /<(?:div|li)[^>]*data-hook="review"[^>]*>/gi;

  const starts: number[] = [];
  for (const match of html.matchAll(blockPattern)) {
    if (match.index !== undefined) {
      starts.push(match.index);
    }
  }

  for (let i = 0; i < starts.length; i++) {
    const blockStart = starts[i];
    const blockEnd = i + 1 < starts.length ? starts[i + 1] : html.length;
    const block = html.slice(blockStart, blockEnd);

    const body = extractReviewBody(block);
    if (body.length < MIN_REVIEW_BODY_CHARS) {
      continue;
    }

    reviews.push({
      reviewerName: extractReviewerName(block),
      rating: extractReviewRating(block),
      title: extractReviewTitle(block),
      body,
      date: extractReviewDate(block),
      verified: block.includes('data-hook="avp-badge"'),
    });
  }

  return reviews;
}

/**
 * Amazon wraps every review body in collapsed/expanded "teaser" helper text that
 * is visually hidden but lives in the DOM. Strip it so it never leaks into bodies.
 */
const REVIEW_TEASER_NOISE = [
  'Brief content visible, double tap to read full content.',
  'Full content visible, double tap to read brief content.',
];

/** Extract a review body from a single review block (data-hook="reviewText"). */
function extractReviewBody(block: string): string {
  const match = block.match(/data-hook="reviewText"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
    ?? block.match(/data-hook="reviewText"[^>]*>([\s\S]*?)$/i);
  if (!match) {
    return '';
  }

  let body = stripHtml(match[1]);
  for (const noise of REVIEW_TEASER_NOISE) {
    body = body.split(noise).join(' ');
  }
  return body.replace(/\s+/g, ' ').trim();
}

/** Extract a review title from a single review block (data-hook="reviewTitle"). */
function extractReviewTitle(block: string): string {
  const match = block.match(/data-hook="reviewTitle"[^>]*>([\s\S]*?)<\/(?:span|h5|a)>/i);
  return match ? stripHtml(match[1]) : '';
}

/** Extract a review's star rating from a single review block ("{n} out of 5 stars"). */
function extractReviewRating(block: string): number {
  const match = block.match(/(\d+(?:\.\d+)?)\s*out\s*of\s*5\s*stars/i);
  return match ? parseFloat(match[1]) : 0;
}

/** Extract a reviewer's display name from a single review block (a-profile-name). */
function extractReviewerName(block: string): string {
  const match = block.match(/class="a-profile-name"[^>]*>([\s\S]*?)<\/span>/i);
  return match ? stripHtml(match[1]) : '';
}

/** Extract a review's date string from a single review block (data-hook="review-date"). */
function extractReviewDate(block: string): string {
  const match = block.match(/data-hook="review-date"[^>]*>([\s\S]*?)<\/span>/i);
  return match ? stripHtml(match[1]) : '';
}

/** Strip HTML tags and collapse whitespace. */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Heuristic: does this parse look like a REAL product listing rather than
 * Amazon's error/dog page (which Firecrawl happily scrapes with HTTP 200)?
 * A real /dp/ page always exposes a plain-text productTitle and at least one
 * of: rating, review count, bullets, or embedded reviews. The error page's
 * "title" falls back to a markdown image link for the Amazon logo.
 */
export function isLikelyRealListing(product: ParsedAmazonProduct): boolean {
  const title = product.title ?? '';
  const titleLooksReal =
    title.length > 0 &&
    title !== 'Unknown Title' &&
    !/https?:\/\//i.test(title) &&
    !title.includes('![') &&
    !/page not found|couldn't find that page/i.test(title);
  const hasSignal =
    product.rating > 0 ||
    product.reviewCount > 0 ||
    product.bullets.length > 0 ||
    product.reviews.length > 0;
  return titleLooksReal && hasSignal;
}
