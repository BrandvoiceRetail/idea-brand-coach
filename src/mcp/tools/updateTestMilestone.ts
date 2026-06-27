/**
 * Layer 2 (tool) — `update_test_milestone` (WRITE, identity-gated).
 *
 * Stamps an experiment-lifecycle milestone date on a split-test (`brand_tests` row) so
 * BOTH the app and the coach can mark progress: 'asset_created' (the test asset was
 * produced) and 'asset_live' (it went live — this date starts the re-measure clock and
 * anchors the case study). Stamping 'asset_live' also promotes a still-`draft` test to
 * `running`. Owner-scoped (RLS); a foreign/absent test_id is a clean not-found.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { updateTestMilestone, BrandTestError } from '../service/brandTestService.js';
import { testMilestoneSchema } from '../service/campaignTypes.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { gateWrite } from './writeAuth.js';

/** Accepts an ISO date (YYYY-MM-DD) or full ISO-8601 datetime; the column is timestamptz. */
const isoTimestampSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'expected an ISO date or datetime');

const inputSchema = {
  test_id: z
    .string()
    .min(1)
    .describe('The split-test (brand_tests id) to stamp.'),
  milestone: testMilestoneSchema.describe(
    "Which lifecycle milestone to stamp: 'asset_created' (the test asset was produced) or 'asset_live' (it went live — starts the re-measure clock).",
  ),
  at: isoTimestampSchema
    .optional()
    .describe('ISO date/datetime the milestone was reached; defaults to now() server-side when omitted.'),
};

export function registerUpdateTestMilestoneTool(server: McpServer): void {
  server.registerTool(
    'update_test_milestone',
    {
      title: 'Stamp a split-test lifecycle milestone',
      description:
        "Write tool: stamp an experiment-lifecycle milestone date on a split-test (brand_tests row) — 'asset_created' (the test asset was produced) or 'asset_live' (it went live; this date starts the re-measure clock and anchors the case study). Stamping 'asset_live' also promotes a still-draft test to running. Owner-scoped (RLS); requires a Supabase bearer token. A foreign/absent test_id returns a clean not-found, never a cross-tenant write.",
      inputSchema,
    },
    async ({ test_id, milestone, at }) => {
      const { denied } = gateWrite();
      if (denied) return denied;

      try {
        const result = await updateTestMilestone({ testId: test_id, milestone, at });
        safeLog({
          event: 'tool.update_test_milestone',
          caller: userTag(getIdentity()),
          milestone,
          ok: result.ok,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Stamped ${milestone} at ${result.at} on test ${result.test_id} (status: ${result.status}).`,
            },
          ],
          structuredContent: {
            ok: result.ok,
            test_id: result.test_id,
            milestone: result.milestone,
            at: result.at,
            status: result.status,
          },
        };
      } catch (err) {
        const note = err instanceof BrandTestError ? err.message : 'failed to update test milestone';
        safeLog({
          level: 'warn',
          event: 'tool.update_test_milestone.error',
          caller: userTag(getIdentity()),
        });
        return {
          content: [{ type: 'text' as const, text: `Could not update test milestone: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
