/**
 * Layer 2 (tool) — `set_primary_avatar` (OWNED, WRITE, gateWrite — avatar lifecycle, §4.3).
 *
 * Pins `avatar_id` as the brand's PRIMARY avatar by calling the `set_primary_avatar` RPC
 * (clears the prior primary, sets `avatars.is_primary`, mirrors `brands.primary_avatar_id`,
 * all in one tx, P1). This is the ONLY MCP write path for `brands.primary_avatar_id` — the
 * pointer the funnel-audit tools default `avatar_id` to (locked #7). Distinct from the coach
 * current-avatar (`set_current_avatar`): the primary is a brand-level default, the current is
 * the coach session pointer in `profiles`.
 *
 * Ownership is pre-checked at the tool layer (requireOwnedAvatar) and re-enforced by the RPC
 * server-side (raises avatar_not_owned / avatar_has_no_brand, surfaced as clean denials).
 * Identity-gated (gateWrite); the host holds no session state.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_id: z
    .string()
    .min(1)
    .describe('The avatar to pin as the brand primary (from list_avatars). Must be owned and have a brand.'),
};

export function registerSetPrimaryAvatarTool(server: McpServer): void {
  server.registerTool(
    'set_primary_avatar',
    {
      title: 'Set the brand primary avatar',
      description:
        'Write tool: pin avatar_id as the brand’s primary avatar via the set_primary_avatar RPC (the sole write path for brands.primary_avatar_id — the default the funnel-audit tools use). Distinct from set_current_avatar (the coach session pointer). Requires an authenticated Supabase JWT; refuses an avatar you do not own.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const { error } = await getUserSupabase().rpc('set_primary_avatar', { p_avatar_id: avatar_id });
      if (error) {
        const note = /avatar_not_owned/.test(error.message)
          ? 'avatar not owned'
          : /avatar_has_no_brand/.test(error.message)
            ? 'avatar has no brand'
            : `failed to set primary avatar: ${error.message}`;
        safeLog({ level: 'warn', event: 'tool.set_primary_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not set primary avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }

      safeLog({ event: 'tool.set_primary_avatar', caller: userTag(identity) });
      captureMcpEvent(identity.userId as string, 'mcp_primary_avatar_set', {});
      return {
        content: [{ type: 'text' as const, text: 'Brand primary avatar set.' }],
        structuredContent: { ok: true, primary_avatar_id: avatar_id },
      };
    },
  );
}
