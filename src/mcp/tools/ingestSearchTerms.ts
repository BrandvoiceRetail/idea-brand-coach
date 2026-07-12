/**
 * Layer 2 (tool) — `ingest_search_terms` (OWNED, WRITE, gateWrite — first-party PPC keyword data).
 *
 * Stores the seller's OWN Amazon Ads search-term report rows (per-keyword impressions/clicks/
 * spend/orders/sales) into ad_search_terms, upserted on the natural key (re-ingest safe). The host
 * pulls the report from Windsor `amazon_ads` (source='windsor') and calls this — the same host-
 * driven pattern as ingest_campaign_analytics. Feeds run_ppc_audit (harvest/negate + per-keyword
 * ACOS). Honest no_data: a row without a term or any finite metric is dropped; an empty batch
 * returns ok:false/no_data — never fabricates a keyword or a number.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ingestSearchTerms, SearchTermError, SEARCH_TERM_MATCH_TYPES } from '../service/searchTermService.js';
import { isoDateSchema, metricSourceSchema } from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  rows: z
    .array(
      z.object({
        search_term: z.string().min(1).describe('The customer search term / query from the Amazon Ads report.'),
        match_type: z
          .enum(SEARCH_TERM_MATCH_TYPES as unknown as [string, ...string[]])
          .optional()
          .describe('exact | phrase | broad | auto | unknown (default unknown).'),
        brand_asset_id: z
          .string()
          .min(1)
          .optional()
          .describe('Optional funnel piece (brand_asset id) this term drove traffic to.'),
        campaign_id: z.string().min(1).optional().describe('Optional campaign id the term belongs to.'),
        measured_date: isoDateSchema.describe('Report date (YYYY-MM-DD, UTC).'),
        impressions: z.number().nonnegative().optional().describe('Impressions for the term on the date.'),
        clicks: z.number().nonnegative().optional().describe('Clicks for the term.'),
        spend: z.number().nonnegative().optional().describe('Ad spend on the term (seller currency).'),
        orders: z.number().nonnegative().optional().describe('Ad-attributed orders for the term.'),
        sales: z.number().nonnegative().optional().describe('Ad-attributed sales for the term.'),
      }),
    )
    .min(1)
    .max(2000)
    .describe('Search-term report rows. Provide only terms you actually have — never invent keywords or metrics.'),
  source: metricSourceSchema
    .optional()
    .describe('Provenance: windsor (default — host read the Amazon Ads report via Windsor) | manual | spreadsheet | warehouse.'),
};

export function registerIngestSearchTermsTool(server: McpServer): void {
  server.registerTool(
    'ingest_search_terms',
    {
      title: 'Ingest Amazon Ads search terms',
      description:
        "Write tool: store the seller's OWN Amazon Ads SEARCH-TERM report rows ({search_term, match_type?, brand_asset_id?, campaign_id?, measured_date, impressions/clicks/spend/orders/sales}). First-party, per-seller data — the host pulls it from Windsor amazon_ads and calls this. Upserted on the natural key so re-ingesting a report reconciles instead of duplicating. Requires an authenticated Supabase JWT; RLS-scoped to the caller. Returns ok:false/no_data when nothing usable was supplied — never fabricates keywords or metrics. Feeds run_ppc_audit (search-term harvest/negate + per-keyword ACOS).",
      inputSchema,
    },
    async ({ rows, source }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const result = await ingestSearchTerms(
          rows.map((r) => ({
            search_term: r.search_term,
            match_type: r.match_type as (typeof SEARCH_TERM_MATCH_TYPES)[number] | undefined,
            brand_asset_id: r.brand_asset_id ?? null,
            campaign_id: r.campaign_id ?? null,
            measured_date: r.measured_date,
            impressions: r.impressions,
            clicks: r.clicks,
            spend: r.spend,
            orders: r.orders,
            sales: r.sales,
          })),
          source,
        );

        safeLog({ event: 'tool.ingest_search_terms', caller: userTag(identity), ingested: result.ingested });
        captureMcpEvent(identity.userId as string, 'mcp_search_terms_ingested', { ingested: result.ingested });
        return {
          content: [
            {
              type: 'text' as const,
              text: result.ok
                ? `Ingested ${result.ingested} search-term row(s).`
                : 'No usable search terms supplied (no_data) — nothing was stored.',
            },
          ],
          structuredContent: { ok: result.ok, ingested: result.ingested, note: result.note, rows: result.rows },
        };
      } catch (err) {
        const note = err instanceof SearchTermError ? err.message : 'failed to ingest search terms';
        safeLog({ level: 'warn', event: 'tool.ingest_search_terms.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not ingest search terms: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
