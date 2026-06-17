/**
 * Layer 2 (tool) — `get_funnel_coverage` (OWNED read).
 *
 * Summarises how on-brand the tracked funnel is, aggregated from brand-coach's own
 * `brand_assets` (RLS-scoped to the caller). Self-contained — no taxonomy import; coverage
 * is aligned ÷ tracked over the assets that exist, with a per-stage breakdown.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z.string().describe('Avatar whose funnel coverage to summarise.'),
};

type StatusCounts = { aligned: number; stale: number; misaligned: number; pending: number; failed: number };

export function registerGetFunnelCoverageTool(server: McpServer): void {
  server.registerTool(
    'get_funnel_coverage',
    {
      title: 'Funnel coverage summary',
      description:
        'Summarise how on-brand the tracked funnel is: counts by status and on-brand coverage (aligned ÷ tracked), with a per-stage breakdown. RLS-scoped to the caller. (Missing/untracked touchpoints are shown in the app, not here.)',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [{ type: 'text' as const, text: 'Denied: get_funnel_coverage requires an authenticated caller.' }],
          structuredContent: { ok: false, note: 'unauthenticated' },
          isError: true,
        };
      }
      const supabase = getUserSupabase();
      const { data, error } = await supabase
        .from('brand_assets')
        .select('stage, status')
        .eq('avatar_id', avatar_id)
        .is('superseded_by', null);
      if (error) {
        safeLog({ level: 'warn', event: 'tool.get_funnel_coverage.failed', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `get_funnel_coverage failed: ${error.message}` }],
          structuredContent: { ok: false, note: error.message },
          isError: true,
        };
      }
      const rows = data ?? [];
      const counts: StatusCounts = { aligned: 0, stale: 0, misaligned: 0, pending: 0, failed: 0 };
      const byStage: Record<string, number> = {};
      for (const r of rows) {
        const s = r.status as keyof StatusCounts;
        if (s in counts) counts[s] += 1;
        const stage = r.stage as string;
        byStage[stage] = (byStage[stage] ?? 0) + 1;
      }
      const tracked = rows.length;
      const coverage_pct = tracked ? Math.round((counts.aligned / tracked) * 100) : 0;
      safeLog({ event: 'tool.get_funnel_coverage', caller: userTag(identity), tracked });
      return {
        content: [{ type: 'text' as const, text: `On-brand coverage: ${coverage_pct}% of ${tracked} tracked.\n${JSON.stringify({ counts, by_stage: byStage }, null, 2)}` }],
        structuredContent: { ok: true, tracked, coverage_pct, counts, by_stage: byStage },
      };
    },
  );
}
