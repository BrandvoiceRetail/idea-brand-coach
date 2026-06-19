/**
 * Layer 2 (tool) — `list_avatars` (OWNED, READ — avatar lifecycle, §4.3).
 *
 * Lists the caller's avatars (newest-updated first) with the lifecycle-relevant columns
 * (id, brand_id, name, description, is_primary). The discovery surface for which avatar_id
 * to pass to the scoped generators / funnel audits. Identity-gated (private user data).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listAvatars, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

export function registerListAvatarsTool(server: McpServer): void {
  server.registerTool(
    'list_avatars',
    {
      title: 'List avatars',
      description:
        'Read tool: list the authenticated caller’s avatars (newest-updated first) with id, brand_id, name, description, and is_primary. RLS-scoped to the caller; requires a Supabase bearer token. Use an id here as the avatar_id for scoped generators or funnel audits.',
      inputSchema: {},
    },
    async () => {
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
        const avatars = await listAvatars();
        safeLog({ event: 'tool.list_avatars', caller: userTag(identity), count: avatars.length });
        return {
          content: [
            {
              type: 'text' as const,
              text: avatars.length === 0 ? 'No avatars yet.' : `${avatars.length} avatar(s).`,
            },
          ],
          structuredContent: { ok: true, count: avatars.length, avatars },
        };
      } catch (err) {
        const note = err instanceof AvatarLifecycleError ? err.message : 'failed to list avatars';
        safeLog({ level: 'warn', event: 'tool.list_avatars.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list avatars: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
