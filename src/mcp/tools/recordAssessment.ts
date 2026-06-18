/**
 * Layer 2 (tool) — `record_assessment` (native asset-ledger write, identity-gated).
 *
 * Records a brand/quality assessment of an asset in the asset change log —
 * the write half of the full-asset-assessment loop (read the complete body via
 * `get_asset` with include_full_content, judge it against brand canon, then
 * record the verdict here). Advisory: never mutates the approval lifecycle.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { actorTag, gateWrite } from './writeAuth.js';

const inputSchema = {
  request_id: z.string().min(1),
  verdict: z.enum(['pass', 'needs_work', 'fail']),
  summary: z.string().optional().describe('One-paragraph assessment summary'),
  scores: z.record(z.string(), z.number()).optional().describe('Dimension → score (e.g. voice, positioning)'),
  recommendations: z.string().optional(),
};

export function registerRecordAssessmentTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'record_assessment',
    {
      title: 'Record assessment (asset change log)',
      description:
        'Record a brand/quality assessment of a marketing asset (verdict pass|needs_work|fail with optional ' +
        'scores/summary/recommendations) in the asset change log. Advisory — does not change the approval ' +
        'lifecycle. Asset-ledger write — requires an authenticated caller; availability=false when the ledger is unavailable.',
      inputSchema,
    },
    async (args) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const result = await ivos.recordAssessment({
        ...args,
        assessed_by: actorTag(identity),
      });
      safeLog({
        event: 'tool.record_assessment',
        caller: userTag(getIdentity()),
        available: result.available,
        ok: result.data?.ok ?? false,
        verdict: args.verdict,
      });
      return {
        content: [
          {
            type: 'text',
            text: result.available
              ? (result.data?.report ?? 'No report returned.')
              : `Asset ledger unavailable: ${result.note}`,
          },
        ],
        structuredContent: {
          available: result.available,
          ok: result.data?.ok ?? false,
          request_id: result.data?.request_id ?? args.request_id,
          note: result.note,
        },
      };
    },
  );
}
