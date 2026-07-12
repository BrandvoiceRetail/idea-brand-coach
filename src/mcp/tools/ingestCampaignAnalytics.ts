/**
 * Layer 2 (tool) — `ingest_campaign_analytics` (OWNED, WRITE, gateWrite — numeric analytics).
 *
 * The generic ingest path: already-normalised metric rows ({channel, metric_name, metric_value,
 * measured_date, funnel_stage?}) upserted into campaign_metrics on the natural key (re-upload
 * safe). The campaign is verified to belong to the caller before any metric is attached. Honest
 * no_data: rows without a finite value are dropped; an all-empty batch returns ok:false/no_data.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ingestCampaignAnalytics,
  AnalyticsIngestError,
} from '../service/analyticsIngestService.js';
import {
  campaignChannelSchema,
  funnelStageSchema,
  isoDateSchema,
  journeyStageSchema,
  metricGranularitySchema,
  metricNameSchema,
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
        channel: campaignChannelSchema.describe('blog | social | email | tiktok | amazon | paid | content.'),
        metric_name: metricNameSchema.describe(
          'impressions | sessions | clicks | opens | ctr | cvr | aov | spend | orders | revenue | engagement | calls_booked | views.',
        ),
        metric_value: z
          .number()
          .describe('Numeric value. Rate metrics (ctr, cvr) MUST be fractions 0–1, not percentages.'),
        measured_date: isoDateSchema.describe('Date the metric was measured (YYYY-MM-DD, UTC).'),
        funnel_stage: funnelStageSchema
          .optional()
          .describe('Optional funnel band: visibility | clicks | orders | revenue | profitability.'),
        brand_asset_id: z
          .string()
          .min(1)
          .optional()
          .describe('Optional funnel piece (brand_asset id) this metric measures — the metric attaches to that piece.'),
        journey_stage: journeyStageSchema
          .optional()
          .describe('Optional customer-journey stage of the piece: awareness | consideration | purchase_decision | retention | advocacy.'),
        granularity: metricGranularitySchema.optional().describe('daily (default) | hourly | snapshot.'),
      }),
    )
    .min(1)
    .max(1000)
    .describe('Metric rows to ingest. Provide only metrics you actually have — never invent values.'),
  source: metricSourceSchema.optional().describe('Provenance: manual (default) | spreadsheet | warehouse | windsor (host read Windsor get_data, then called ingest).'),
};

export function registerIngestCampaignAnalyticsTool(server: McpServer): void {
  server.registerTool(
    'ingest_campaign_analytics',
    {
      title: 'Ingest campaign analytics',
      description:
        'Write tool: store numeric metric rows ({channel, metric_name, metric_value, measured_date, funnel_stage?}) for a campaign. Append-only facts, upserted on the natural key so re-uploading reconciles instead of duplicating. Rate metrics (ctr/cvr) are fractions 0–1. Requires an authenticated Supabase JWT; RLS-scoped to the caller. Returns ok:false/no_data when nothing parseable was supplied — never fabricates metrics.',
      inputSchema,
    },
    async ({ campaign_id, rows, source }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const result = await ingestCampaignAnalytics(
          campaign_id,
          rows.map((r) => ({
            channel: r.channel,
            metric_name: r.metric_name,
            metric_value: r.metric_value,
            measured_date: r.measured_date,
            funnel_stage: r.funnel_stage ?? null,
            brand_asset_id: r.brand_asset_id ?? null,
            journey_stage: r.journey_stage ?? null,
            granularity: r.granularity,
          })),
          source,
        );

        safeLog({ event: 'tool.ingest_campaign_analytics', caller: userTag(identity), ingested: result.ingested });
        captureMcpEvent(identity.userId as string, 'mcp_campaign_analytics_ingested', { ingested: result.ingested });
        return {
          content: [
            {
              type: 'text' as const,
              text: result.ok
                ? `Ingested ${result.ingested} metric(s) for the campaign.`
                : 'No usable metrics supplied (no_data) — nothing was stored.',
            },
          ],
          structuredContent: { ok: result.ok, ingested: result.ingested, note: result.note, metrics: result.metrics },
        };
      } catch (err) {
        const note = err instanceof AnalyticsIngestError ? err.message : 'failed to ingest campaign analytics';
        safeLog({ level: 'warn', event: 'tool.ingest_campaign_analytics.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not ingest analytics: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
