/**
 * Layer 2 (tool) — `list_campaigns` (OWNED, READ — campaign CRUD).
 *
 * Lists the caller's campaigns (newest-created first) with an optional status filter. The
 * discovery surface for which campaign_id to pass to get_campaign / the analytics tools.
 * Identity-gated (private user data).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listCampaigns, CampaignServiceError } from '../service/campaignService.js';
import { campaignStatusSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  status: campaignStatusSchema
    .optional()
    .describe('Optional status filter: draft | active | paused | completed.'),
};

export function registerListCampaignsTool(server: McpServer): void {
  server.registerTool(
    'list_campaigns',
    {
      title: 'List campaigns',
      description:
        'Read tool: list the authenticated caller’s campaigns (newest-created first) with id, name, channel, status, and description. Optional status filter. RLS-scoped to the caller; requires a Supabase bearer token. Use an id here as the campaign_id for get_campaign or the analytics tools.',
      inputSchema,
    },
    async ({ status }) => {
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
        const campaigns = await listCampaigns({ status });
        safeLog({ event: 'tool.list_campaigns', caller: userTag(identity), count: campaigns.length });
        return {
          content: [
            {
              type: 'text' as const,
              text: campaigns.length === 0 ? 'No campaigns yet.' : `${campaigns.length} campaign(s).`,
            },
          ],
          structuredContent: { ok: true, count: campaigns.length, campaigns },
        };
      } catch (err) {
        const note = err instanceof CampaignServiceError ? err.message : 'failed to list campaigns';
        safeLog({ level: 'warn', event: 'tool.list_campaigns.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list campaigns: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
