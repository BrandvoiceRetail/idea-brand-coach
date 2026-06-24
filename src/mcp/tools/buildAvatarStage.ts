/**
 * Layer 2 (tool) — `build_avatar_stage` (OWNED, WRITE, gateWrite — Avatar 2.0 forensics).
 *
 * Runs one forensic stage or the full S1→S5 chain through `avatarPipeline`. Each stage
 * grounds in the resolved reviews slot (#1) + prior-stage artifacts, invokes its edge fn
 * (avatar-vocabulary / -jobmap / -triggers / -objections; S5 = reveal-signature),
 * validates against the Phase-0 contract, and persists via the JWT-bound artifact store.
 *
 * Grounding gate (manifest §6 / guardrail #4): if the reviews slot is unresolved the
 * pipeline NEVER runs the engine — it returns a structured `needs_input` block the
 * calling agent relays to the user (then `provide_context`/`ingest_evidence` fills it).
 *
 * Identity-gated (gateWrite, D5): a write runs only for an authenticated caller; the
 * artifact store's RLS-bound client then scopes every row to `auth.uid()`.
 *
 * D2 / R-015: the S5 signature auto-feed is operator-gated. `stage:'s4'` or `'pipeline'`
 * stops before S5 unless `allow_signature:true` is passed (the explicit sign-off that
 * customer review vocabulary is not the founder's own words — no-parroting preserved).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { runPipeline, runStage, type AvatarStage } from '../service/avatarPipeline.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const STAGE_VALUES = ['s1', 's2', 's3', 's4', 'pipeline'] as const;

const inputSchema = {
  stage: z
    .enum(STAGE_VALUES)
    .describe(
      "Which to run: a single forensic stage 's1'|'s2'|'s3'|'s4', or 'pipeline' for the full S1→S5 chain.",
    ),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
  allow_signature: z
    .boolean()
    .default(false)
    .describe(
      'D2/R-015 operator sign-off. Only with this true does the pipeline auto-feed evidence into the S5 Signature engine.',
    ),
};

export function registerBuildAvatarStageTool(server: McpServer): void {
  server.registerTool(
    'build_avatar_stage',
    {
      title: 'Build an Avatar 2.0 forensic stage',
      description:
        'Write tool: run one Avatar 2.0 forensic stage (s1 vocabulary, s2 job map, s3 triggers, s4 objections) or the full S1→S5 pipeline. Each stage grounds in resolved reviews (slot #1) + prior artifacts, invokes its edge fn verbatim, validates against its contract, and persists an artifact (RLS-scoped). Returns needs_input when reviews are unresolved (never runs ungrounded). Requires an authenticated Supabase JWT. The S5 signature auto-feed is D2/R-015 gated behind allow_signature.' + groundingPreamble('build_avatar_stage') + appGroundingPreamble('build_avatar_stage'),
      inputSchema,
    },
    async ({ stage, avatar_id, allow_signature }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const opts = { avatarId: avatar_id ?? null, allowSignature: allow_signature };

      if (stage === 'pipeline') {
        const result = await runPipeline(opts);
        safeLog({
          event: 'tool.build_avatar_stage.pipeline',
          caller: userTag(identity),
          stages: result.stages.length,
          ok: result.ok,
          needs_input: result.needs_input ? result.needs_input.length : 0,
          signature_gated: !!result.signature_gated,
        });
        if (result.ok && result.stages.length > 0) {
          captureMcpEvent(identity.userId as string, 'mcp_avatar_pipeline_completed', {
            stages_count: result.stages.length,
            signature_gated: !!result.signature_gated,
          });
        }
        // Previously dark: pipeline short-circuits (blocked / failed) emitted no event.
        if (result.needs_input) {
          captureMcpEvent(identity.userId as string, 'mcp_avatar_pipeline_needs_input', {
            stages_count: result.stages.length,
            missing_count: result.needs_input.length,
          });
        }
        if (result.failed) {
          captureMcpEvent(identity.userId as string, 'mcp_avatar_pipeline_failed', {
            stages_count: result.stages.length,
            failed_stage: result.failed.stage,
          });
        }
        const summaryText = result.needs_input
          ? `Pipeline blocked: ${result.needs_input.length} context slot(s) need input (chain stopped after ${result.stages.length} stage(s)).`
          : result.failed
            ? `Pipeline failed at ${result.failed.stage}: ${result.failed.note} (${result.stages.length} stage(s) persisted).`
            : result.signature_gated
              ? `Pipeline persisted ${result.stages.length} stage(s); S5 Signature is gated (D2/R-015).`
              : `Pipeline persisted ${result.stages.length} stage(s) including the Signature.`;
        return {
          content: [{ type: 'text' as const, text: summaryText }],
          structuredContent: {
            ok: result.ok,
            mode: 'pipeline',
            stages: result.stages,
            needs_input: result.needs_input,
            signature_gated: result.signature_gated,
            failed: result.failed,
          },
        };
      }

      const result = await runStage(stage as AvatarStage, opts);
      safeLog({
        event: 'tool.build_avatar_stage',
        caller: userTag(identity),
        stage,
        status: result.status,
      });

      if (result.status === 'persisted') {
        captureMcpEvent(identity.userId as string, 'mcp_avatar_stage_completed', { stage });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Stage ${stage} persisted (${result.summary.kind}, artifact id ${result.summary.artifact_id}, grounding ${result.summary.grounding}).`,
            },
          ],
          structuredContent: { ok: true, mode: 'stage', stage, summary: result.summary },
        };
      }

      if (result.status === 'needs_input') {
        captureMcpEvent(identity.userId as string, 'mcp_avatar_stage_needs_input', {
          stage,
          missing_count: result.needs_input.length,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Stage ${stage} needs input: ${result.needs_input.length} unresolved context slot(s).`,
            },
          ],
          structuredContent: { ok: false, mode: 'stage', stage, needs_input: result.needs_input },
        };
      }

      // failed
      captureMcpEvent(identity.userId as string, 'mcp_avatar_stage_failed', { stage });
      return {
        content: [{ type: 'text' as const, text: `Stage ${stage} failed: ${result.note}` }],
        structuredContent: { ok: false, mode: 'stage', stage, note: result.note },
        isError: true,
      };
    },
  );
}
