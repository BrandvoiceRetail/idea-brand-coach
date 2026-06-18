/**
 * Layer 2 (tool) — `publish_filter_check` (OWNED, critical path: chain link 2 — TESTS an asset).
 *
 * Deterministic compliance gate (D6 v1 — see service/publishFilter.ts). The CHECK is a
 * pure read (anonymous-safe). AUTO-RECORDING: when a ledger `request_id` is supplied,
 * the verdict is recorded into the asset ledger via `record_assessment` (verdict map:
 * pass→pass, warn→needs_work, fail→fail), attributed to `brand-coach-mcp:<userTag>`.
 * Writes stay identity-gated: anonymous callers get the check but not the recording.
 * Never-fail: a degraded write annotates `structuredContent.recorded`.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LedgerClient } from '../ivos/capabilities.js';
import { checkPublishFilter, type FilterVerdict } from '../service/publishFilter.js';
import { actorTag } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import type { RecordedNote } from './draftAsset.js';

const VERDICT_MAP: Record<FilterVerdict, 'pass' | 'needs_work' | 'fail'> = {
  pass: 'pass',
  warn: 'needs_work',
  fail: 'fail',
};

const inputSchema = {
  content: z.string().min(1).describe('The drafted asset/copy to grade.'),
  channel: z.string().optional().describe('Channel for length rules (e.g. x, amazon_bullet, email_subject).'),
  request_id: z
    .string()
    .optional()
    .describe('asset ledger request_id of the asset being graded — supply to record the assessment.'),
  record: z.boolean().default(true).describe('Record the assessment into the asset ledger when request_id is given.'),
};

export function registerPublishFilterCheckTool(server: McpServer, ivos: LedgerClient): void {
  server.registerTool(
    'publish_filter_check',
    {
      title: 'Publish-filter check (compliance gate)',
      description:
        'Owned asset-chain gate: grade a drafted asset against deterministic brand-safety rules (claims needing substantiation, medical claims, channel length caps, false urgency, shouting). Verdict pass|warn|fail with per-violation fix hints. Supply the asset’s request_id to auto-record the assessment (record_assessment; requires an authenticated caller). IV-OS safe-claims/canon grading activates by capability when those IV-OS reads ship.',
      inputSchema,
    },
    async ({ content, channel, request_id, record }) => {
      const report = checkPublishFilter(content, channel);

      let recorded: RecordedNote | undefined;
      if (request_id && record) {
        const identity = getIdentity();
        if (!identity.authenticated) {
          recorded = { ok: false, note: 'unauthenticated — assessment not recorded (writes are identity-gated)' };
        } else {
          const write = await ivos.recordAssessment({
            request_id,
            verdict: VERDICT_MAP[report.verdict],
            assessed_by: actorTag(identity),
            summary: `publish_filter_check: ${report.verdict} (${report.violations.length} violation(s)${
              report.violations.length ? ': ' + report.violations.map((v) => v.rule).join(', ') : ''
            })`,
            recommendations: report.violations.map((v) => v.fix_hint).join(' ').slice(0, 1000) || undefined,
          });
          recorded =
            write.available && write.data?.ok
              ? { ok: true, request_id }
              : { ok: false, note: write.note ?? 'asset-ledger write degraded' };
        }
      } else if (request_id) {
        recorded = { ok: false, note: 'opt-out (record:false) — assessment not recorded' };
      }

      safeLog({
        event: 'tool.publish_filter_check',
        caller: userTag(getIdentity()),
        verdict: report.verdict,
        violations: report.violations.length,
        recorded: recorded?.ok ?? null,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
        structuredContent: { ...report, recorded } as unknown as Record<string, unknown>,
      };
    },
  );
}
