/**
 * Layer 2 (tool) — `list_evidence` (OWNED, READ — paginated review-quote read-back).
 *
 * Answers "show me all the review quotes for this brand/avatar" — the gap that left the connector
 * only ever seeing the 2-3 citations a generator chose to surface. Returns the caller's own stored
 * review quotes, verbatim and paginated, RLS-scoped to the authenticated caller.
 *
 * Identity-gated: review evidence is private user data, so an unauthenticated caller is refused.
 * MF-5: only counts/flags logged — never quote bodies.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listEvidence, EvidenceListError } from '../service/evidenceList.js';
import {
  MCP_RESPONSE_LIST_EVIDENCE_DEFAULT_LIMIT,
  MCP_RESPONSE_LIST_EVIDENCE_MAX_LIMIT,
} from '../service/contextBudgets.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z
    .string()
    .optional()
    .describe('Scope to one avatar’s evidence (plus brand-level). Omit for all of the caller’s evidence.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MCP_RESPONSE_LIST_EVIDENCE_MAX_LIMIT)
    .optional()
    .describe(`Page size (default ${MCP_RESPONSE_LIST_EVIDENCE_DEFAULT_LIMIT}, max ${MCP_RESPONSE_LIST_EVIDENCE_MAX_LIMIT}).`),
  offset: z.number().int().nonnegative().optional().describe('Offset into the newest-first quote list.'),
};

export function registerListEvidenceTool(server: McpServer): void {
  server.registerTool(
    'list_evidence',
    {
      title: 'List evidence (all review quotes)',
      description:
        'Read tool: list the authenticated caller’s stored customer-review quotes, verbatim and paginated (newest first). Pass avatar_id to scope to one avatar (plus brand-level); omit for all. Use this to show the user ALL the review evidence behind a read, not just the few quotes a generator surfaced. RLS-scoped to the caller; requires a Supabase bearer token.',
      inputSchema,
    },
    async ({ avatar_id, limit, offset }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [{ type: 'text' as const, text: 'Authentication required: review evidence is private. Send a valid Supabase bearer token.' }],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }
      const pageLimit = Math.min(limit ?? MCP_RESPONSE_LIST_EVIDENCE_DEFAULT_LIMIT, MCP_RESPONSE_LIST_EVIDENCE_MAX_LIMIT);
      const pageOffset = offset ?? 0;
      try {
        const { quotes, total, scanTruncated } = await listEvidence({ avatarId: avatar_id, limit: pageLimit, offset: pageOffset });
        safeLog({
          event: 'tool.list_evidence',
          caller: userTag(identity),
          returned: quotes.length,
          total,
          avatar_scoped: avatar_id !== undefined,
        });
        const shown = quotes.length;
        const summary =
          total === 0
            ? 'No review evidence stored yet.'
            : `${shown} of ${total}${scanTruncated ? '+' : ''} review quote(s) (offset ${pageOffset}).`;
        return {
          content: [{ type: 'text' as const, text: summary }],
          structuredContent: {
            ok: true,
            count: shown,
            total,
            offset: pageOffset,
            limit: pageLimit,
            scan_truncated: scanTruncated,
            quotes,
          },
        };
      } catch (err) {
        const note = err instanceof EvidenceListError ? err.message : 'failed to list evidence';
        safeLog({ level: 'warn', event: 'tool.list_evidence.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list evidence: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
