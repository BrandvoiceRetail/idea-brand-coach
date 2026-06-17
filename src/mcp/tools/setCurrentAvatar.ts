/**
 * Layer 2 (tool) — `set_current_avatar` (OWNED, WRITE, gateWrite — the avatar-switch, §2).
 *
 * Points the coach current-avatar at `avatar_id` by calling the `set_current_avatar` RPC
 * (the SOLE write path for profiles.current_avatar_id, P1). The RPC is ownership-checked
 * server-side (raises avatar_not_owned for a foreign avatar), so the MCP holds NO session
 * state — it only invokes the RPC; the SPA reads the pointer (Phase 4). Pass null to clear.
 *
 * Identity-gated (gateWrite). This is the §2 avatar-switch contract: the MCP is stateless;
 * the current avatar lives in profiles, written only here / by the SPA via the same RPC.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_id: z
    .string()
    .nullable()
    .optional()
    .describe('The avatar to make current (from list_avatars). Pass null to clear the current avatar.'),
};

export function registerSetCurrentAvatarTool(server: McpServer): void {
  server.registerTool(
    'set_current_avatar',
    {
      title: 'Set the coach current avatar',
      description:
        'Write tool: point the coach current-avatar at avatar_id via the set_current_avatar RPC (ownership-checked server-side; the sole write path for the pointer the SPA reads). Pass null to clear. The MCP holds no session state. Requires an authenticated Supabase JWT; refuses an avatar you do not own.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const target = avatar_id ?? null;
      const { error } = await getUserSupabase().rpc('set_current_avatar', { p_avatar_id: target });
      if (error) {
        const note = /avatar_not_owned/.test(error.message)
          ? 'avatar not owned'
          : `failed to set current avatar: ${error.message}`;
        safeLog({ level: 'warn', event: 'tool.set_current_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not set current avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }

      safeLog({ event: 'tool.set_current_avatar', caller: userTag(identity), cleared: target === null });
      captureMcpEvent(identity.userId as string, 'mcp_current_avatar_set', { cleared: target === null });
      return {
        content: [
          { type: 'text' as const, text: target === null ? 'Cleared the current avatar.' : 'Current avatar set.' },
        ],
        structuredContent: { ok: true, current_avatar_id: target },
      };
    },
  );
}
