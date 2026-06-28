/**
 * Layer 2 (tool) — `get_experiment_lift` (OWNED, READ — the Re-measure leg of the loop).
 *
 * Close the experiment loop for ONE split-test (brand_tests row): after the asset goes LIVE
 * and a second Windsor pull lands metrics, compute the BEFORE→AFTER lift for the test's metric
 * on its funnel piece (the brand_asset), reading campaign_metrics windowed by the test's
 * asset_created_at / asset_live_at dates — NO snapshot table. Deterministic arithmetic, in the
 * style of compute_trust_gap_lift: it NEVER fabricates an after value. Honest pending when the
 * asset isn't live yet or no post-live metric exists. RLS-scoped to the caller; a foreign/absent
 * test_id is a clean not-found. status_suggestion is advice only — the user/coach decides the
 * verdict by updating brand_tests.status.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getExperimentLift, BrandTestError } from '../service/brandTestService.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  test_id: z
    .string()
    .min(1)
    .describe('The split-test (brand_tests id) to re-measure — its baseline + funnel piece + metric + lifecycle dates.'),
};

export function registerGetExperimentLiftTool(server: McpServer): void {
  server.registerTool(
    'get_experiment_lift',
    {
      title: 'Get experiment lift (re-measure before/after)',
      description:
        'Re-measure a split-test: compute the BEFORE→AFTER lift for the test\'s metric on its funnel piece, reading campaign_metrics windowed by the test\'s asset_created_at / asset_live_at dates (NO snapshot table). before = the test\'s baseline_value if set, else the latest metric BEFORE the asset was created; after = the latest metric on/after the asset went live (the live date starts the clock). Returns before, after, lift, lift_pct, and a status_suggestion (won|no_lift|pending). Deterministic and honest: it NEVER fabricates an after value — it returns pending when the asset isn\'t live yet or no post-live metric has been pulled. status_suggestion is advice only; you decide the verdict and update the test. RLS-scoped to the caller; requires a Supabase bearer token.',
      inputSchema,
    },
    async ({ test_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: experiment lift is private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const result = await getExperimentLift(test_id);
        safeLog({
          event: 'tool.get_experiment_lift',
          caller: userTag(identity),
          status_suggestion: result.status_suggestion,
        });
        return {
          content: [{ type: 'text' as const, text: result.summary }],
          structuredContent: { ...result },
        };
      } catch (err) {
        const note = err instanceof BrandTestError ? err.message : 'failed to compute experiment lift';
        safeLog({ level: 'warn', event: 'tool.get_experiment_lift.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not compute experiment lift: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
