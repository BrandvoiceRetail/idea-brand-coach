/**
 * Layer 2 (tool) — `submit_feedback` (OWNED): the easy in-product feedback path.
 *
 * A user (or the agent on their behalf) submits a short message; it lands as a message
 * in the team's #idea-brand-coach Slack channel for consideration. Delivery goes through
 * a FeedbackSink (the Slack Incoming Webhook in SLACK_WEBHOOK_URL).
 *
 * Deliberately NOT identity-gated — anonymous callers may submit so feedback is never
 * lost; an authenticated caller is attributed via the non-reversible `userTag` (never raw
 * PII). The feedback text is the only user content sent, and it is NEVER logged (MF-5):
 * `safeLog` and analytics carry metadata only.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FeedbackSink } from '../slack/feedbackNotifier.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  message: z
    .string()
    .min(1)
    .max(5000)
    .describe('The user\'s feedback for the IDEA Brand Coach team — what worked, what broke, or what they wish it did.'),
  category: z
    .enum(['bug', 'idea', 'praise', 'question', 'other'])
    .optional()
    .describe('Optional kind of feedback. Defaults to other.'),
  context: z
    .string()
    .max(2000)
    .optional()
    .describe('Optional — what the user was doing when this came up (which tool, what they expected).'),
};

export function registerSubmitFeedbackTool(server: McpServer, notifier: FeedbackSink): void {
  server.registerTool(
    'submit_feedback',
    {
      title: 'Submit feedback',
      description:
        'Send feedback about the IDEA Brand Coach to the team, delivered to their Slack channel for consideration. Use whenever the user wants to report a bug, suggest an idea, ask the team a question, or share praise. No login required; authenticated callers are attributed by a stable anonymous tag. Only submit what the user actually said — never invent or paraphrase feedback they did not give.',
      inputSchema,
    },
    async ({ message, category, context }) => {
      const identity = getIdentity();
      const caller = userTag(identity);
      const result = await notifier.send({ message, category, context, caller });

      safeLog({
        event: 'tool.submit_feedback',
        caller,
        category: category ?? 'none',
        delivered: result.ok,
      });
      captureMcpEvent(identity.userId ?? caller, 'mcp_feedback_submitted', {
        category: category ?? 'other',
        delivered: result.ok,
      });

      if (!result.ok) {
        const note = result.note ?? 'feedback could not be delivered';
        return {
          content: [
            {
              type: 'text' as const,
              text: `Sorry — your feedback couldn't be delivered right now (${note}). Please try again in a moment.`,
            },
          ],
          structuredContent: { ok: false, delivered: false, note },
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: 'Thanks — your feedback was sent to the IDEA Brand Coach team. We read every note.',
          },
        ],
        structuredContent: { ok: true, delivered: true },
      };
    },
  );
}
