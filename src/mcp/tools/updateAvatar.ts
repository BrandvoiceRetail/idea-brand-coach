/**
 * Layer 2 (tool) — `update_avatar` (OWNED, WRITE, gateWrite — avatar lifecycle, §4.3).
 *
 * Enrich/edit an EXISTING avatar's content (name, description, demographics,
 * psychographics, buying behaviour, voice-of-customer). Partial: only the fields you
 * pass are written, the rest are untouched. This lets the coach flesh out a thin/
 * placeholder avatar in place instead of creating duplicates (the gap that left
 * generic avatars stuck — create_avatar existed but nothing could update them).
 * Ownership is verified (requireOwnedAvatar) after gateWrite; RLS re-checks on update.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { updateAvatar, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { AvatarOwnershipError, requireOwnedAvatar } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_id: z.string().min(1).describe('The avatar to update (from list_avatars). Must be the caller’s own.'),
  name: z.string().min(1).optional().describe('New avatar name.'),
  description: z.string().optional().describe('New short description.'),
  demographics: z.unknown().optional().describe('Demographics JSON (replaces the stored value).'),
  psychographics: z.unknown().optional().describe('Psychographics JSON (replaces the stored value).'),
  buying_behavior: z.unknown().optional().describe('Buying-behaviour JSON (replaces the stored value).'),
  voice_of_customer: z.string().optional().describe('Voice-of-customer summary (replaces the stored value).'),
};

export function registerUpdateAvatarTool(server: McpServer): void {
  server.registerTool(
    'update_avatar',
    {
      title: 'Update an avatar',
      description:
        'Write tool: enrich/edit an EXISTING avatar in place — pass avatar_id plus any of name, description, demographics, psychographics, buying_behavior, voice_of_customer. Partial update: only the fields you provide are changed; omit a field to leave it as-is. Use this (not create_avatar) to flesh out a thin/placeholder avatar so you don’t create duplicates. RLS-scoped + ownership-checked; a foreign/absent avatar_id is refused. Requires an authenticated Supabase JWT.',
      inputSchema,
    },
    async ({ avatar_id, name, description, demographics, psychographics, buying_behavior, voice_of_customer }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      try {
        const avatar = await updateAvatar(avatar_id, {
          name,
          description,
          demographics,
          psychographics,
          buyingBehavior: buying_behavior,
          voiceOfCustomer: voice_of_customer,
        });
        safeLog({ event: 'tool.update_avatar', caller: userTag(identity) });
        captureMcpEvent(identity.userId as string, 'mcp_avatar_updated', {});
        return {
          content: [{ type: 'text' as const, text: `Updated avatar “${avatar.name}”.` }],
          structuredContent: { ok: true, avatar },
        };
      } catch (err) {
        const note =
          err instanceof AvatarLifecycleError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to update avatar';
        safeLog({ level: 'warn', event: 'tool.update_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not update avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
