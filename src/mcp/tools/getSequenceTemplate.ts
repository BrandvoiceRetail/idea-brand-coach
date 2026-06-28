/**
 * Layer 2 (tool) — `get_sequence_template` (READ — email sequences).
 *
 * Returns a deterministic PREBUILT step skeleton for a sequence type (welcome=5 / nurture=7 /
 * abandoned_cart=3). Pure: no DB, no user data — so no identity gate (it returns only generic,
 * claim-free template copy, never anyone's data). Types without a prebuilt return an empty set with
 * a no_template note. The caller persists the chosen steps via create_email_sequence + add_email_step.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSequenceTemplate } from '../service/emailSequenceService.js';
import { sequenceTypeSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';

const inputSchema = {
  sequence_type: sequenceTypeSchema.describe(
    'Sequence type to fetch a prebuilt for: welcome (5 steps) | nurture (7) | abandoned_cart (3). newsletter/upsell/downsell have no prebuilt.',
  ),
};

export function registerGetSequenceTemplateTool(server: McpServer): void {
  server.registerTool(
    'get_sequence_template',
    {
      title: 'Get a sequence template',
      description:
        'Read tool: return a deterministic prebuilt step skeleton (subject / body / delay_hours / email_type / trigger_event) for an email sequence type — welcome (5), nurture (7), abandoned_cart (3). Generic, claim-free copy to adapt, not send as-is. Returns ok:false/no_template for types without a prebuilt (newsletter, upsell, downsell).',
      inputSchema,
    },
    async ({ sequence_type }) => {
      const template = getSequenceTemplate(sequence_type);
      safeLog({ event: 'tool.get_sequence_template', sequence_type, steps: template.steps.length });
      return {
        content: [
          {
            type: 'text' as const,
            text: template.ok
              ? `${sequence_type} template: ${template.steps.length} prebuilt step(s).`
              : `No prebuilt template for ${sequence_type} (no_template).`,
          },
        ],
        structuredContent: {
          ok: template.ok,
          sequence_type: template.sequence_type,
          steps: template.steps,
          note: template.note,
        },
      };
    },
  );
}
