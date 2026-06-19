/**
 * Layer 2 (tool) — `get_avatar` (OWNED, READ — avatar lifecycle, §4.3).
 *
 * Reads one avatar by id (RLS-scoped to the caller) plus its forensic build state. Returns
 * ok:false/not-found when the avatar is not the caller's or does not exist. Identity-gated.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAvatar, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { getUserSupabase } from '../supabaseUser.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z.string().min(1).describe('The avatar id (from list_avatars).'),
};

export function registerGetAvatarTool(server: McpServer): void {
  server.registerTool(
    'get_avatar',
    {
      title: 'Get an avatar',
      description:
        'Read tool: fetch one avatar by avatar_id (id, brand_id, name, description, is_primary) plus its forensic build_state (stages_done, status). RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:false/not found when the avatar is not the caller’s or does not exist.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: avatars are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const avatar = await getAvatar(avatar_id);
        if (!avatar) {
          safeLog({ event: 'tool.get_avatar', caller: userTag(identity), found: false });
          return {
            content: [{ type: 'text' as const, text: 'No avatar found for that id.' }],
            structuredContent: { ok: false, note: 'not found' },
          };
        }
        // Build state is a sibling read; absent state is normal (not an error).
        const { data: build } = await getUserSupabase()
          .from('avatar_build_state')
          .select('stages_done, status, approved_at, updated_at')
          .eq('avatar_id', avatar_id)
          .maybeSingle();

        safeLog({ event: 'tool.get_avatar', caller: userTag(identity), found: true });
        return {
          content: [{ type: 'text' as const, text: `Avatar “${avatar.name}”${avatar.is_primary ? ' (primary)' : ''}.` }],
          structuredContent: { ok: true, avatar, build_state: build ?? null },
        };
      } catch (err) {
        const note = err instanceof AvatarLifecycleError ? err.message : 'failed to read avatar';
        safeLog({ level: 'warn', event: 'tool.get_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
