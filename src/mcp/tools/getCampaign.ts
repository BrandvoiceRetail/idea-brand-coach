/**
 * Layer 2 (tool) — `get_campaign` (OWNED, READ — campaign CRUD).
 *
 * Reads one campaign by id (RLS-scoped to the caller). Returns ok:false/not-found when the
 * campaign is not the caller's or does not exist. Identity-gated (private user data).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getCampaign, CampaignServiceError } from '../service/campaignService.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  campaign_id: z.string().min(1).describe('The campaign id (from list_campaigns).'),
};

export function registerGetCampaignTool(server: McpServer): void {
  server.registerTool(
    'get_campaign',
    {
      title: 'Get a campaign',
      description:
        'Read tool: fetch one campaign by campaign_id (name, channel, status, description, timestamps). RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:false/not found when the campaign is not the caller’s or does not exist.',
      inputSchema,
    },
    async ({ campaign_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: campaigns are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const campaign = await getCampaign(campaign_id);
        if (!campaign) {
          safeLog({ event: 'tool.get_campaign', caller: userTag(identity), found: false });
          return {
            content: [{ type: 'text' as const, text: 'No campaign found for that id.' }],
            structuredContent: { ok: false, note: 'not found' },
          };
        }
        safeLog({ event: 'tool.get_campaign', caller: userTag(identity), found: true });
        return {
          content: [{ type: 'text' as const, text: `Campaign “${campaign.name}” (${campaign.channel}, ${campaign.status}).` }],
          structuredContent: { ok: true, campaign },
        };
      } catch (err) {
        const note = err instanceof CampaignServiceError ? err.message : 'failed to read campaign';
        safeLog({ level: 'warn', event: 'tool.get_campaign.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read campaign: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
