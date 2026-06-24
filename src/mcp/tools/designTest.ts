/**
 * Layer 2 (tool) — `design_test` (OWNED, critical path: final chain link — tests an asset).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { designAbTest } from '../service/testDesign.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  name: z.string().min(1),
  variants: z
    .array(z.object({ label: z.string().optional(), content: z.string().min(1) }))
    .min(2)
    .max(6),
  hypothesis: z.string().optional(),
  primary_metric: z.string().optional(),
  channel: z.string().optional(),
};

export function registerDesignTestTool(server: McpServer): void {
  server.registerTool(
    'design_test',
    {
      title: 'Design an A/B test',
      description:
        'Owned asset-chain tool (final link): compose drafted alternates into an A/B test spec — hypothesis, lettered variants with traffic split, channel-appropriate primary metric, minimum sample and stopping rule. Auto-recording into the IV-OS test ledger is deferred (record_test not yet bound at this gateway); record produced assets via log_asset meanwhile.',
      inputSchema,
    },
    async (args) => {
      const spec = designAbTest(args);
      const identity = getIdentity();
      safeLog({
        event: 'tool.design_test',
        caller: userTag(identity),
        variants: spec.variants.length,
        metric: spec.primary_metric,
      });
      captureMcpEvent(identity.userId ?? 'anon', 'mcp_design_test_created', {
        variant_count: spec.variants.length,
        primary_metric: spec.primary_metric ?? null,
        channel: args.channel ?? null,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(spec, null, 2) }],
        structuredContent: {
          ...((spec as unknown) as Record<string, unknown>),
          record_test:
            'auto-recording deferred — record_test is not yet bound at this gateway (IV-OS tool + ab_tests store exist upstream); record assets via log_asset meanwhile',
        },
      };
    },
  );
}
