/**
 * Layer 2 (tool) — `update_campaign_status` (OWNED, WRITE, gateWrite — campaign CRUD).
 *
 * Flips a campaign's lifecycle status (draft → active → paused → completed). Status is the only
 * mutable field — campaigns are status-driven, never hard-deleted. RLS re-checks ownership on the
 * UPDATE; an absent/foreign campaign_id resolves to zero rows and returns a clean not-found
 * (never a silent success). Identity-gated (gateWrite).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { updateCampaignStatus, CampaignServiceError } from '../service/campaignService.js';
import { campaignStatusSchema } from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  campaign_id: z.string().min(1).describe('The campaign id (from list_campaigns).'),
  status: campaignStatusSchema.describe(
    'New lifecycle status: draft | active | paused | completed.',
  ),
};

export function registerUpdateCampaignStatusTool(server: McpServer): void {
  server.registerTool(
    'update_campaign_status',
    {
      title: 'Update campaign status',
      description:
        'Write tool: set a campaign’s lifecycle status (draft | active | paused | completed) by campaign_id. Status is the only mutable field. Requires an authenticated Supabase JWT; RLS-scoped to the caller. Returns ok:false/not found when the campaign is not the caller’s or does not exist.',
      inputSchema,
    },
    async ({ campaign_id, status }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const campaign = await updateCampaignStatus(campaign_id, status);
        if (!campaign) {
          safeLog({ event: 'tool.update_campaign_status', caller: userTag(identity), found: false });
          return {
            content: [{ type: 'text' as const, text: 'No campaign found for that id.' }],
            structuredContent: { ok: false, note: 'not found' },
          };
        }
        safeLog({ event: 'tool.update_campaign_status', caller: userTag(identity), status });
        captureMcpEvent(identity.userId as string, 'mcp_campaign_status_updated', { status });
        return {
          content: [{ type: 'text' as const, text: `Campaign “${campaign.name}” is now ${campaign.status}.` }],
          structuredContent: { ok: true, campaign },
        };
      } catch (err) {
        const note = err instanceof CampaignServiceError ? err.message : 'failed to update campaign status';
        safeLog({ level: 'warn', event: 'tool.update_campaign_status.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not update campaign status: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
