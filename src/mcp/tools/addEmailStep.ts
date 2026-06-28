/**
 * Layer 2 (tool) — `add_email_step` (OWNED, WRITE, gateWrite — email sequences).
 *
 * Appends a step to a sequence the caller owns. Ownership is verified server-side first (a foreign
 * or absent sequence_id is a clean not-found, never a cross-linked write); `user_id` is denormalised
 * onto the step so it is directly RLS-scoped. Identity-gated (gateWrite). The (sequence_id,
 * step_number) unique index keeps step ordinals unique — re-using one surfaces a clean error.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addEmailStep, EmailSequenceError } from '../service/emailSequenceService.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  sequence_id: z.string().min(1).describe('The sequence id (from list_sequences) to add a step to.'),
  step_number: z.number().int().positive().describe('1-based ordinal of the step within the sequence.'),
  subject: z.string().min(1).describe('Email subject line.'),
  body: z.string().min(1).describe('Email body content.'),
  delay_hours: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Delay in hours from the prior step / trigger (default 0).'),
  email_type: z.string().optional().describe('Freeform tag (e.g. welcome, value, offer).'),
  trigger_event: z.string().optional().describe('Trigger event (e.g. signup, cart_abandoned).'),
};

export function registerAddEmailStepTool(server: McpServer): void {
  server.registerTool(
    'add_email_step',
    {
      title: 'Add an email step',
      description:
        'Write tool: append a step (subject, body, delay_hours, email_type, trigger_event) to a sequence the caller owns. Sequence ownership is verified server-side. Requires an authenticated Supabase JWT; RLS-scoped to the caller. step_number must be unique within the sequence.',
      inputSchema,
    },
    async ({ sequence_id, step_number, subject, body, delay_hours, email_type, trigger_event }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      try {
        const step = await addEmailStep({
          sequence_id,
          step_number,
          subject,
          body,
          delay_hours,
          email_type: email_type ?? null,
          trigger_event: trigger_event ?? null,
        });

        safeLog({ event: 'tool.add_email_step', caller: userTag(identity), step_number });
        captureMcpEvent(identity.userId as string, 'mcp_email_step_added', { step_number });
        return {
          content: [
            { type: 'text' as const, text: `Added step ${step.step_number}: “${step.subject}”.` },
          ],
          structuredContent: { ok: true, step },
        };
      } catch (err) {
        const note = err instanceof EmailSequenceError ? err.message : 'failed to add email step';
        safeLog({ level: 'warn', event: 'tool.add_email_step.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not add email step: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
