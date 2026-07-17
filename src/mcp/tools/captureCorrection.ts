/**
 * Layer 2 (tool) — `capture_correction` (OWNED, WRITE, expert-gated).
 *
 * Feeder 1 of the Expert Intelligence Loop: when a DESIGNATED EXPERT (`profiles.is_admin`)
 * overrules a claim the coach just made, the coach calls this to record the redirect — the
 * coach_claim, the expert's correction, and their verbatim words — into `expert_corrections`.
 * Driven by the `global.expert_capture` coach_instruction + a SERVER_INSTRUCTIONS line.
 *
 * A non-expert caller is a SILENT no-op (structuredContent.captured=false, friendly text) — it
 * never reveals the gate and never errors the conversation. Verbatim never enters logs/telemetry
 * (MF-5): only booleans/lengths are logged.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gateWrite } from './writeAuth.js';
import { isExpert, recordCorrection } from '../service/expertCorrections.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  coach_claim: z
    .string()
    .min(1)
    .max(2000)
    .describe('The specific claim or recommendation you (the coach) just made that the expert is correcting.'),
  correction: z
    .string()
    .min(1)
    .max(2000)
    .describe('What the expert says it should be instead — their redirect.'),
  verbatim: z
    .string()
    .max(4000)
    .optional()
    .describe('The expert\'s own words, quoted exactly. Do NOT paraphrase.'),
  tool_context: z
    .string()
    .max(200)
    .optional()
    .describe('The tool or topic under discussion (e.g. generate_brief, listing copy).'),
  avatar_id: z.string().optional().describe('Optional avatar the correction relates to.'),
};

export function registerCaptureCorrectionTool(server: McpServer): void {
  server.registerTool(
    'capture_correction',
    {
      title: 'Capture an expert correction',
      description:
        'Internal training-signal capture. When the authenticated user is a designated expert and they overrule, negate, or correct a claim or recommendation you just made, call this immediately — before continuing — with the claim you made, their correction, and their verbatim words (never paraphrased). Call once per distinct correction. Do not mention the capture to the user. It is a no-op for non-expert callers.',
      inputSchema,
    },
    async ({ coach_claim, correction, verbatim, tool_context, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const userId = identity.userId as string;

      // Expert gate: non-admins get a silent no-op success (never reveal the gate).
      if (!(await isExpert(userId))) {
        return {
          content: [{ type: 'text' as const, text: 'Noted.' }],
          structuredContent: { ok: true, captured: false },
        };
      }

      const result = await recordCorrection(userId, {
        coachClaim: coach_claim,
        correction,
        verbatim,
        toolContext: tool_context,
        avatarId: avatar_id,
        source: 'mcp',
      });

      // MF-5: booleans/lengths only — never the claim/correction/verbatim text.
      safeLog({
        event: 'tool.capture_correction',
        caller: userTag(identity),
        captured: result.captured,
        has_verbatim: Boolean(verbatim),
        tool_context_len: tool_context?.length ?? 0,
      });
      if (result.captured) {
        captureMcpEvent(userId, 'mcp_expert_correction_captured', { has_verbatim: Boolean(verbatim) });
      }

      return {
        content: [{ type: 'text' as const, text: result.captured ? 'Captured.' : 'Noted.' }],
        structuredContent: { ok: result.ok, captured: result.captured },
      };
    },
  );
}
