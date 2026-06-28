/**
 * Pixii API client (Content-Generation feature).
 *
 * Pixii (https://api.pixii.ai) is an async, image-generation API for Amazon /
 * Shopify / TikTok product visuals. It powers the VISUAL funnel pieces of the
 * Brand Funnel Tracker's generate-content interface:
 *   - listing_builder → listing gallery images (main + gallery)
 *   - a_plus          → A+ module images
 *   - scale           → replicate a visual identity across the catalog
 * Pixii does NOT generate copy or email — those route to the in-house
 * brand-copy-generator (provider = 'claude') instead.
 *
 * Boundary discipline (mirrors dataforseo.ts / review-scraper):
 *  - Never throws across the public boundary. Every method returns a typed
 *    result with a discriminating `status` so the edge function can branch.
 *  - Credentials are resolved lazily (no top-level `Deno.env` read), so this
 *    module imports cleanly under vitest. `apiKey`/`baseUrl` can be injected.
 *  - This client only RELAYS what Pixii returns. It never fabricates images.
 *
 * Async pattern: POST create → `{ job_id }`; poll GET /v1/api/jobs/{job_id}
 * every ~5s until status is `completed` or `failed`. Output URLs expire after
 * 7 days, so the caller must persist completed images to durable storage.
 */

const PIXII_DEFAULT_BASE = 'https://api.pixii.ai';
const PIXII_PATH_PREFIX = '/v1/api';

// ── Pixii enums (verbatim from the API docs) ─────────────────────────────────

/** ISO marketplace codes Pixii accepts on every endpoint. */
export const PIXII_COUNTRY_CODES = [
  'AE', 'AU', 'BE', 'BR', 'CA', 'CN', 'DE', 'EG', 'ES', 'FR', 'GB', 'IE', 'IN',
  'IT', 'JP', 'MX', 'NL', 'PL', 'SA', 'SE', 'SG', 'TR', 'UK', 'US', 'ZA',
] as const;
export type PixiiCountryCode = (typeof PIXII_COUNTRY_CODES)[number];

/** listing_builder `listing_type`. */
export const PIXII_LISTING_TYPES = [
  'amazon_listing', 'amazon_main_images', 'amazon_mobile_listing',
  'shopify_listing', 'tiktok_listing',
] as const;
export type PixiiListingType = (typeof PIXII_LISTING_TYPES)[number];

/** a_plus `types[]`. */
export const PIXII_APLUS_TYPES = ['A+ Basic', 'A+ Premium', 'A+ Premium Mobile'] as const;
export type PixiiAPlusType = (typeof PIXII_APLUS_TYPES)[number];

/** scale `scale_mode`. */
export const PIXII_SCALE_MODES = ['catalog', 'inspire', 'variation', 'language'] as const;
export type PixiiScaleMode = (typeof PIXII_SCALE_MODES)[number];

export type PixiiJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ── Wire types ───────────────────────────────────────────────────────────────

export interface PixiiWireError {
  code: string;
  message: string;
  detail?: string | null;
  retry_after?: number;
}

/** A single generated asset inside a completed job's `output.ads`. */
export interface PixiiAd {
  /** listing_builder / scale carry `preview_url`; a_plus carries `preview`. */
  preview_url?: string | null;
  preview?: string | null;
  /** a_plus: individual module image URLs. */
  modules?: string[];
  /** a_plus: which requested type this ad is. */
  type?: string | null;
  error?: { code: string; message: string } | null;
}

export interface PixiiJob {
  id?: string;
  job_id?: string;
  job_type?: string;
  status: PixiiJobStatus;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  credit_cost?: number;
  credits_refunded?: number;
  remaining_credits?: number;
  output?: { ads?: PixiiAd[] } | null;
  error_code?: string | null;
}

export interface PixiiConfig {
  apiKey: string;
  baseUrl?: string;
}

export type PixiiResult =
  | { status: 'ok'; job: PixiiJob }
  | { status: 'not_configured' }
  | { status: 'error'; httpStatus?: number; code?: string; message: string; retryAfter?: number };

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface ListingBuilderInput {
  asin: string;
  country_code: string;
  listing_type: string;
  main_image_url?: string;
  other_image_urls?: string[];
}

export interface APlusInput {
  asin: string;
  country_code: string;
  types: string[];
  main_image_url?: string;
  other_image_urls?: string[];
  user_prompt?: string;
}

export interface ScaleItem {
  preview_url: string;
  platform: string;
  asset_type: string;
}

export interface ScaleInput {
  asin: string;
  country_code: string;
  scale_mode: string;
  main_image_input?: string;
  other_images_input?: string[];
  user_prompt?: string;
  items: ScaleItem[];
}

// ── Config resolution (lazy, Deno-free importable) ───────────────────────────

/**
 * Resolve Pixii config. Reads Deno env only when present (so the module imports
 * under vitest without a `Deno` global). Returns null when no API key is set.
 */
export function resolvePixiiConfig(override?: Partial<PixiiConfig>): PixiiConfig | null {
  const env =
    typeof (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno !== 'undefined'
      ? (globalThis as { Deno: { env: { get(k: string): string | undefined } } }).Deno.env
      : undefined;
  const apiKey = override?.apiKey ?? env?.get('PIXII_API_KEY');
  if (!apiKey) return null;
  const baseUrl = (override?.baseUrl ?? env?.get('PIXII_API_BASE') ?? PIXII_DEFAULT_BASE).replace(/\/+$/, '');
  return { apiKey, baseUrl };
}

// ── Pure helpers (validation, parsing, SSRF guard) ───────────────────────────

/** Validate a listing_builder input; returns a human error string or null. */
export function validateListingBuilderInput(input: Partial<ListingBuilderInput>): string | null {
  if (!input.asin || !input.asin.trim()) return 'asin is required';
  if (!input.country_code || !PIXII_COUNTRY_CODES.includes(input.country_code as PixiiCountryCode)) {
    return `country_code must be one of: ${PIXII_COUNTRY_CODES.join(', ')}`;
  }
  if (!input.listing_type || !PIXII_LISTING_TYPES.includes(input.listing_type as PixiiListingType)) {
    return `listing_type must be one of: ${PIXII_LISTING_TYPES.join(', ')}`;
  }
  if (input.other_image_urls && input.other_image_urls.length === 0) {
    return 'other_image_urls, if provided, must have at least 1 item';
  }
  return null;
}

/** Validate an a_plus input; returns a human error string or null. */
export function validateAPlusInput(input: Partial<APlusInput>): string | null {
  if (!input.asin || !input.asin.trim()) return 'asin is required';
  if (!input.country_code || !PIXII_COUNTRY_CODES.includes(input.country_code as PixiiCountryCode)) {
    return `country_code must be one of: ${PIXII_COUNTRY_CODES.join(', ')}`;
  }
  if (!input.types || input.types.length === 0) {
    return `types must include at least one of: ${PIXII_APLUS_TYPES.join(', ')}`;
  }
  const bad = input.types.find((t) => !PIXII_APLUS_TYPES.includes(t as PixiiAPlusType));
  if (bad) return `unknown A+ type "${bad}". Allowed: ${PIXII_APLUS_TYPES.join(', ')}`;
  return null;
}

/**
 * Extract every image URL from a completed job's output, flattened across ads
 * and (for A+) their module lists. Failed ads (error set, no preview) are skipped.
 */
export function imageUrlsFromJob(job: PixiiJob): string[] {
  const ads = job.output?.ads ?? [];
  const urls: string[] = [];
  for (const ad of ads) {
    if (ad.preview_url) urls.push(ad.preview_url);
    if (ad.preview) urls.push(ad.preview);
    for (const m of ad.modules ?? []) if (m) urls.push(m);
  }
  return urls;
}

/** Per-ad failures inside an otherwise-completed job (for partial-result UX). */
export function adErrorsFromJob(job: PixiiJob): Array<{ code: string; message: string }> {
  return (job.output?.ads ?? [])
    .map((a) => a.error)
    .filter((e): e is { code: string; message: string } => !!e);
}

/**
 * SSRF guard for the image-download step: only fetch from Pixii's own CDN over
 * HTTPS. Job output is produced by Pixii (authenticated by our key), but we still
 * refuse to fetch arbitrary hosts before writing them into our storage bucket.
 */
export function isPixiiCdnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return u.hostname === 'pixii.ai' || u.hostname.endsWith('.pixii.ai');
  } catch {
    return false;
  }
}

/** Map a Pixii wire envelope / HTTP failure to a typed error result. */
function wireError(httpStatus: number, body: unknown): Extract<PixiiResult, { status: 'error' }> {
  const err = (body as { error?: PixiiWireError } | null)?.error;
  if (err) {
    return { status: 'error', httpStatus, code: err.code, message: err.message, retryAfter: err.retry_after };
  }
  return { status: 'error', httpStatus, message: `pixii http ${httpStatus}` };
}

// ── HTTP methods ─────────────────────────────────────────────────────────────

async function postJob(
  path: string,
  body: unknown,
  override?: Partial<PixiiConfig>,
): Promise<PixiiResult> {
  const config = resolvePixiiConfig(override);
  if (!config) return { status: 'not_configured' };
  try {
    const resp = await fetch(`${config.baseUrl}${PIXII_PATH_PREFIX}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) return wireError(resp.status, json);
    const data = (json as { data?: PixiiJob } | null)?.data;
    if (!data) return { status: 'error', httpStatus: resp.status, message: 'pixii: empty response data' };
    return { status: 'ok', job: data };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'pixii request failed' };
  }
}

/** POST /v1/api/listing_builder — create a listing-image generation job. */
export function createListingBuilder(
  input: ListingBuilderInput,
  override?: Partial<PixiiConfig>,
): Promise<PixiiResult> {
  return postJob('/listing_builder', input, override);
}

/** POST /v1/api/a_plus — create an A+ content generation job. */
export function createAPlus(input: APlusInput, override?: Partial<PixiiConfig>): Promise<PixiiResult> {
  return postJob('/a_plus', input, override);
}

/** POST /v1/api/scale — replicate a visual identity across the catalog. */
export function createScale(input: ScaleInput, override?: Partial<PixiiConfig>): Promise<PixiiResult> {
  return postJob('/scale', input, override);
}

/** GET /v1/api/jobs/{job_id} — poll a job's status/output. */
export async function getJob(jobId: string, override?: Partial<PixiiConfig>): Promise<PixiiResult> {
  const config = resolvePixiiConfig(override);
  if (!config) return { status: 'not_configured' };
  try {
    const resp = await fetch(`${config.baseUrl}${PIXII_PATH_PREFIX}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) return wireError(resp.status, json);
    const data = (json as { data?: PixiiJob } | null)?.data;
    if (!data) return { status: 'error', httpStatus: resp.status, message: 'pixii: empty job data' };
    return { status: 'ok', job: data };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'pixii job poll failed' };
  }
}
