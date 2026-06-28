/**
 * Layer 2 (tool) — `get_funnel_piece_metrics` (OWNED, READ — per-piece numeric analytics).
 *
 * Decision #1: a funnel piece = a campaign = an active brand asset — ONE entity that traffic moves
 * through; metrics attach to THAT brand_asset. This read answers "did this piece do its job?": it
 * returns one funnel piece's LATEST value per metric_name over an optional date range, plus a small
 * deterministic derived block (cvr = orders/clicks, aov = revenue/orders — only when both inputs
 * exist). RLS-scoped to the caller (brand_asset ownership enforced). Honest no_data: an empty piece
 * returns ok:true/count 0 with a no_data note — the coach reasons over real numbers, never invents.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getFunnelPieceMetrics, AnalyticsIngestError } from '../service/analyticsIngestService.js';
import { isoDateSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  brand_asset_id: z
    .string()
    .min(1)
    .describe('The funnel piece (brand_asset id, from list_funnel_inventory / get_funnel_assets) to read metrics for.'),
  from: isoDateSchema.optional().describe('Range start (inclusive) measured_date, YYYY-MM-DD.'),
  to: isoDateSchema.optional().describe('Range end (inclusive) measured_date, YYYY-MM-DD.'),
};

export function registerGetFunnelPieceMetricsTool(server: McpServer): void {
  server.registerTool(
    'get_funnel_piece_metrics',
    {
      title: 'Get funnel piece metrics',
      description:
        'Read tool: fetch ONE funnel piece’s (brand_asset’s) metrics over an optional date range, reduced to the latest value per metric (impressions/clicks/ctr/cvr/orders/revenue/…) plus a derived block (cvr=orders/clicks, aov=revenue/orders, only when both inputs exist). Answers "did this piece do its job?". RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:true with count 0 and a no_data note when the piece has no metrics — reason over real numbers only, never invent them.',
      inputSchema,
    },
    async ({ brand_asset_id, from, to }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: funnel piece metrics are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const result = await getFunnelPieceMetrics({ brandAssetId: brand_asset_id, from, to });
        safeLog({ event: 'tool.get_funnel_piece_metrics', caller: userTag(identity), count: result.count });
        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.count === 0
                  ? 'No metrics recorded for this funnel piece in that range (no_data).'
                  : `${result.count} metric row(s) for this funnel piece; ${Object.keys(result.latest).length} distinct metric(s).`,
            },
          ],
          structuredContent: {
            ok: result.ok,
            brand_asset_id: result.brand_asset_id,
            count: result.count,
            note: result.note,
            latest: result.latest,
            derived: result.derived,
          },
        };
      } catch (err) {
        const note = err instanceof AnalyticsIngestError ? err.message : 'failed to read funnel piece metrics';
        safeLog({ level: 'warn', event: 'tool.get_funnel_piece_metrics.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read funnel piece metrics: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
