/**
 * Layer 2 (tool) — `get_campaign_metrics` (OWNED, READ — numeric analytics).
 *
 * Reads a campaign's metrics over an optional date range, optionally aggregated by_channel or
 * by_date. Additive metrics are summed; ratio metrics (ctr/cvr/aov) are means. RLS-scoped to the
 * caller (campaign ownership verified). Honest no_data: an empty result returns ok:true/count 0
 * with a no_data note — the coach must not fabricate numbers it doesn't have.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCampaignMetrics, AnalyticsIngestError } from '../service/analyticsIngestService.js';
import { isoDateSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  campaign_id: z.string().min(1).describe('The campaign id (from list_campaigns).'),
  from: isoDateSchema.optional().describe('Range start (inclusive) measured_date, YYYY-MM-DD.'),
  to: isoDateSchema.optional().describe('Range end (inclusive) measured_date, YYYY-MM-DD.'),
  breakdown: z
    .enum(['by_channel', 'by_date'])
    .optional()
    .describe('Aggregate the rows: by_channel or by_date (sums for counts, means for ctr/cvr/aov).'),
};

export function registerGetCampaignMetricsTool(server: McpServer): void {
  server.registerTool(
    'get_campaign_metrics',
    {
      title: 'Get campaign metrics',
      description:
        'Read tool: fetch a campaign’s numeric metrics over an optional date range, optionally aggregated by_channel or by_date (additive metrics summed; ctr/cvr/aov as means). RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:true with count 0 and a no_data note when there are no metrics — reason over real numbers only, never invent them.',
      inputSchema,
    },
    async ({ campaign_id, from, to, breakdown }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: campaign metrics are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const result = await getCampaignMetrics({ campaignId: campaign_id, from, to, breakdown });
        safeLog({ event: 'tool.get_campaign_metrics', caller: userTag(identity), count: result.count });
        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.count === 0
                  ? 'No metrics recorded for this campaign in that range (no_data).'
                  : `${result.count} metric(s)${breakdown ? ` (${breakdown})` : ''}.`,
            },
          ],
          structuredContent: {
            ok: result.ok,
            count: result.count,
            note: result.note,
            metrics: result.metrics,
            breakdown: result.breakdown,
          },
        };
      } catch (err) {
        const note = err instanceof AnalyticsIngestError ? err.message : 'failed to read campaign metrics';
        safeLog({ level: 'warn', event: 'tool.get_campaign_metrics.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read campaign metrics: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
