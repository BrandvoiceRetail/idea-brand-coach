/**
 * Layer 2 (tool) — `set_context_avatars` (OWNED, WRITE, gateWrite — the retrieval anchor, §2).
 *
 * Sets the caller's profile-default context set by calling the `set_context_avatars` RPC
 * (the write path for `profiles.context_avatar_ids`, ownership-checked server-side — every
 * member must be owned, raises avatar_not_owned / empty_avatar_set). This is the explicit
 * multi-avatar retrieval anchor: two-tier KB reads union `scope='brand'` with
 * `avatar_id = ANY(context_avatar_ids)`, never a single global pointer (bleed firewall).
 *
 * Distinct from `set_current_avatar` (the single-target coach seed pointer in `profiles`,
 * kept): that picks ONE avatar; this pins the explicit SET retrieval scopes against.
 * Ownership is pre-checked at the tool layer (requireOwnedAvatarSet — every member owned,
 * one shared brand) and re-enforced by the RPC server-side. Identity-gated (gateWrite);
 * the host holds no session state — the set lives in `profiles`, written only here / by the
 * SPA via the same RPC.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUserSupabase } from '../supabaseUser.js';
import { requireOwnedAvatarSet } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(12)
    .describe(
      'The avatars to anchor context retrieval on (1-12, from list_avatars). All must be owned and share one brand. Two-tier KB reads union brand-level rows with these avatars.',
    ),
};

export function registerSetContextAvatarsTool(server: McpServer): void {
  server.registerTool(
    'set_context_avatars',
    {
      title: 'Set the context avatar set',
      description:
        'Write tool: set the profile-default context avatar set via the set_context_avatars RPC (the write path for profiles.context_avatar_ids — the retrieval anchor two-tier KB reads union with brand-level scope). Pass 1-12 owned avatars sharing one brand. Distinct from set_current_avatar (the single-target coach seed). Requires an authenticated Supabase JWT; refuses any avatar you do not own.',
      inputSchema,
    },
    async ({ avatar_ids }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: setDenied } = await requireOwnedAvatarSet(avatar_ids);
      if (setDenied) return setDenied;

      const { error } = await getUserSupabase().rpc('set_context_avatars', { p_avatar_ids: avatar_ids });
      if (error) {
        const note = /avatar_not_owned/.test(error.message)
          ? 'avatar not owned'
          : /empty_avatar_set/.test(error.message)
            ? 'empty avatar set'
            : `failed to set context avatars: ${error.message}`;
        safeLog({ level: 'warn', event: 'tool.set_context_avatars.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not set context avatars: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }

      safeLog({ event: 'tool.set_context_avatars', caller: userTag(identity), count: avatar_ids.length });
      captureMcpEvent(identity.userId as string, 'mcp_context_avatars_set', { count: avatar_ids.length });
      return {
        content: [{ type: 'text' as const, text: `Context avatar set updated (${avatar_ids.length}).` }],
        structuredContent: { ok: true, context_avatar_ids: avatar_ids },
      };
    },
  );
}
