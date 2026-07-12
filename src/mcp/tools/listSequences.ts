/**
 * Layer 2 (tool) — `list_sequences` (OWNED, READ — email sequences).
 *
 * Lists the caller's email sequences (newest-created first) with optional status / campaign_id
 * filters. The discovery surface for which sequence_id to pass to add_email_step /
 * get_sequence_performance. Identity-gated (private user data).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listSequences, EmailSequenceError } from '../service/emailSequenceService.js';
import { sequenceStatusSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  status: sequenceStatusSchema
    .optional()
    .describe('Optional status filter: draft | active | paused.'),
  campaign_id: z.string().optional().describe('Optional filter: only sequences linked to this campaign.'),
};

export function registerListSequencesTool(server: McpServer): void {
  server.registerTool(
    'list_sequences',
    {
      title: 'List email sequences',
      description:
        'Read tool: list the authenticated caller’s email sequences (newest-created first) with id, type, name, status, and campaign link. Optional status / campaign_id filters. RLS-scoped to the caller; requires a Supabase bearer token. Use an id here as the sequence_id for add_email_step or get_sequence_performance.',
      inputSchema,
    },
    async ({ status, campaign_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: email sequences are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const sequences = await listSequences({ status, campaign_id });
        safeLog({ event: 'tool.list_sequences', caller: userTag(identity), count: sequences.length });
        return {
          content: [
            {
              type: 'text' as const,
              text: sequences.length === 0 ? 'No email sequences yet.' : `${sequences.length} sequence(s).`,
            },
          ],
          structuredContent: { ok: true, count: sequences.length, sequences },
        };
      } catch (err) {
        const note = err instanceof EmailSequenceError ? err.message : 'failed to list email sequences';
        safeLog({ level: 'warn', event: 'tool.list_sequences.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list email sequences: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
