/**
 * Layer 2 (tool) — `list_coach_conversations` (OWNED, READ — per-avatar thread index).
 *
 * Lists the caller's Brand-Coach chat threads, newest-active first, each annotated with
 * its avatar (`avatar_id` + resolved `avatar_name`; null = brand-level) and turn count —
 * the discovery surface for "conversations per avatar". With `avatar_id` set it returns
 * only that avatar's threads; omitted, every thread (each carrying its avatar so an agent
 * can group per avatar).
 *
 * Identity-gated read: coach threads are private user data, so an unauthenticated caller
 * is refused (the JWT-bound RLS client cannot read another user's rows). MF-5: only
 * counts/flags are logged — never titles or message content.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listConversations, CoachConversationError } from '../service/coachConversations.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z
    .string()
    .optional()
    .describe('Filter to one avatar’s threads. Omit to list every coach thread (each carries its own avatar_id).'),
};

export function registerListCoachConversationsTool(server: McpServer): void {
  server.registerTool(
    'list_coach_conversations',
    {
      title: 'List coach conversations (per avatar)',
      description:
        'Read tool: list the authenticated caller’s Brand-Coach chat threads (newest-active first), each with its avatar (avatar_id + avatar_name; null = brand-level), conversation_type, field context, turn count, and timestamps. Pass avatar_id to scope to one avatar; omit for all threads. RLS-scoped to the caller; requires a Supabase bearer token. Use get_coach_conversation for a thread’s full transcript.',
      inputSchema,
    },
    async ({ avatar_id }) => {
      const identity = getIdentity();
      if (!identity.authenticated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Authentication required: coach conversations are private. Send a valid Supabase bearer token in the Authorization header.',
            },
          ],
          structuredContent: { ok: false, note: 'authentication required' },
          isError: true,
        };
      }

      try {
        const conversations = await listConversations({ avatarId: avatar_id });
        safeLog({
          event: 'tool.list_coach_conversations',
          caller: userTag(identity),
          count: conversations.length,
          avatar_scoped: avatar_id !== undefined,
        });
        const summary =
          conversations.length === 0
            ? avatar_id !== undefined
              ? 'No coach conversations for that avatar yet.'
              : 'No coach conversations yet.'
            : `${conversations.length} coach conversation(s)${avatar_id !== undefined ? ' for the avatar' : ''}.`;
        return {
          content: [{ type: 'text' as const, text: summary }],
          structuredContent: { ok: true, count: conversations.length, conversations },
        };
      } catch (err) {
        const note = err instanceof CoachConversationError ? err.message : 'failed to list conversations';
        safeLog({ level: 'warn', event: 'tool.list_coach_conversations.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not list conversations: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
