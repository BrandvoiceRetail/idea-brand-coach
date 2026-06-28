/**
 * Layer 2 (tool) — `ingest_content_performance` (OWNED, WRITE, gateWrite — numeric analytics).
 *
 * Accepts the content-tracker shape: per-channel performance rows (views / engagement /
 * calls_booked / revenue, dated). Parsed deterministically into campaign_metrics rows (upserted
 * on the natural key, re-upload safe). Honest no_data: rows without a finite value are dropped;
 * an all-empty batch returns ok:false/no_data.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ingestContentPerformance,
  AnalyticsIngestError,
} from '../service/analyticsIngestService.js';
import {
  campaignChannelSchema,
  isoDateSchema,
  journeyStageSchema,
  metricSourceSchema,
} from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  campaign_id: z.string().min(1).describe('The campaign id (from list_campaigns) to attach metrics to.'),
  rows: z
    .array(
      z.object({
        channel: campaignChannelSchema.describe('Content channel: blog | social | tiktok | content | ...'),
        measured_date: isoDateSchema.describe('Date the performance was measured (YYYY-MM-DD, UTC).'),
        views: z.number().optional().describe('Views in the period.'),
        engagement: z.number().optional().describe('Engagement count (likes/comments/shares).'),
        calls_booked: z.number().optional().describe('Calls / meetings booked attributed to the content.'),
        revenue: z.number().optional().describe('Revenue attributed to the content.'),
        brand_asset_id: z
          .string()
          .min(1)
          .optional()
          .describe('Optional funnel piece (brand_asset id) this row measures — the metric attaches to that piece.'),
        journey_stage: journeyStageSchema
          .optional()
          .describe('Optional customer-journey stage of the piece: awareness | consideration | purchase_decision | retention | advocacy.'),
      }),
    )
    .min(1)
    .max(1000)
    .describe('Per-channel content performance rows. Provide only metrics you actually have.'),
  source: metricSourceSchema.optional().describe('Provenance: spreadsheet (default) | manual | warehouse | windsor (host read Windsor get_data, then called ingest).'),
};

export function registerIngestContentPerformanceTool(server: McpServer): void {
  server.registerTool(
    'ingest_content_performance',
    {
      title: 'Ingest content performance',
      description:
        'Write tool: ingest the content-tracker shape — per-channel performance rows (views / engagement / calls_booked / revenue, dated) — into campaign_metrics. Append-only, upserted on the natural key (re-upload safe). Requires an authenticated Supabase JWT; RLS-scoped to the caller. Returns ok:false/no_data when nothing parseable was supplied — never fabricates metrics.',
      inputSchema,
    },
    async ({ campaign_id, rows, source }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const result = await ingestContentPerformance(
          campaign_id,
          rows.map((r) => ({
            channel: r.channel,
            measured_date: r.measured_date,
            views: r.views,
            engagement: r.engagement,
            calls_booked: r.calls_booked,
            revenue: r.revenue,
            brand_asset_id: r.brand_asset_id ?? null,
            journey_stage: r.journey_stage ?? null,
          })),
          source,
        );

        safeLog({ event: 'tool.ingest_content_performance', caller: userTag(identity), ingested: result.ingested });
        captureMcpEvent(identity.userId as string, 'mcp_content_performance_ingested', { ingested: result.ingested });
        return {
          content: [
            {
              type: 'text' as const,
              text: result.ok
                ? `Ingested ${result.ingested} content metric(s) for the campaign.`
                : 'No usable content metrics supplied (no_data) — nothing was stored.',
            },
          ],
          structuredContent: { ok: result.ok, ingested: result.ingested, note: result.note, metrics: result.metrics },
        };
      } catch (err) {
        const note = err instanceof AnalyticsIngestError ? err.message : 'failed to ingest content performance';
        safeLog({ level: 'warn', event: 'tool.ingest_content_performance.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not ingest content performance: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
