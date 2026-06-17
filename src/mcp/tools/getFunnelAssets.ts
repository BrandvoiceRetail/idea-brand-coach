/**
 * Layer 2 (tool) — `get_funnel_assets` (OWNED read; brand-coach is system of record).
 *
 * Lists the brand's tracked Brand Funnel Tracker assets straight from brand-coach's own
 * `brand_assets` table via the JWT-bound client, so RLS scopes every row to the caller.
 * Decoupled from D5 (no IV-OS dependency).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z.string().describe('Avatar whose funnel assets to list.'),
  limit: z.number().int().positive().max(200).optional(),
};

export function registerGetFunnelAssetsTool(server: McpServer): void {
  server.registerTool(
    'get_funnel_assets',
    {
      title: 'List funnel assets',
      description:
        "List the brand's tracked funnel assets (brand-coach owned). Each row carries its touchpoint, funnel stage, status (aligned/stale/misaligned/pending/failed), audit score, and how many brand strategy fields the audit used. RLS-scoped to the caller; requires an authenticated Supabase bearer.",
      inputSchema,
    },
    async ({ avatar_id, limit }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [{ type: 'text' as const, text: 'Denied: get_funnel_assets requires an authenticated caller.' }],
          structuredContent: { ok: false, note: 'unauthenticated' },
          isError: true,
        };
      }
      const supabase = getUserSupabase();
      const { data, error } = await supabase
        .from('brand_assets')
        .select('id, touchpoint_id, stage, status, overall_score, audit_result, created_at')
        .eq('avatar_id', avatar_id)
        .is('superseded_by', null)
        .order('created_at', { ascending: false })
        .limit(limit ?? 100);
      if (error) {
        safeLog({ level: 'warn', event: 'tool.get_funnel_assets.failed', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `get_funnel_assets failed: ${error.message}` }],
          structuredContent: { ok: false, note: error.message },
          isError: true,
        };
      }
      const assets = (data ?? []).map((a) => ({
        id: a.id,
        touchpoint_id: a.touchpoint_id,
        stage: a.stage,
        status: a.status,
        overall_score: a.overall_score,
        fields_used: (a.audit_result as { grounding?: { fields_used?: number } } | null)?.grounding?.fields_used ?? null,
      }));
      safeLog({ event: 'tool.get_funnel_assets', caller: userTag(identity), count: assets.length });
      return {
        content: [{ type: 'text' as const, text: `${assets.length} funnel asset(s).\n${JSON.stringify(assets, null, 2)}` }],
        structuredContent: { ok: true, assets },
      };
    },
  );
}
