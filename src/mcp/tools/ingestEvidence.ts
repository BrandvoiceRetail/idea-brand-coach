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
 *   - `asin` → NOT yet wired: returns a clearly-marked stub note. The `/dp/` scrape is a
 *     follow-up (review-scraper learnings: `/dp/` yields the listing + ~8 reviews;
 *     `/product-reviews/` is login-walled/dead). We never fabricate scraped content.
 *
 * Identity-gated (gateWrite); all writes run on the JWT-bound RLS client scoped to the
 * caller (guardrail #5). Returns the counts written so the caller can confirm intake.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

/** A best-effort parsed review object. `body` is always present; the rest are optional. */
export interface ParsedReview {
  reviewer?: string;
  rating?: number;
  body: string;
}

const inputSchema = {
  reviews_text: z
    .string()
    .optional()
    .describe('Pasted reviews verbatim (blank-line- or line-separated). Chunked into review objects.'),
  listing_text: z
    .string()
    .optional()
    .describe('Pasted listing copy (title/bullets/A+/description). Frozen as the snapshot listing.'),
  asin: z
    .string()
    .optional()
    .describe('Amazon ASIN to scrape. NOT YET WIRED — returns a stub note (no fabrication).'),
  source_label: z
    .string()
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

export function registerIngestEvidenceTool(server: McpServer): void {
  server.registerTool(
    'ingest_evidence',
    {
      title: 'Ingest evidence (reviews / listing)',
      description:
        'Write tool: ingest real EVIDENCE so the engine can quote it verbatim. Pasted reviews are chunked into review objects and frozen as an evidence_snapshots row (and, with product_id, written to user_product_reviews); pasted listing copy is frozen as the snapshot listing. asin-scrape is NOT yet wired (returns a stub note — no fabrication). Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ reviews_text, listing_text, asin, source_label, product_id, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const userId = identity.userId as string; // gateWrite guarantees authenticated.
      const supabase = getUserSupabase();
      const notes: string[] = [];

      // ASIN scrape is a follow-up — surface a clearly-marked stub, never fake content.
      if (asin) {
        notes.push(
          `asin-scrape not yet wired (TODO): paste the /dp/ listing + reviews for ${asin} via reviews_text/listing_text. ` +
            'The /dp/ scrape (listing + ~8 reviews) is a planned follow-up; /product-reviews/ is login-walled/dead.',
        );
      }

      const parsed = reviews_text ? parseReviews(reviews_text) : [];
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
        asin_stub: Boolean(asin),
      });
      if (!ingestedNothing) {
        captureMcpEvent(userId, 'mcp_evidence_ingested', {
          reviews_parsed: result.reviews_parsed,
          listing_captured: result.listing_captured,
        });
      }

      const summary = ingestedNothing
        ? asin
          ? 'No pasted content ingested; asin-scrape is not yet wired (see notes).'
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
