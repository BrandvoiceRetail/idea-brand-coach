/**
 * Layer 2 (tool) — `create_email_sequence` (OWNED, WRITE, gateWrite — email sequences).
 *
 * Creates an email sequence under the caller's brand. `brand_id` is resolved SERVER-SIDE
 * (avatarOwnership.resolveBrandId, via the service) and stamped — NEVER taken from the caller.
 * `campaign_id` is an optional link. Identity-gated (gateWrite). sequence_type/status are validated
 * against the SSOT vocab in campaignTypes.ts.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createEmailSequence, EmailSequenceError } from '../service/emailSequenceService.js';
import { AvatarOwnershipError } from '../service/avatarOwnership.js';
import { sequenceStatusSchema, sequenceTypeSchema } from '../service/campaignTypes.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  sequence_type: sequenceTypeSchema.describe(
    'Sequence type: welcome | nurture | newsletter | upsell | downsell | abandoned_cart.',
  ),
  name: z.string().min(1).describe('Sequence name (e.g. "New subscriber welcome").'),
  campaign_id: z
    .string()
    .optional()
    .describe('Optional campaign id (from list_campaigns) to link this sequence to.'),
  status: sequenceStatusSchema
    .optional()
    .describe('Lifecycle status (default draft): draft | active | paused.'),
};

export function registerCreateEmailSequenceTool(server: McpServer): void {
  server.registerTool(
    'create_email_sequence',
    {
      title: 'Create an email sequence',
      description:
        'Write tool: create an email sequence under the authenticated caller’s brand. brand_id is resolved server-side and stamped (never caller-supplied); campaign_id is an optional link. Requires an authenticated Supabase JWT; RLS-scoped to the caller. Use get_sequence_template for a prebuilt step skeleton, then add_email_step to populate it.',
      inputSchema,
    },
    async ({ sequence_type, name, campaign_id, status }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const sequence = await createEmailSequence({
          sequence_type,
          name,
          campaign_id: campaign_id ?? null,
          status,
        });

        safeLog({ event: 'tool.create_email_sequence', caller: userTag(identity), sequence_type });
        captureMcpEvent(identity.userId as string, 'mcp_email_sequence_created', { sequence_type });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Created ${sequence.sequence_type} sequence “${sequence.name}” (${sequence.status}).`,
            },
          ],
          structuredContent: { ok: true, sequence },
        };
      } catch (err) {
        const note =
          err instanceof EmailSequenceError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to create email sequence';
        safeLog({ level: 'warn', event: 'tool.create_email_sequence.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not create email sequence: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
