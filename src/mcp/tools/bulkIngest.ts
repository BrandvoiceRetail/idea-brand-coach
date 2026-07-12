/**
 * Layer 2 (tools) — `bulk_ingest_evidence` (WRITE) + `get_ingest_job` (READ).
 *
 * The ASYNC path for catalog-scale review pulls. `bulk_ingest_evidence` validates a list of
 * ASINs, enqueues one `scrape_jobs` row + N pending `scrape_job_items` (RLS-scoped to the
 * caller), kicks the background drainer (`process-scrape-jobs`), and returns a job_id
 * IMMEDIATELY — no blocking. The drainer scrapes each item (cache + rate-limit + Firecrawl
 * via review-scraper) and freezes the reviews as evidence over time, bounded by the rate
 * limiter. `get_ingest_job` reports progress (and nudges the drainer along).
 *
 * Identity-gated (gateWrite). Never fabricates: invalid ASINs are reported as `skipped`.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import { buildScrapeUrl } from './ingestEvidence.js';

const MAX_ASINS = 500;

/** Best-effort kick of the background drainer (initiated within the identity context). */
function kickDrainer(edge: EdgeFnClient): void {
  void edge.invoke('process-scrape-jobs', {}).catch(() => {});
}

const bulkInputSchema = {
  asins: z
    .array(z.string().max(2048))
    .min(1)
    .max(MAX_ASINS)
    .describe('ASINs (10 letters/digits) or full amazon.* product URLs to scrape, one per catalog item.'),
  marketplace: z
    .string()
    .max(12)
    .optional()
    .describe("Amazon marketplace for bare ASINs, e.g. 'com' (default) or 'co.uk'. Ignored for full URLs."),
  product_id: z
    .string()
    .max(64)
    .optional()
    .describe('Own-product id; when set, scraped reviews are ALSO written to user_product_reviews.'),
  avatar_id: z.string().optional().describe('Avatar scope for the frozen evidence; omit for brand-level.'),
};

export function registerBulkIngestEvidenceTool(server: McpServer, edge: EdgeFnClient): void {
  server.registerTool(
    'bulk_ingest_evidence',
    {
      title: 'Bulk ingest evidence (async catalog scrape)',
      description:
        'Write tool: queue a catalog of ASINs (or amazon.* URLs) for async review scraping. Validates + dedups, enqueues a job, kicks the background drainer, and returns a job_id immediately — reviews are scraped + frozen as evidence over time (cache + rate-limited). Invalid ASINs are returned as `skipped` (never fabricated). Poll get_ingest_job for progress. Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema: bulkInputSchema,
    },
    async ({ asins, marketplace, product_id, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const userId = identity.userId as string;
      const supabase = getUserSupabase();

      // Validate + dedup. Each valid item carries its scrape URL + a label (the raw ASIN, or
      // null for a full URL). Invalid inputs are skipped with a reason — never scraped.
      const seen = new Set<string>();
      const items: Array<{ asin: string | null; url: string }> = [];
      const skipped: Array<{ input: string; reason: string }> = [];
      for (const raw of asins) {
        const built = buildScrapeUrl(raw, marketplace);
        if ('error' in built) {
          skipped.push({ input: raw, reason: built.error });
          continue;
        }
        if (seen.has(built.url)) continue; // dedup
        seen.add(built.url);
        items.push({ asin: /^https?:\/\//i.test(raw.trim()) ? null : raw.trim(), url: built.url });
      }

      if (items.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No valid ASINs to queue (${skipped.length} skipped).` }],
          structuredContent: { ok: false, note: 'no valid ASINs', queued: 0, skipped },
          isError: false,
        };
      }

      const { data: jobRow, error: jobErr } = await supabase
        .from('scrape_jobs')
        .insert({
          user_id: userId,
          status: 'queued',
          total: items.length,
          marketplace: marketplace ?? null,
          product_id: product_id ?? null,
          avatar_id: avatar_id ?? null,
        })
        .select('id')
        .single();
      if (jobErr || !jobRow) {
        safeLog({ level: 'warn', event: 'tool.bulk_ingest_evidence.job_failed', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not queue job: ${jobErr?.message ?? 'no job row'}` }],
          structuredContent: { ok: false, note: jobErr?.message ?? 'job insert returned no row' },
          isError: true,
        };
      }
      const jobId = (jobRow as { id: string }).id;

      const { error: itemsErr } = await supabase.from('scrape_job_items').insert(
        items.map((it) => ({ job_id: jobId, user_id: userId, asin: it.asin, url: it.url, status: 'pending' })),
      );
      if (itemsErr) {
        safeLog({ level: 'warn', event: 'tool.bulk_ingest_evidence.items_failed', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not enqueue items: ${itemsErr.message}` }],
          structuredContent: { ok: false, note: itemsErr.message, job_id: jobId },
          isError: true,
        };
      }

      kickDrainer(edge);
      safeLog({
        event: 'tool.bulk_ingest_evidence',
        caller: userTag(identity),
        queued: items.length,
        skipped: skipped.length,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Queued ${items.length} ASIN(s) for scraping${skipped.length ? ` (${skipped.length} skipped)` : ''}. Job ${jobId}. Poll get_ingest_job for progress.`,
          },
        ],
        structuredContent: { ok: true, job_id: jobId, queued: items.length, skipped },
      };
    },
  );
}

const getJobInputSchema = {
  job_id: z.string().min(1).describe('The job id returned by bulk_ingest_evidence.'),
};

export function registerGetIngestJobTool(server: McpServer, edge: EdgeFnClient): void {
  server.registerTool(
    'get_ingest_job',
    {
      title: 'Get a bulk ingest job (progress)',
      description:
        'Read tool: report a bulk_ingest_evidence job by job_id — status (queued/running/done/failed), total/done/failed counts, and pending count — and nudge the drainer along. RLS-scoped to the caller. Returns ok:false/not found when the job is not the caller’s or does not exist.',
      inputSchema: getJobInputSchema,
    },
    async ({ job_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const supabase = getUserSupabase();

      const { data: job, error } = await supabase
        .from('scrape_jobs')
        .select('id, status, total, done, failed, marketplace, product_id, avatar_id, created_at, updated_at')
        .eq('id', job_id)
        .maybeSingle();
      if (error) {
        return {
          content: [{ type: 'text' as const, text: `Could not read job: ${error.message}` }],
          structuredContent: { ok: false, note: error.message },
          isError: true,
        };
      }
      if (!job) {
        return {
          content: [{ type: 'text' as const, text: 'No job found for that id.' }],
          structuredContent: { ok: false, note: 'not found' },
        };
      }

      const j = job as { status: string; total: number; done: number; failed: number };
      const pending = Math.max(0, j.total - j.done - j.failed);
      kickDrainer(edge); // checking progress also advances the drain
      safeLog({ event: 'tool.get_ingest_job', caller: userTag(identity), status: j.status });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Job ${j.status}: ${j.done}/${j.total} done, ${j.failed} failed, ${pending} pending.`,
          },
        ],
        structuredContent: { ok: true, job, pending },
      };
    },
  );
}
