/**
 * Layer 2 (tool) — `run_trust_gap` (OWNED diagnostic, convenience — NOT critical path).
 *
 * LITERAL Calculation Parity: calls the same pure `buildTrustGap` the app uses
 * (`src/lib/trustGap.ts` — deterministic, no network, no React), in-process.
 * `overall` defaults to the four-dimension average, matching its documented
 * definition in the stored scores object.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { buildTrustGap } from '../../lib/trustGap.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const dim = z.number().min(0).max(100);
const inputSchema = {
  insight: dim,
  distinctive: dim,
  empathetic: dim,
  authentic: dim,
  overall: dim.optional().describe('0-100; defaults to the average of the four dimensions.'),
  avatar_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Optional avatar this scorecard scopes (Diagnostic BOTH, locked #5): omit = brand baseline; set = a per-avatar overlay. This tool is pure compute and does NOT persist — the value is echoed back for attribution only.',
    ),
};

export function registerRunTrustGapTool(server: McpServer): void {
  server.registerTool(
    'run_trust_gap',
    {
      title: 'Run Trust Gap™ scorecard',
      description:
        'Diagnostic (convenience): compute the Trust Gap™ 4-dimension scorecard from IDEA dimension scores (0-100 each) using the exact same deterministic engine as the app (Calculation Parity). Returns per-dimension /25 rescaling, bands, primary gap, and routing. Only call AFTER the user has explicitly worked through all four IDEA dimensions with you. Never infer, default, or invent the four values; if you lack a real answer for any dimension, ask — do not score.' + groundingPreamble('run_trust_gap'),
      inputSchema,
    },
    async ({ insight, distinctive, empathetic, authentic, overall, avatar_id }) => {
      const scores = {
        insight,
        distinctive,
        empathetic,
        authentic,
        overall: overall ?? (insight + distinctive + empathetic + authentic) / 4,
      };
      const result = buildTrustGap(scores);
      safeLog({ event: 'tool.run_trust_gap', caller: userTag(getIdentity()) });
      // structuredContent stays BYTE-IDENTICAL to the in-app engine (Calculation
      // Parity, Gen-3 lock). The avatar scope (avatar_id NULL = brand baseline,
      // locked #5) is echoed in the human-readable text only — this tool never
      // persists; the SPA save path owns avatar_id stamping.
      const text =
        JSON.stringify(result, null, 2) +
        `\n\n(scope: avatar_id=${avatar_id ?? 'null (brand baseline)'})`;
      return {
        content: [{ type: 'text' as const, text }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
