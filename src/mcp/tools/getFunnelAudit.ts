/**
 * Layer 2 (tool) — `get_funnel_audit` (OWNED, READ — funnel §4.4).
 *
 * Reads the CURRENT per-avatar funnel audit overlay for the brand. avatar_id defaults to the
 * brand's primary_avatar_id (locked #7) when omitted — NEVER the coach current-avatar. Returns
 * needs_input when no avatar can be resolved. Identity-gated read; ownership of the resolved
 * avatar is verified (requireOwnedAvatar) and both tables are RLS-scoped to the caller.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAudits, FunnelInventoryError } from '../service/funnelInventory.js';
import { resolveBrandId, resolvePrimaryAvatarId, requireOwnedAvatar, AvatarOwnershipError } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z
    .string()
    .optional()
    .describe('Avatar whose audits to read. Omit to default to the brand’s primary_avatar_id (NOT the coach current-avatar).'),
};

export function registerGetFunnelAuditTool(server: McpServer): void {
  server.registerTool(
    'get_funnel_audit',
    {
      title: 'Get funnel audits (per avatar)',
      description:
        'Read tool: read the CURRENT per-avatar funnel audit overlay for the brand. avatar_id defaults to the brand’s primary_avatar_id (never the coach current-avatar); returns needs_input when no avatar can be resolved. RLS-scoped to the caller; requires a Supabase bearer token.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: funnel audits are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const brandId = await resolveBrandId();
        const targetAvatar = avatar_id ?? (await resolvePrimaryAvatarId(brandId));
        if (!targetAvatar) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Needs input: no avatar to read audits for. Pass avatar_id or set a brand primary avatar (set_primary_avatar).',
              },
            ],
            structuredContent: { ok: false, needs_input: 'avatar_id', note: 'no avatar resolved' },
          };
        }

        const { denied: avatarDenied } = await requireOwnedAvatar(targetAvatar);
        if (avatarDenied) return avatarDenied;

        const audits = await getAudits(brandId, targetAvatar);
        safeLog({ event: 'tool.get_funnel_audit', caller: userTag(identity), count: audits.length });
        return {
          content: [
            {
              type: 'text' as const,
              text: audits.length === 0 ? 'No funnel audits for that avatar yet.' : `${audits.length} funnel audit(s).`,
            },
          ],
          structuredContent: { ok: true, count: audits.length, avatar_id: targetAvatar, audits },
        };
      } catch (err) {
        const note =
          err instanceof FunnelInventoryError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to read funnel audits';
        safeLog({ level: 'warn', event: 'tool.get_funnel_audit.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read funnel audits: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
