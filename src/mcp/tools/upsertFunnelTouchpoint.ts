/**
 * Layer 2 (tool) — `upsert_funnel_touchpoint` (OWNED, WRITE, gateWrite — funnel §4.4).
 *
 * Creates or updates ONE brand-level funnel touchpoint (brand_assets, avatar_id NULL). NO
 * avatar_id input by design — the funnel inventory is brand-level; per-avatar scoring is the
 * separate run_funnel_audit overlay. brand_id is resolved server-side (never caller-supplied).
 * Identity-gated (gateWrite). Never reads/writes the coach current-avatar.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { upsertTouchpoint, FunnelInventoryError } from '../service/funnelInventory.js';
import { resolveBrandId, AvatarOwnershipError } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  touchpoint_id: z.string().min(1).describe('Stable touchpoint key (e.g. "amazon_listing", "homepage").'),
  stage: z.string().min(1).describe('Funnel stage (e.g. "awareness", "consideration", "conversion").'),
  context_description: z.string().min(1).describe('What this touchpoint is / does (context for scoring).'),
  status: z.string().optional().describe('Inventory status (default "pending").'),
};

export function registerUpsertFunnelTouchpointTool(server: McpServer): void {
  server.registerTool(
    'upsert_funnel_touchpoint',
    {
      title: 'Upsert a funnel touchpoint',
      description:
        'Write tool: create or update one BRAND-LEVEL funnel touchpoint (no avatar — inventory is brand-level). Keyed by (brand, touchpoint_id); brand_id is resolved server-side. Requires an authenticated Supabase JWT. Use run_funnel_audit to score a touchpoint per avatar.',
      inputSchema,
    },
    async ({ touchpoint_id, stage, context_description, status }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const brandId = await resolveBrandId();
        const touchpoint = await upsertTouchpoint({
          brandId,
          touchpointId: touchpoint_id,
          stage,
          contextDescription: context_description,
          status,
        });
        safeLog({ event: 'tool.upsert_funnel_touchpoint', caller: userTag(identity), stage });
        captureMcpEvent(identity.userId as string, 'mcp_funnel_touchpoint_upserted', { stage });
        return {
          content: [{ type: 'text' as const, text: `Touchpoint “${touchpoint.touchpoint_id}” saved (${touchpoint.stage}).` }],
          structuredContent: { ok: true, touchpoint },
        };
      } catch (err) {
        const note =
          err instanceof FunnelInventoryError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to upsert funnel touchpoint';
        safeLog({ level: 'warn', event: 'tool.upsert_funnel_touchpoint.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not upsert touchpoint: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
