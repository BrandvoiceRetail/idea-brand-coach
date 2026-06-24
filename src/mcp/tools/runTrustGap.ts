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
import { buildTrustGap } from '../../lib/trustGap.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const dim = z.number().min(0).max(100);
const inputSchema = {
  insight: dim,
  distinctive: dim,
  empathetic: dim,
  authentic: dim,
  overall: dim.optional().describe('0-100; defaults to the average of the four dimensions.'),
};

export function registerRunTrustGapTool(server: McpServer): void {
  server.registerTool(
    'run_trust_gap',
    {
      title: 'Run Trust Gap™ scorecard',
      description:
        'Diagnostic (convenience): compute the Trust Gap™ 4-dimension scorecard from IDEA dimension scores (0-100 each) using the exact same deterministic engine as the app (Calculation Parity). Returns per-dimension /25 rescaling, bands, primary gap, and routing.',
      inputSchema,
    },
    async ({ insight, distinctive, empathetic, authentic, overall }) => {
      const scores = {
        insight,
        distinctive,
        empathetic,
        authentic,
        overall: overall ?? (insight + distinctive + empathetic + authentic) / 4,
      };
      const result = buildTrustGap(scores);
      const identity = getIdentity();
      safeLog({ event: 'tool.run_trust_gap', caller: userTag(identity) });
      captureMcpEvent(identity.userId ?? 'anon', 'mcp_trust_gap_run', {
        primary_gap: result.primaryGap,
        overall_score: scores.overall,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      };
    },
  );
}
