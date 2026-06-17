/**
 * Layer 2 (tool) — `audit_asset` (OWNED write; identity-gated).
 *
 * Re-scores a funnel asset by invoking the existing `audit-asset` edge function through
 * the caller's JWT-bound client (calculation parity — the host does NOT re-implement
 * scoring), then returns the persisted verdict. RLS scopes the read/write to the caller.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

const inputSchema = {
  asset_id: z.string().describe('The brand_assets id to (re-)audit.'),
};

export function registerAuditAssetTool(server: McpServer): void {
  server.registerTool(
    'audit_asset',
    {
      title: 'Audit a funnel asset',
      description:
        'Re-score one funnel asset against the avatar + Signature on the four IDEA dimensions via the audit-asset engine, and return the persisted verdict (status + scores + a concrete fix). Identity-gated; RLS-scoped to the caller; reuses the live edge function (no re-scoring here).',
      inputSchema,
    },
    async ({ asset_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      try {
        const supabase = getUserSupabase();
        const { error: fnErr } = await supabase.functions.invoke('audit-asset', { body: { assetId: asset_id } });
        if (fnErr) throw new Error(fnErr.message ?? 'audit failed');

        const { data: fresh, error } = await supabase
          .from('brand_assets')
          .select('id, touchpoint_id, status, overall_score, audit_result')
          .eq('id', asset_id)
          .single();
        if (error) throw error;

        captureMcpEvent(identity.userId as string, 'mcp_funnel_asset_audited', {
          status: fresh.status,
          score: fresh.overall_score ?? -1,
        });
        safeLog({ event: 'tool.audit_asset', caller: userTag(identity), status: fresh.status });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Audited ${fresh.touchpoint_id}: ${fresh.status} (${fresh.overall_score ?? '—'}/100).\n${JSON.stringify(fresh.audit_result, null, 2)}`,
            },
          ],
          structuredContent: { ok: true, asset: fresh },
        };
      } catch (err) {
        const note = err instanceof Error ? err.message : 'audit failed';
        safeLog({ level: 'warn', event: 'tool.audit_asset.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'audit_asset' });
        return {
          content: [{ type: 'text' as const, text: `audit_asset failed: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
