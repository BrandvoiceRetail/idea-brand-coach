/**
 * Layer 2 (tool) — `run_funnel_audit` (OWNED, WRITE, gateWrite — funnel §4.4).
 *
 * Scores ONE brand-level funnel touchpoint (brand_asset_id) for ONE avatar, writing a
 * per-avatar overlay via the save_asset_audit_atomic RPC. avatar_id defaults to the brand's
 * primary_avatar_id (locked #7) when omitted — it NEVER reads the coach current-avatar. The
 * chosen avatar's ownership is verified before the write (requireOwnedAvatar) and the RPC
 * re-checks ownership + same-brand coupling. Returns needs_input when no avatar can be
 * resolved (none passed and no brand primary set). Identity-gated (gateWrite).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runAudit, FunnelInventoryError } from '../service/funnelInventory.js';
import { resolveBrandId, resolvePrimaryAvatarId, requireOwnedAvatar, AvatarOwnershipError } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  brand_asset_id: z.string().min(1).describe('The funnel touchpoint to score (a brand_assets id from list_funnel_inventory).'),
  avatar_id: z
    .string()
    .optional()
    .describe('Avatar to score for. Omit to default to the brand’s primary_avatar_id (NOT the coach current-avatar).'),
  overall_score: z.number().int().optional().describe('Optional overall score for the touchpoint under this avatar.'),
  audit_result: z.unknown().optional().describe('Optional structured audit result JSON.'),
  grounding: z.enum(['evidence', 'inference']).optional().describe('Grounding for the audit (default inference).'),
};

export function registerRunFunnelAuditTool(server: McpServer): void {
  server.registerTool(
    'run_funnel_audit',
    {
      title: 'Run a funnel audit (per avatar)',
      description:
        'Write tool: score one funnel touchpoint (brand_asset_id) for one avatar, writing a per-avatar overlay via save_asset_audit_atomic. avatar_id defaults to the brand’s primary_avatar_id (never the coach current-avatar); returns needs_input when no avatar can be resolved. Requires an authenticated Supabase JWT and ownership of the avatar.',
      inputSchema,
    },
    async ({ brand_asset_id, avatar_id, overall_score, audit_result, grounding }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const brandId = await resolveBrandId();
        const targetAvatar = avatar_id ?? (await resolvePrimaryAvatarId(brandId));
        if (!targetAvatar) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Needs input: no avatar to audit for. Pass avatar_id or set a brand primary avatar (set_primary_avatar).',
              },
            ],
            structuredContent: { ok: false, needs_input: 'avatar_id', note: 'no avatar resolved' },
          };
        }

        const { denied: avatarDenied } = await requireOwnedAvatar(targetAvatar);
        if (avatarDenied) return avatarDenied;

        const audit = await runAudit({
          brandAssetId: brand_asset_id,
          avatarId: targetAvatar,
          overallScore: overall_score ?? null,
          auditResult: audit_result ?? null,
          grounding: grounding ?? 'inference',
        });
        safeLog({ event: 'tool.run_funnel_audit', caller: userTag(identity), defaulted: avatar_id === undefined });
        captureMcpEvent(identity.userId as string, 'mcp_funnel_audit_run', { defaulted: avatar_id === undefined });
        return {
          content: [{ type: 'text' as const, text: `Funnel audit recorded for the touchpoint (avatar ${targetAvatar}).` }],
          structuredContent: { ok: true, audit, avatar_id: targetAvatar },
        };
      } catch (err) {
        const raw =
          err instanceof FunnelInventoryError || err instanceof AvatarOwnershipError ? err.message : '';
        // Surface the RPC's structured ownership/coupling exceptions as clean denials
        // (mirrors set_current_avatar's avatar_not_owned handling) rather than leaking the
        // raw Postgres message; everything else collapses to a generic note.
        const note = /asset_not_owned/.test(raw)
          ? 'asset not owned'
          : /avatar_not_owned/.test(raw)
            ? 'avatar not owned'
            : /avatar_has_no_brand/.test(raw)
              ? 'avatar has no brand'
              : /brand_mismatch/.test(raw)
                ? 'asset and avatar belong to different brands'
                : raw || 'failed to run funnel audit';
        safeLog({ level: 'warn', event: 'tool.run_funnel_audit.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not run funnel audit: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
