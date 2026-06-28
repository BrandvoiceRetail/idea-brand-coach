/**
 * Layer 2 (tool) — `create_campaign` (OWNED, WRITE, gateWrite — campaign CRUD).
 *
 * Creates a campaign under the caller's brand. `brand_id` is resolved SERVER-SIDE
 * (avatarOwnership.resolveBrandId, via the service) and stamped on the row — NEVER taken from
 * the caller (security: a caller cannot plant a campaign under a foreign brand). Identity-gated
 * (gateWrite). Channel/status are validated against the SSOT vocab in campaignTypes.ts.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createCampaign, CampaignServiceError } from '../service/campaignService.js';
import { AvatarOwnershipError } from '../service/avatarOwnership.js';
import { campaignChannelSchema, campaignStatusSchema } from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  name: z.string().min(1).describe('Campaign name (e.g. "Q3 TikTok Launch").'),
  channel: campaignChannelSchema.describe(
    'Marketing channel: blog | social | email | tiktok | amazon | paid | content.',
  ),
  status: campaignStatusSchema
    .optional()
    .describe('Lifecycle status (default draft): draft | active | paused | completed.'),
  description: z.string().optional().describe('Optional short description of the campaign.'),
};

export function registerCreateCampaignTool(server: McpServer): void {
  server.registerTool(
    'create_campaign',
    {
      title: 'Create a campaign',
      description:
        'Write tool: create a campaign under the authenticated caller’s brand. brand_id is resolved server-side and stamped (never caller-supplied). Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ name, channel, status, description }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const campaign = await createCampaign({
          name,
          channel,
          status,
          description: description ?? null,
        });

        safeLog({ event: 'tool.create_campaign', caller: userTag(identity), channel });
        captureMcpEvent(identity.userId as string, 'mcp_campaign_created', { channel });
        return {
          content: [{ type: 'text' as const, text: `Created campaign “${campaign.name}” (${campaign.channel}, ${campaign.status}).` }],
          structuredContent: { ok: true, campaign },
        };
      } catch (err) {
        const note =
          err instanceof CampaignServiceError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to create campaign';
        safeLog({ level: 'warn', event: 'tool.create_campaign.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not create campaign: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
