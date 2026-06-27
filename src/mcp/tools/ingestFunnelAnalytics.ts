/**
 * Layer 2 (tool) — `ingest_funnel_analytics` (OWNED, WRITE, gateWrite — numeric analytics).
 *
 * Accepts the funnel-tracker shape: per-stage snapshots (VISIBILITY..PROFITABILITY) anchored to
 * an `as_of` date + monthly actuals (Impressions/Sessions/CTR/CVR/AOV/Orders/Revenue/Spend per
 * month). Parsed deterministically into campaign_metrics rows (upserted on the natural key).
 * Channel defaults to amazon (the funnel tracker is Amazon-centric). Honest no_data when nothing
 * parses. Rate metrics (ctr/cvr) are fractions 0–1.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ingestFunnelAnalytics,
  AnalyticsIngestError,
} from '../service/analyticsIngestService.js';
import {
  campaignChannelSchema,
  funnelStageSchema,
  isoDateSchema,
  journeyStageSchema,
  metricSourceSchema,
} from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const stageSchema = z.object({
  stage: funnelStageSchema.describe('visibility | clicks | orders | revenue | profitability.'),
  impressions: z.number().optional(),
  ctr: z.number().optional().describe('Fraction 0–1, not a percentage.'),
  cvr: z.number().optional().describe('Fraction 0–1, not a percentage.'),
  aov: z.number().optional(),
  orders: z.number().optional(),
  revenue: z.number().optional(),
});

const monthlySchema = z.object({
  month: isoDateSchema.describe('Any date in the month (YYYY-MM-DD, UTC) — anchors the monthly snapshot.'),
  impressions: z.number().optional(),
  sessions: z.number().optional(),
  ctr: z.number().optional().describe('Fraction 0–1, not a percentage.'),
  cvr: z.number().optional().describe('Fraction 0–1, not a percentage.'),
  aov: z.number().optional(),
  orders: z.number().optional(),
  revenue: z.number().optional(),
  spend: z.number().optional(),
});

const inputSchema = {
  campaign_id: z.string().min(1).describe('The campaign id (from list_campaigns) to attach metrics to.'),
  channel: campaignChannelSchema.optional().describe('Channel for these metrics (default amazon).'),
  as_of: isoDateSchema.optional().describe('Snapshot date for the per-stage rows (required if `stages` is given).'),
  stages: z.array(stageSchema).max(10).optional().describe('Per-stage snapshot rows (funnel tracker stages; max 10).'),
  monthly: z.array(monthlySchema).max(600).optional().describe('Monthly-actuals rows (funnel tracker Monthly Tracker; max 600).'),
  brand_asset_id: z
    .string()
    .min(1)
    .optional()
    .describe('Optional funnel piece (brand_asset id) this whole upload measures — all rows attach to that piece.'),
  journey_stage: journeyStageSchema
    .optional()
    .describe('Optional customer-journey stage of the piece: awareness | consideration | purchase_decision | retention | advocacy.'),
  source: metricSourceSchema.optional().describe('Provenance: spreadsheet (default) | manual | warehouse | windsor (host read Windsor get_data, then called ingest).'),
};

export function registerIngestFunnelAnalyticsTool(server: McpServer): void {
  server.registerTool(
    'ingest_funnel_analytics',
    {
      title: 'Ingest funnel analytics',
      description:
        'Write tool: ingest the funnel-tracker shape — per-stage snapshots (anchored to as_of) and/or monthly actuals (impressions/sessions/ctr/cvr/aov/orders/revenue/spend per month) — into campaign_metrics. Append-only, upserted on the natural key (re-upload safe). Channel defaults to amazon; rate metrics are fractions 0–1. Requires an authenticated Supabase JWT; RLS-scoped to the caller. Returns ok:false/no_data when nothing parseable was supplied — never fabricates metrics.',
      inputSchema,
    },
    async ({ campaign_id, channel, as_of, stages, monthly, brand_asset_id, journey_stage, source }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const result = await ingestFunnelAnalytics(
          campaign_id,
          { channel, as_of, stages, monthly, brand_asset_id, journey_stage },
          source,
        );

        safeLog({ event: 'tool.ingest_funnel_analytics', caller: userTag(identity), ingested: result.ingested });
        captureMcpEvent(identity.userId as string, 'mcp_funnel_analytics_ingested', { ingested: result.ingested });
        return {
          content: [
            {
              type: 'text' as const,
              text: result.ok
                ? `Ingested ${result.ingested} funnel metric(s) for the campaign.`
                : 'No usable funnel metrics supplied (no_data) — nothing was stored.',
            },
          ],
          structuredContent: { ok: result.ok, ingested: result.ingested, note: result.note, metrics: result.metrics },
        };
      } catch (err) {
        const note = err instanceof AnalyticsIngestError ? err.message : 'failed to ingest funnel analytics';
        safeLog({ level: 'warn', event: 'tool.ingest_funnel_analytics.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not ingest funnel analytics: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
