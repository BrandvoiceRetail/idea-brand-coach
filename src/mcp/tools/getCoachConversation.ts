/**
 * Layer 2 (tool) — `get_coach_conversation` (OWNED, READ — one thread transcript).
 *
 * Returns one Brand-Coach chat thread by session id with its full transcript (oldest
 * turn first) plus the thread's avatar scope (avatar_id + avatar_name; null = brand-
 * level). The companion to `list_coach_conversations`: list to find a thread, then read
 * its turns here.
 *
 * Identity-gated read: threads are private user data, refused for anonymous callers. A
 * thread that isn't the caller's (RLS) / doesn't exist resolves to a plain not-found
 * (ok:false, not an error). MF-5: only counts are logged — never titles or content.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConversation, CoachConversationError } from '../service/coachConversations.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  session_id: z.string().min(1).describe('The conversation/session id (from list_coach_conversations).'),
};

export function registerGetCoachConversationTool(server: McpServer): void {
  server.registerTool(
    'get_coach_conversation',
    {
      title: 'Get a coach conversation transcript',
      description:
        'Read tool: fetch one Brand-Coach chat thread by session_id — its avatar scope (avatar_id + avatar_name; null = brand-level), metadata, and the full transcript (role + content per turn, oldest first). RLS-scoped to the caller; requires a Supabase bearer token. Returns ok:false/not found when the thread is not the caller’s or does not exist.',
      inputSchema,
    },
    async ({ session_id }) => {
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
        const conversation = await getConversation(session_id);
        if (!conversation) {
          safeLog({ event: 'tool.get_coach_conversation', caller: userTag(identity), found: false });
          return {
            content: [{ type: 'text' as const, text: 'No conversation found for that id.' }],
            structuredContent: { ok: false, note: 'not found' },
          };
        }
        safeLog({
          event: 'tool.get_coach_conversation',
          caller: userTag(identity),
          found: true,
          messages: conversation.message_count,
        });
        const { messages, message_count, ...meta } = conversation;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Conversation “${conversation.title}” — ${message_count} turn(s)${conversation.avatar_name ? ` (avatar: ${conversation.avatar_name})` : ''}.`,
            },
          ],
          structuredContent: { ok: true, conversation: meta, messages, message_count },
        };
      } catch (err) {
        const note = err instanceof CoachConversationError ? err.message : 'failed to read conversation';
        safeLog({ level: 'warn', event: 'tool.get_coach_conversation.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not read conversation: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
