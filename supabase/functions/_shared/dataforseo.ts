/**
 * DataForSEO server-side API client (Competitor-Agents feature).
 *
 * Adopted as the Amazon data source for the marketplace-listing modality
 * (plan §1 / §3): structured Amazon data by ASIN + top-N competitor discovery
 * by keyword/category + reviews. Server-side ONLY — Basic auth uses
 * `DATAFORSEO_USERNAME`/`DATAFORSEO_PASSWORD` (Supabase function secrets).
 *
 * Boundary discipline (mirrors review-scraper / competitor-discovery):
 *  - Never throws across the public boundary. Every method returns a typed
 *    result with a discriminating `status` so the caller (the edge function)
 *    can branch instead of catching.
 *  - If credentials are missing, returns `{ status: 'not_configured' }` — a
 *    clearly-typed result, never an exception. The analyzer treats this as a
 *    fallback signal (CSE/Firecrawl), not a failure.
 *  - Grounding gate: this client only RELAYS what DataForSEO returns. It never
 *    fabricates competitors, prices, titles, or reviews. Absent fields stay
 *    absent (undefined), they are not defaulted to invented values.
 *
 * Pure logic (request building, response normalization) is exported separately
 * and is Deno-free so it can be unit-tested under vitest (no top-level
 * `Deno.env` read — credentials are resolved lazily, see `resolveCredentials`).
 *
 * DataForSEO Amazon endpoints used (Live "advanced" tasks, POST array body):
 *  - /v3/merchant/amazon/products/task_post   (search → top-N by keyword)
 *  - /v3/merchant/amazon/asin/task_post        (product detail by ASIN)
 *  - /v3/merchant/amazon/reviews/task_post     (reviews by ASIN)
 * The Live variants (.../live/advanced) return inline so we avoid the
 * task_post → task_get polling loop in the edge runtime.
 */

const DATAFORSEO_BASE = 'https://api.dataforseo.com';

/** Amazon marketplace → DataForSEO `location_name` + `language_code`. */
interface MarketplaceProfile {
  location_name: string;
  language_code: string;
  /** Amazon host used to build canonical product URLs from an ASIN. */
  host: string;
}

const MARKETPLACE_PROFILES: Record<string, MarketplaceProfile> = {
  'amazon.com': { location_name: 'United States', language_code: 'en_US', host: 'www.amazon.com' },
  'amazon.co.uk': { location_name: 'United Kingdom', language_code: 'en_GB', host: 'www.amazon.co.uk' },
  'amazon.ca': { location_name: 'Canada', language_code: 'en_CA', host: 'www.amazon.ca' },
  'amazon.de': { location_name: 'Germany', language_code: 'de_DE', host: 'www.amazon.de' },
  'amazon.com.au': { location_name: 'Australia', language_code: 'en_AU', host: 'www.amazon.com.au' },
};

const DEFAULT_MARKETPLACE = 'amazon.com';

/** Resolve a marketplace string to a profile, defaulting to amazon.com. */
export function resolveMarketplace(marketplace?: string): MarketplaceProfile {
  const key = (marketplace ?? DEFAULT_MARKETPLACE).trim().toLowerCase();
  return MARKETPLACE_PROFILES[key] ?? MARKETPLACE_PROFILES[DEFAULT_MARKETPLACE];
}

/** Build the canonical Amazon product URL for an ASIN on a marketplace host. */
export function amazonProductUrl(asin: string, marketplace?: string): string {
  return `https://${resolveMarketplace(marketplace).host}/dp/${asin}`;
}

// ── Public result types (discriminated on `status`) ──────────────────────────

export type DataForSeoStatus = 'ok' | 'not_configured' | 'error';

export interface DataForSeoCredentials {
  username: string;
  password: string;
}

/** Normalized Amazon product (grounded — fields absent in source stay undefined). */
export interface AmazonProduct {
  asin: string;
  title?: string;
  brand?: string;
  url?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviewsCount?: number;
  bullets: string[];
  description?: string;
}

/** A single normalized Amazon review (grounded). */
export interface AmazonReview {
  reviewerName?: string;
  rating?: number;
  title?: string;
  body: string;
  verified?: boolean;
  date?: string;
}

export interface ProductResult {
  status: DataForSeoStatus;
  product?: AmazonProduct;
  error?: string;
}

export interface CompetitorsResult {
  status: DataForSeoStatus;
  /** Top-N competitor products (grounded; each carries its source ASIN/url). */
  products: AmazonProduct[];
  error?: string;
}

export interface ReviewsResult {
  status: DataForSeoStatus;
  reviews: AmazonReview[];
  error?: string;
}

// ── Credential resolution (lazy, Deno-free importable) ───────────────────────

/**
 * Resolve credentials. Reads Deno env only when present (so the module can be
 * imported under vitest without a `Deno` global). Returns null when either
 * secret is missing — the caller maps that to a `not_configured` result.
 */
export function resolveCredentials(
  override?: Partial<DataForSeoCredentials>,
): DataForSeoCredentials | null {
  const denoEnv =
    typeof (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno !== 'undefined'
      ? (globalThis as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env
      : undefined;
  const username = override?.username ?? denoEnv?.get('DATAFORSEO_USERNAME') ?? '';
  const password = override?.password ?? denoEnv?.get('DATAFORSEO_PASSWORD') ?? '';
  if (!username || !password) return null;
  return { username, password };
}

/** Build the Basic-auth Authorization header value from credentials. */
export function basicAuthHeader(creds: DataForSeoCredentials): string {
  // btoa is available in Deno and modern Node/jsdom; encode "user:pass".
  return `Basic ${btoa(`${creds.username}:${creds.password}`)}`;
}

// ── Response normalization (pure, grounded, unit-tested) ─────────────────────

/** Coerce a value to a finite number or undefined (never NaN, never invented). */
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** Coerce a scalar-or-{value} shape to a finite number (DataForSEO uses both). */
function numField(v: unknown): number | undefined {
  if (v && typeof v === 'object') return num((v as Record<string, unknown>).value);
  return num(v);
}

/**
 * Normalize a DataForSEO Amazon product/asin item into our grounded shape.
 * Tolerant: shapes vary slightly between the `products` and `asin` endpoints
 * (bullets live under `product_information`, `bullet_points`, or `description`).
 * Returns null when the item has no ASIN (nothing to anchor evidence to).
 */
export function normalizeAmazonItem(raw: unknown, marketplace?: string): AmazonProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const asin = str(item.asin) ?? str(item.data_asin) ?? str(item.product_asin);
  if (!asin) return null;

  // Bullets can arrive as bullet_points[], product_information[], or feature[].
  const bulletSources = [item.bullet_points, item.product_information, item.feature, item.bullets];
  let bullets: string[] = [];
  for (const source of bulletSources) {
    if (Array.isArray(source)) {
      bullets = source
        .map((b) => {
          if (typeof b === 'string') return b.trim();
          if (b && typeof b === 'object') {
            const o = b as Record<string, unknown>;
            return str(o.value) ?? str(o.text) ?? str(o.title) ?? '';
          }
          return '';
        })
        .filter((b) => b.length > 0);
      if (bullets.length > 0) break;
    }
  }

  const priceObj = (item.price ?? item.price_from) as unknown;
  let price: number | undefined;
  let currency: string | undefined;
  if (priceObj && typeof priceObj === 'object') {
    const p = priceObj as Record<string, unknown>;
    price = num(p.current ?? p.value ?? p.from);
    currency = str(p.currency);
  } else {
    price = num(priceObj);
    currency = str(item.currency);
  }

  return {
    asin,
    title: str(item.title) ?? str(item.product_title) ?? str(item.name),
    brand: str(item.brand) ?? str(item.manufacturer),
    url: str(item.url) ?? str(item.product_url) ?? amazonProductUrl(asin, marketplace),
    imageUrl: str(item.image_url) ?? str(item.main_image) ?? str(item.image),
    price,
    currency,
    rating: numField(item.rating),
    reviewsCount: num(item.reviews_count ?? item.ratings_count),
    bullets,
    description: str(item.description),
  };
}

/** Normalize a DataForSEO Amazon review item into our grounded shape. */
export function normalizeAmazonReview(raw: unknown): AmazonReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const body = str(item.review_text) ?? str(item.text) ?? str(item.body);
  if (!body) return null;
  // user_profile may be a string or a {name} object; rating a number or {value}.
  const reviewerName = item.user_profile && typeof item.user_profile === 'object'
    ? str((item.user_profile as Record<string, unknown>).name)
    : str(item.user_profile);
  return {
    reviewerName: reviewerName ?? str(item.author),
    rating: numField(item.rating),
    title: str(item.title),
    body,
    verified: typeof item.verified === 'boolean' ? item.verified : undefined,
    date: str(item.publication_date) ?? str(item.date),
  };
}

/**
 * Walk a DataForSEO Live "advanced" envelope down to the items array.
 * Shape: { tasks: [ { result: [ { items: [...] } ] } ] }. Tolerant of nulls.
 */
export function extractItems(envelope: unknown): Record<string, unknown>[] {
  if (!envelope || typeof envelope !== 'object') return [];
  const tasks = (envelope as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];
  const out: Record<string, unknown>[] = [];
  for (const task of tasks) {
    const result = (task as { result?: unknown })?.result;
    if (!Array.isArray(result)) continue;
    for (const r of result) {
      const items = (r as { items?: unknown })?.items;
      if (Array.isArray(items)) {
        for (const it of items) {
          if (it && typeof it === 'object') out.push(it as Record<string, unknown>);
        }
      }
    }
  }
  return out;
}

// ── HTTP layer ───────────────────────────────────────────────────────────────

/**
 * POST a DataForSEO Live task. Returns the parsed JSON envelope, or throws —
 * callers wrap this so nothing escapes the public boundary.
 */
async function postLive(
  path: string,
  body: unknown[],
  creds: DataForSeoCredentials,
): Promise<unknown> {
  const response = await fetch(`${DATAFORSEO_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(creds),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    // Log status + a bounded body slice only (no creds, no PII).
    console.error(`[dataforseo] ${path} HTTP error:`, response.status, text.slice(0, 300));
    throw new Error(`DataForSEO API error: ${response.status}`);
  }
  return response.json();
}

// ── Public API (never throws across the boundary) ────────────────────────────

/**
 * Fetch one Amazon product by ASIN. Grounded: returns exactly what DataForSEO
 * reports, normalized. `not_configured` when secrets are missing.
 */
export async function getAmazonProductByAsin(
  asin: string,
  marketplace?: string,
  override?: Partial<DataForSeoCredentials>,
): Promise<ProductResult> {
  const creds = resolveCredentials(override);
  if (!creds) return { status: 'not_configured' };
  const profile = resolveMarketplace(marketplace);
  try {
    const envelope = await postLive(
      '/v3/merchant/amazon/asin/live/advanced',
      [{ asin, location_name: profile.location_name, language_code: profile.language_code }],
      creds,
    );
    const items = extractItems(envelope);
    const product = items
      .map((it) => normalizeAmazonItem(it, marketplace))
      .find((p): p is AmazonProduct => p !== null);
    if (!product) return { status: 'ok', product: undefined };
    return { status: 'ok', product };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'unknown' };
  }
}

/**
 * Discover the top-N Amazon competitors for a keyword or category. Grounded:
 * only products DataForSEO returns; capped at `n`.
 */
export async function searchTopCompetitors(
  keywordOrCategory: string,
  marketplace?: string,
  n = 5,
  override?: Partial<DataForSeoCredentials>,
): Promise<CompetitorsResult> {
  const creds = resolveCredentials(override);
  if (!creds) return { status: 'not_configured', products: [] };
  const profile = resolveMarketplace(marketplace);
  const limit = Math.max(1, Math.min(20, Math.floor(n)));
  try {
    const envelope = await postLive(
      '/v3/merchant/amazon/products/live/advanced',
      [{
        keyword: keywordOrCategory,
        location_name: profile.location_name,
        language_code: profile.language_code,
        depth: limit,
      }],
      creds,
    );
    const products = extractItems(envelope)
      .map((it) => normalizeAmazonItem(it, marketplace))
      .filter((p): p is AmazonProduct => p !== null)
      .slice(0, limit);
    return { status: 'ok', products };
  } catch (error) {
    return { status: 'error', products: [], error: error instanceof Error ? error.message : 'unknown' };
  }
}

/**
 * Fetch Amazon reviews for an ASIN. Grounded: only reviews DataForSEO returns.
 */
export async function getAmazonReviews(
  asin: string,
  marketplace?: string,
  limit = 10,
  override?: Partial<DataForSeoCredentials>,
): Promise<ReviewsResult> {
  const creds = resolveCredentials(override);
  if (!creds) return { status: 'not_configured', reviews: [] };
  const profile = resolveMarketplace(marketplace);
  const cap = Math.max(1, Math.min(50, Math.floor(limit)));
  try {
    const envelope = await postLive(
      '/v3/merchant/amazon/reviews/live/advanced',
      [{ asin, location_name: profile.location_name, language_code: profile.language_code, depth: cap }],
      creds,
    );
    const reviews = extractItems(envelope)
      .map((it) => normalizeAmazonReview(it))
      .filter((r): r is AmazonReview => r !== null)
      .slice(0, cap);
    return { status: 'ok', reviews };
  } catch (error) {
    return { status: 'error', reviews: [], error: error instanceof Error ? error.message : 'unknown' };
  }
}
