/**
 * Layer 2 (tool) — `create_avatar` (OWNED, WRITE, gateWrite — avatar lifecycle, §4.3).
 *
 * Creates an avatar under the caller's brand. `brand_id` is resolved SERVER-SIDE from the
 * caller's brand (avatarOwnership.resolveBrandId) and stamped on the row — NEVER taken from
 * the caller (security: a caller cannot plant an avatar under a foreign brand). Optionally
 * flips it to the coach current-avatar via the `set_current_avatar` RPC (the sole pointer
 * write path; the MCP holds no session state). Identity-gated (gateWrite).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAvatar, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { AvatarOwnershipError } from '../service/avatarOwnership.js';
import { getUserSupabase } from '../supabaseUser.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  name: z.string().min(1).describe('Avatar name (e.g. "The Weekend Collector").'),
  description: z.string().optional().describe('Short description of the avatar.'),
  demographics: z.unknown().optional().describe('Optional demographics JSON.'),
  psychographics: z.unknown().optional().describe('Optional psychographics JSON.'),
  buying_behavior: z.unknown().optional().describe('Optional buying-behavior JSON.'),
  voice_of_customer: z.string().optional().describe('Optional voice-of-customer summary.'),
  set_current: z
    .boolean()
    .default(false)
    .describe('When true, point the coach current-avatar at the new avatar (set_current_avatar RPC).'),
};

export function registerCreateAvatarTool(server: McpServer): void {
  server.registerTool(
    'create_avatar',
    {
      title: 'Create an avatar',
      description:
        'Write tool: create an avatar under the authenticated caller’s brand. brand_id is resolved server-side and stamped (never caller-supplied). Optionally sets it as the coach current-avatar (set_current). Requires an authenticated Supabase JWT; RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ name, description, demographics, psychographics, buying_behavior, voice_of_customer, set_current }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const avatar = await createAvatar({
          name,
          description: description ?? null,
          demographics,
          psychographics,
          buyingBehavior: buying_behavior,
          voiceOfCustomer: voice_of_customer ?? null,
        });

        let setCurrent = false;
        if (set_current) {
          const { error } = await getUserSupabase().rpc('set_current_avatar', { p_avatar_id: avatar.id });
          if (error) throw new AvatarLifecycleError(`created avatar but failed to set current: ${error.message}`, error);
          setCurrent = true;
        }

        safeLog({ event: 'tool.create_avatar', caller: userTag(identity), set_current: setCurrent });
        captureMcpEvent(identity.userId as string, 'mcp_avatar_created', { set_current: setCurrent });
        return {
          content: [{ type: 'text' as const, text: `Created avatar “${avatar.name}”${setCurrent ? ' (now current)' : ''}.` }],
          structuredContent: { ok: true, avatar, set_current: setCurrent },
        };
      } catch (err) {
        const note =
          err instanceof AvatarLifecycleError || err instanceof AvatarOwnershipError
            ? err.message
            : 'failed to create avatar';
        safeLog({ level: 'warn', event: 'tool.create_avatar.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not create avatar: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
