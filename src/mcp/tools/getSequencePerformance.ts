/**
 * Layer 2 (tool) — `get_sequence_performance` (OWNED, READ — email sequences).
 *
 * Reads a sequence's step count + the email-channel metrics of its linked campaign
 * (opens/clicks/ctr/cvr/revenue). There is no email-specific metrics table in Alpha, so performance
 * is sourced from campaign_metrics via the sequence's campaign link. RLS-scoped (sequence ownership
 * verified). Honest no_data: returns ok:true with an empty metric set + a note (no_campaign_linked /
 * no_data) when there is nothing to report — the coach must not fabricate opens or clicks.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSequencePerformance, EmailSequenceError } from '../service/emailSequenceService.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  sequence_id: z.string().min(1).describe('The sequence id (from list_sequences).'),
};

export function registerGetSequencePerformanceTool(server: McpServer): void {
  server.registerTool(
    'get_sequence_performance',
    {
      title: 'Get sequence performance',
      description:
        'Read tool: fetch a sequence’s step count plus the email-channel metrics of its linked campaign (opens/clicks/ctr/cvr/revenue). RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:true with empty metrics and a note (no_campaign_linked or no_data) when there is nothing recorded — reason over real numbers only, never invent them.',
      inputSchema,
    },
    async ({ sequence_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: sequence performance is private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const result = await getSequencePerformance(sequence_id);
        safeLog({
          event: 'tool.get_sequence_performance',
          caller: userTag(identity),
          steps: result.step_count,
          metrics: result.metrics.length,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.metrics.length === 0
                  ? `Sequence has ${result.step_count} step(s); no email metrics recorded (${result.note}).`
                  : `Sequence has ${result.step_count} step(s) and ${result.metrics.length} email metric(s).`,
            },
          ],
          structuredContent: {
            ok: result.ok,
            sequence: result.sequence,
            step_count: result.step_count,
            metrics: result.metrics,
            note: result.note,
          },
        };
      } catch (err) {
        const note =
          err instanceof EmailSequenceError ? err.message : 'failed to read sequence performance';
        safeLog({ level: 'warn', event: 'tool.get_sequence_performance.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read sequence performance: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
