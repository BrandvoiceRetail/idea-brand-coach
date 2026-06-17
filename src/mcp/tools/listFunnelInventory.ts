/**
 * Layer 2 (tool) — `list_funnel_inventory` (OWNED, READ — funnel §4.4).
 *
 * Lists the brand's CURRENT funnel touchpoint inventory (brand-level; avatar-agnostic). The
 * brand is resolved server-side. Identity-gated read. The funnel NEVER touches the coach
 * current-avatar — inventory is brand-level by design (per-avatar scoring is get_funnel_audit).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listInventory, FunnelInventoryError } from '../service/funnelInventory.js';
import { resolveBrandId, AvatarOwnershipError } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

export function registerListFunnelInventoryTool(server: McpServer): void {
  server.registerTool(
    'list_funnel_inventory',
    {
      title: 'List funnel inventory',
      description:
        'Read tool: list the brand’s CURRENT funnel touchpoint inventory (brand-level; avatar-agnostic) — touchpoint_id, stage, context, status, overall_score. The brand is resolved server-side. RLS-scoped to the caller; requires a Supabase bearer token. Use get_funnel_audit for per-avatar scoring.',
      inputSchema: {},
    },
    async () => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: funnel inventory is private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const brandId = await resolveBrandId();
        const touchpoints = await listInventory(brandId);
        safeLog({ event: 'tool.list_funnel_inventory', caller: userTag(identity), count: touchpoints.length });
        return {
          content: [
            {
              type: 'text' as const,
              text: touchpoints.length === 0 ? 'No funnel touchpoints yet.' : `${touchpoints.length} funnel touchpoint(s).`,
            },
          ],
          structuredContent: { ok: true, count: touchpoints.length, touchpoints },
        };
      } catch (err) {
        const note =
          err instanceof FunnelInventoryError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to list funnel inventory';
        safeLog({ level: 'warn', event: 'tool.list_funnel_inventory.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list funnel inventory: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
