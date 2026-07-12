/**
 * Layer 2 (tool) — `delete_avatar` (OWNED, WRITE, gateWrite — avatar lifecycle, §4.3).
 *
 * Delete an avatar so the coach can clear out generic/placeholder avatars instead of
 * leaving clutter. GUARDED: deleting an avatar CASCADE-removes its funnel pieces,
 * split-tests, diagnostics and KB (and SET-NULLs the brand primary / coach current
 * pointers), so when the avatar has real work attached we REFUSE unless force=true,
 * returning the counts so the coach can confirm with the user first. Empty placeholders
 * (no dependents) delete immediately. Ownership verified (requireOwnedAvatar) after gateWrite.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { deleteAvatar, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { AvatarOwnershipError, requireOwnedAvatar } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_id: z.string().min(1).describe('The avatar to delete (from list_avatars). Must be the caller’s own.'),
  force: z
    .boolean()
    .optional()
    .describe('Confirm deletion even when the avatar has real work attached (funnel pieces, tests, diagnostics) — this also removes that work. Defaults to false → the call is refused (with the counts) when dependents exist, so you can confirm with the user first.'),
};

export function registerDeleteAvatarTool(server: McpServer): void {
  server.registerTool(
    'delete_avatar',
    {
      title: 'Delete an avatar',
      description:
        'Write tool: delete an avatar (e.g. to clear a generic placeholder). GUARDED — deleting an avatar also removes its funnel pieces, split-tests, diagnostics and KB, and clears the brand-primary / current pointers. If the avatar has any of that work and force is not set, the call is REFUSED and returns the dependent counts so you can confirm with the user; pass force=true to delete it and its data. Empty placeholders delete immediately. RLS-scoped + ownership-checked; a foreign/absent avatar_id is refused. Requires an authenticated Supabase JWT.',
      inputSchema,
    },
    async ({ avatar_id, force }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      try {
        const result = await deleteAvatar(avatar_id, force ?? false);

        if (result.refusedForDependents) {
          const { brandAssets, brandTests, diagnostics } = result.dependents;
          safeLog({ event: 'tool.delete_avatar.refused', caller: userTag(identity) });
          return {
            content: [
              {
                type: 'text' as const,
                text: `“${result.name}” has work attached — ${brandAssets} funnel piece(s), ${brandTests} test(s), ${diagnostics} diagnostic(s). Deleting it removes that too. Confirm with the user, then call delete_avatar again with force=true.`,
              },
            ],
            structuredContent: { ok: false, refused: true, ...result },
          };
        }

        safeLog({ event: 'tool.delete_avatar', caller: userTag(identity), forced: force ?? false });
        captureMcpEvent(identity.userId as string, 'mcp_avatar_deleted', { forced: force ?? false });
        return {
          content: [{ type: 'text' as const, text: `Deleted avatar “${result.name}”.` }],
          structuredContent: { ok: true, ...result },
        };
      } catch (err) {
        const note =
          err instanceof AvatarLifecycleError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to delete avatar';
        safeLog({ level: 'warn', event: 'tool.delete_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not delete avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
