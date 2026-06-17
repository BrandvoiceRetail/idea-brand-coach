/**
 * Layer 2 (tool) — `record_avatar_build` (OWNED, WRITE, gateWrite — avatar lifecycle, §4.3).
 *
 * Upserts the per-avatar forensic build state (avatar_build_state): which S1→S4 stages are
 * done and the draft/built/approved status. Ownership of avatar_id is verified before any
 * write (requireOwnedAvatar) and RLS re-checks via the avatars join. Identity-gated (gateWrite).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { recordBuildState, AvatarLifecycleError } from '../service/avatarLifecycle.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { gateWrite } from './writeAuth.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const inputSchema = {
  avatar_id: z.string().min(1).describe('The avatar whose build state to record (must be owned).'),
  stages_done: z
    .array(z.string())
    .optional()
    .describe('The forensic stages completed so far (e.g. ["s1","s2"]). Replaces the stored set when provided.'),
  status: z
    .enum(['draft', 'built', 'approved'])
    .optional()
    .describe('Lifecycle status; "approved" stamps approved_at.'),
};

export function registerRecordAvatarBuildTool(server: McpServer): void {
  server.registerTool(
    'record_avatar_build',
    {
      title: 'Record avatar build state',
      description:
        'Write tool: upsert the per-avatar forensic build state (stages_done + draft/built/approved status; approved stamps approved_at). Requires an authenticated Supabase JWT and ownership of avatar_id (refused otherwise).',
      inputSchema,
    },
    async ({ avatar_id, stages_done, status }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      try {
        const state = await recordBuildState({ avatarId: avatar_id, stagesDone: stages_done, status });
        safeLog({
          event: 'tool.record_avatar_build',
          caller: userTag(identity),
          status: state.status,
          stages: state.stages_done.length,
        });
        captureMcpEvent(identity.userId as string, 'mcp_avatar_build_recorded', {
          status: state.status,
          stages: state.stages_done.length,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Build state recorded: ${state.status} (${state.stages_done.length} stage(s) done).`,
            },
          ],
          structuredContent: { ok: true, build_state: state },
        };
      } catch (err) {
        const note = err instanceof AvatarLifecycleError ? err.message : 'failed to record build state';
        safeLog({ level: 'warn', event: 'tool.record_avatar_build.error', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `Could not record build state: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
