/**
 * Layer 2 (tool) — `generate_concepts` (OWNED, critical path: chain link 1).
 *
 * Produces on-brand concept candidates by composing the existing
 * `idea-framework-consultant-claude` engine verbatim (Calculation Parity).
 * Requires an authenticated caller (the engine itself is JWT-gated).
 * Terminal `log_asset` write into the asset ledger is DEFERRED by capability (D5).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import type { EdgeFnClient } from '../edgeFn/client.js';
import { buildConceptPrompt, parseConcepts } from '../service/concepts.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

interface ConsultantResponse {
  response: string;
}

const inputSchema = {
  brief: z.string().min(10).describe('What the concepts are for: product, audience, objective.'),
  channel: z.string().optional().describe('Target channel (e.g. amazon_listing, instagram, email).'),
  count: z.number().int().min(1).max(10).default(3),
};

export function registerGenerateConceptsTool(server: McpServer, edgeFn: EdgeFnClient): void {
  server.registerTool(
    'generate_concepts',
    {
      title: 'Generate marketing concepts',
      description:
        'First owned asset-chain tool: produce N on-brand marketing concept candidates from a brief, composed through the existing brand-coach consultant engine (Calculation Parity). Requires an authenticated Supabase JWT. IV-OS canon grounding + log_asset recording are deferred by capability.' + groundingPreamble('generate_concepts'),
      inputSchema,
    },
    async ({ brief, channel, count }) => {
      const prompt = buildConceptPrompt({ brief, channel, count });
      const res = await edgeFn.invoke<ConsultantResponse>('idea-framework-consultant-claude', {
        message: prompt,
        hasUploadedDocuments: false,
        stream: false,
      });
      if (!res.ok || !res.data?.response) {
        safeLog({ level: 'warn', event: 'tool.generate_concepts.unavailable', caller: userTag(getIdentity()) });
        return {
          content: [{ type: 'text' as const, text: `generate_concepts unavailable: ${res.note ?? 'empty engine reply'}` }],
          structuredContent: { ok: false, concepts: [], note: res.note ?? 'empty engine reply' },
        };
      }
      const concepts = parseConcepts(res.data.response, count);
      safeLog({ event: 'tool.generate_concepts', caller: userTag(getIdentity()), count: concepts.length });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(concepts, null, 2) }],
        structuredContent: {
          ok: true,
          concepts,
          canon_grounding: 'deferred — IV-OS brand-canon reads not yet shipped (consume by capability)',
          log_asset:
            'auto-recording deferred — record via this gateway\'s log_asset tool (D5 resolved: writes are identity-gated)',
        },
      };
    },
  );
}
