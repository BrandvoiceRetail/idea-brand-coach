/**
 * Layer 2 (tool) — `ingest_evidence` (OWNED, WRITE, gateWrite — the EVIDENCE intake).
 *
 * Brings real third-party EVIDENCE (manifest §1) into the persisted stores so avatar
 * forensics / the diagnostic can quote it verbatim instead of inventing it:
 *
 *   - `reviews_text` → best-effort chunked into review objects ({reviewer?, rating?,
 *     body}) and frozen as one `evidence_snapshots` row (reviews jsonb). When
 *     `product_id` is supplied (own product), each parsed review is ALSO written as a
 *     `user_product_reviews` row (the richer own-evidence store the resolver reads first).
 *   - `listing_text` → frozen as the same/that snapshot's `listing` jsonb (slot #3).
 *   - `asin` (validated 10-char ASIN) + optional `marketplace` (allowlisted), OR a full
 *     amazon.* product URL → scraped for real reviews via the `review-scraper` edge fn and
 *     frozen exactly like pasted reviews. Inputs that aren't a valid ASIN/Amazon URL are
 *     refused with a note (no arbitrary-host scrape). We never fabricate scraped content.
 *
 * Identity-gated (gateWrite); all writes run on the JWT-bound RLS client scoped to the
 * caller (guardrail #5). Returns the counts written so the caller can confirm intake.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';
import type { EdgeFnClient } from '../edgeFn/client.js';

/** A best-effort parsed review object. `body` is always present; the rest are optional. */
export interface ParsedReview {
  reviewer?: string;
  rating?: number;
  body: string;
}

/** One review row as returned by the `review-scraper` edge fn (ScrapedReview shape). */
interface ScrapedReviewRow {
  reviewerName?: string;
  rating?: number;
  title?: string;
  body?: string;
}

/** `review-scraper` response: one result per requested URL. */
interface ReviewScrapeResponse {
  results?: Array<{ url: string; reviews?: ScrapedReviewRow[]; error?: string }>;
  totalReviews?: number;
}

/**
 * Map a scraped review row onto the ParsedReview shape (title folded into body).
 * Contract with the edge fn's review encoders (reviewsFromJson / the regex parsers):
 * `'Anonymous'` and rating `0` are their "unknown" sentinels, so we drop them rather
 * than store them as real values. If the edge fn ever changes those defaults, update here.
 */
export function toParsedReview(r: ScrapedReviewRow): ParsedReview {
  const body = [r.title?.trim(), r.body?.trim()].filter(Boolean).join(' — ');
  const review: ParsedReview = { body };
  if (r.reviewerName && r.reviewerName !== 'Anonymous') review.reviewer = r.reviewerName;
  if (typeof r.rating === 'number' && r.rating > 0) review.rating = r.rating;
  return review;
}

/** Amazon ASIN: exactly 10 letters/digits (Amazon's fixed format). */
const ASIN_RE = /^[A-Z0-9]{10}$/i;

/** Amazon marketplace TLD suffixes we allow `asin` to be scoped to (default `com`). */
const AMAZON_MARKETPLACES = new Set([
  'com', 'co.uk', 'de', 'fr', 'co.jp', 'ca', 'com.au', 'in', 'com.br', 'com.mx',
  'nl', 'es', 'it', 'se', 'pl', 'com.tr', 'ae', 'sg', 'sa',
]);

/**
 * Build the Amazon /dp/ scrape URL from a validated ASIN + allowlisted marketplace, or
 * accept a full URL only when its host is `amazon.*`. Refuses anything else so a crafted
 * `asin`/`marketplace` can never steer the scraper at an arbitrary host (or inject a path).
 */
export function buildScrapeUrl(asin: string, marketplace?: string): { url: string } | { error: string } {
  const raw = asin.trim();
  if (/^https?:\/\//i.test(raw)) {
    let host: string;
    try {
      host = new URL(raw).hostname.toLowerCase();
    } catch {
      return { error: 'asin looks like a URL but is not parseable' };
    }
    if (!/^(?:www\.)?amazon\.[a-z.]+$/i.test(host)) {
      return { error: 'a URL asin must point at an amazon.* product page' };
    }
    return { url: raw };
  }
  if (!ASIN_RE.test(raw)) {
    return { error: `"${raw}" is not a valid 10-character ASIN or amazon.* URL` };
  }
  const mkt = (marketplace ?? 'com').trim().replace(/^\.+/, '').toLowerCase();
  if (!AMAZON_MARKETPLACES.has(mkt)) {
    return { error: `unknown marketplace "${mkt}" (use one of: ${[...AMAZON_MARKETPLACES].join(', ')})` };
  }
  return { url: `https://www.amazon.${mkt}/dp/${raw}` };
}

const inputSchema = {
  reviews_text: z
    .string()
    .max(100_000)
    .optional()
    .describe('Pasted reviews verbatim (blank-line- or line-separated). Chunked into review objects.'),
  listing_text: z
    .string()
    .max(100_000)
    .optional()
    .describe('Pasted listing copy (title/bullets/A+/description). Frozen as the snapshot listing.'),
  asin: z
    .string()
    .max(2_048)
    .optional()
    .describe(
      'Amazon ASIN (10 letters/digits) or a full amazon.* product URL to scrape for real ' +
        'reviews via the review-scraper edge fn. Scraped reviews are frozen as evidence just ' +
        'like pasted ones; invalid input or zero results degrades to a note (never fabricates).',
    ),
  marketplace: z
    .string()
    .max(12)
    .optional()
    .describe("Amazon marketplace for the asin scrape, e.g. 'com' (default) or 'co.uk'. Ignored when asin is a full URL."),
  source_label: z
    .string()
    .max(500)
    .optional()
    .describe('Human label for provenance (e.g. "InfinityVault /dp/ paste 2026-06"). Stored on the snapshot source.'),
  product_id: z
    .string()
    .optional()
    .describe('Own-product id; when set, parsed reviews are ALSO written to user_product_reviews.'),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level snapshot.'),
};

/**
 * Best-effort chunk pasted review text into review objects. Splits on blank lines first
 * (the common paste shape — one review per paragraph); falls back to one-per-line when
 * there are no blank-line groups. Pulls a leading `N stars`/`N/5`/`★★★★★` rating and a
 * `By <name>` / `<name>:` reviewer when present, but never invents them.
 */
export function parseReviews(text: string): ParsedReview[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const blocks = normalized.includes('\n\n')
    ? normalized.split(/\n{2,}/)
    : normalized.split(/\n+/);
  const reviews: ParsedReview[] = [];
  for (const raw of blocks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const review: ParsedReview = { body: chunk };

    // Rating: "5 stars", "5/5", "Rating: 4", or a run of ★/☆.
    const starGlyphs = chunk.match(/★/g);
    const numeric =
      /(\b[0-5](?:\.\d)?)\s*(?:stars?|\/\s*5)\b/i.exec(chunk) ?? /\brating[:\s]+([0-5](?:\.\d)?)/i.exec(chunk);
    if (numeric) {
      review.rating = Number(numeric[1]);
    } else if (starGlyphs && starGlyphs.length >= 1 && starGlyphs.length <= 5) {
      review.rating = starGlyphs.length;
    }

    // Reviewer: "By <name>" at a line start, or "<name>:" prefix on the first line.
    const byMatch = /(?:^|\n)\s*by\s+([A-Za-z0-9 .'_-]{2,40})/i.exec(chunk);
    if (byMatch) review.reviewer = byMatch[1].trim();

    reviews.push(review);
  }
  return reviews;
}

interface IngestResult {
  snapshot_id: string | null;
  reviews_parsed: number;
  reviews_rows: number;
  listing_captured: boolean;
}

export function registerIngestEvidenceTool(server: McpServer, edge: EdgeFnClient): void {
  server.registerTool(
    'ingest_evidence',
    {
      title: 'Ingest evidence (reviews / listing)',
      description:
        'Write tool: ingest real EVIDENCE so the engine can quote it verbatim. Pass an asin (or Amazon URL) to AUTO-SCRAPE reviews via Firecrawl, and/or paste reviews_text/listing_text. Reviews are chunked into review objects and frozen as an evidence_snapshots row (and, with product_id, written to user_product_reviews); listing copy is frozen as the snapshot listing. Scrape failures degrade to a note — never fabricated content. Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ reviews_text, listing_text, asin, marketplace, source_label, product_id, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const userId = identity.userId as string; // gateWrite guarantees authenticated.
      const supabase = getUserSupabase();
      const notes: string[] = [];

      const parsed = reviews_text ? parseReviews(reviews_text) : [];

      // ASIN scrape: pull real reviews via the review-scraper edge fn (Firecrawl) and merge
      // them into `parsed` so they freeze + write through the same path as pasted reviews.
      // Never fabricate — any failure / empty result becomes a note, not invented content.
      if (asin) {
        const built = buildScrapeUrl(asin, marketplace);
        if ('error' in built) {
          notes.push(`asin-scrape skipped: ${built.error}. Paste reviews via reviews_text instead.`);
        } else {
          const scraped = await edge.invoke<ReviewScrapeResponse>('review-scraper', {
            urls: [built.url],
            maxReviewsPerUrl: 20,
          });
          if (!scraped.ok) {
            notes.push(`asin-scrape failed (${scraped.note ?? 'unavailable'}) — paste reviews via reviews_text instead.`);
          } else {
            const result0 = scraped.data?.results?.[0];
            const scrapedReviews = (result0?.reviews ?? [])
              .map(toParsedReview)
              .filter((r) => r.body.length > 0);
            if (scrapedReviews.length === 0) {
              // Surface a per-URL error (rate limit / disabled / block) over the generic
              // "0 reviews" note so the caller learns the real reason.
              notes.push(
                result0?.error
                  ? `asin-scrape unavailable: ${result0.error}. Try again later or paste reviews via reviews_text.`
                  : `asin-scrape returned 0 reviews from ${built.url} — the page may show few/none; paste them via reviews_text.`,
              );
            } else {
              parsed.push(...scrapedReviews);
              notes.push(`Scraped ${scrapedReviews.length} review(s) from ${built.url}.`);
            }
          }
        }
      }
      const hasListing = typeof listing_text === 'string' && listing_text.trim().length > 0;

      const result: IngestResult = {
        snapshot_id: null,
        reviews_parsed: parsed.length,
        reviews_rows: 0,
        listing_captured: false,
      };

      // 1) Freeze a single snapshot carrying whatever evidence was pasted this call.
      if (parsed.length > 0 || hasListing) {
        const source = source_label ?? (asin ? `asin:${asin}` : 'ingest_evidence:paste');
        const insertRow: Record<string, unknown> = {
          user_id: userId,
          avatar_id: avatar_id ?? null,
          source,
        };
        if (parsed.length > 0) insertRow.reviews = parsed;
        if (hasListing) insertRow.listing = { text: (listing_text as string).trim() };

        const { data, error } = await supabase
          .from('evidence_snapshots')
          .insert(insertRow)
          .select('id')
          .single();
        if (error || !data) {
          safeLog({ level: 'warn', event: 'tool.ingest_evidence.snapshot_failed', caller: userTag(identity) });
          return {
            content: [{ type: 'text' as const, text: `ingest_evidence failed: ${error?.message ?? 'no snapshot row'}` }],
            structuredContent: { ok: false, note: error?.message ?? 'snapshot insert returned no row', notes },
            isError: true,
          };
        }
        result.snapshot_id = (data as { id: string }).id;
        result.listing_captured = hasListing;
      }

      // 2) Own-product reviews: write the richer per-review rows the resolver reads first.
      //    Never-fail: a failed reviews write annotates a note but does not void the snapshot.
      if (product_id && parsed.length > 0) {
        const rows = parsed.map((r) => ({
          product_id,
          reviewer_name: r.reviewer ?? null,
          rating: r.rating ?? null,
          body: r.body,
          source_url: source_label ?? null,
        }));
        const { data, error } = await supabase.from('user_product_reviews').insert(rows).select('id');
        if (error || !data) {
          notes.push(`user_product_reviews write degraded: ${error?.message ?? 'no rows returned'}`);
        } else {
          result.reviews_rows = (data as unknown[]).length;
        }
      }

      const ingestedNothing = parsed.length === 0 && !hasListing;
      safeLog({
        event: 'tool.ingest_evidence',
        caller: userTag(identity),
        reviews_parsed: result.reviews_parsed,
        reviews_rows: result.reviews_rows,
        listing: result.listing_captured,
        asin_scraped: Boolean(asin),
      });
      if (!ingestedNothing) {
        captureMcpEvent(userId, 'mcp_evidence_ingested', {
          reviews_parsed: result.reviews_parsed,
          listing_captured: result.listing_captured,
        });
      }

      const summary = ingestedNothing
        ? asin
          ? 'No reviews ingested for that asin (see notes — scrape failed or returned none).'
          : 'Nothing to ingest — supply reviews_text, listing_text, or an asin.'
        : `Ingested ${result.reviews_parsed} review(s)` +
          (result.reviews_rows ? ` (${result.reviews_rows} product-review rows)` : '') +
          (result.listing_captured ? ' + listing copy' : '') +
          (result.snapshot_id ? `; snapshot ${result.snapshot_id}.` : '.');

      return {
        content: [{ type: 'text' as const, text: summary }],
        structuredContent: {
          ok: !ingestedNothing,
          ...result,
          notes,
        },
      };
    },
  );
}
