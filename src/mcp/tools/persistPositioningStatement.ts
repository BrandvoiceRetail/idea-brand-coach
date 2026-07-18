/**
 * Layer 2 (tool) — `persist_positioning_statement` (OWNED, WRITE — closes the Alpha
 * "persist chosen Positioning Statement" item).
 *
 * Identity-gated (gateWrite, D5): a write runs only for an authenticated caller; the
 * artifactStore's RLS-bound client then scopes the row to `auth.uid()`. Persists the
 * full options set plus the user's pick through `savePositioningStatementChoice`, which writes BOTH
 * a `positioning_statements` row (the dedicated store the app reads) AND a `positioning_statement` artifact (so
 * the chain stays whole for downstream stages). Both are validated against
 * `positioningStatementContract` before any DB write.
 *
 * Grounding: derived from the caller's `used_reviews` flag (the engine's evidence
 * discipline) — `used_reviews:true` ⇒ grounding 'evidence'. The positioning statement contract carries
 * no PRODUCT-TRUTH/policy claims, so no evidence_refs are required for inference mode;
 * evidence mode records the synthesized-bundle ref so the §6 grounding gate is satisfied.
 *
 * HISTORY: formerly `persist_signature` (wrote a `signatures` row + `signature` artifact);
 * renamed to Positioning Statement in the 2026-07 taxonomy cleanup.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { savePositioningStatementChoice, ArtifactStoreError } from '../service/artifactStore.js';
import { positioningStatementOptionSchema, type EvidenceRef, type Grounding } from '../contracts/index.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

const inputSchema = {
  options: z
    .array(positioningStatementOptionSchema)
    .min(1)
    .describe('The full Positioning Statement option set as produced by generate_positioning_statement ({option, sentence}).'),
  chosen_index: z
    .number()
    .int()
    .min(1)
    .describe('The 1-based `option` value the user chose (must match an option in the set).'),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
  used_reviews: z
    .boolean()
    .default(false)
    .describe('Whether the synthesis was grounded in real customer reviews (sets grounding=evidence).'),
  inference: z
    .boolean()
    .optional()
    .describe('Engine inference flag (recorded for parity; grounding is derived from used_reviews).'),
};

export function registerPersistPositioningStatementTool(server: McpServer): void {
  server.registerTool(
    'persist_positioning_statement',
    {
      title: 'Persist chosen Positioning Statement',
      description:
        'Write tool: persist the user\'s chosen Positioning Statement. Writes a positioning statements row (the dedicated store the app reads) AND a positioning statement artifact (keeping the chain whole), both validated against the Positioning Statement contract and RLS-scoped to the caller. Requires an authenticated Supabase JWT. grounding is derived from used_reviews (true ⇒ evidence).',
      inputSchema,
    },
    async ({ options, chosen_index, avatar_id, used_reviews, inference }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const grounding: Grounding = used_reviews ? 'evidence' : 'inference';
      const evidenceRefs: EvidenceRef[] = used_reviews
        ? [{ kind: 'review', ref: 'synthesized from persisted evidence snapshot (context-bundle)' }]
        : [];

      try {
        const result = await savePositioningStatementChoice({
          options,
          chosenOption: chosen_index,
          grounding,
          evidenceRefs,
          avatarId: avatar_id ?? null,
        });
        safeLog({
          event: 'tool.persist_positioning_statement',
          caller: userTag(identity),
          chosen: chosen_index,
          grounding,
        });
        captureMcpEvent(identity.userId as string, 'mcp_positioning_statement_persisted', {
          chosen_option: chosen_index,
          grounding,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Positioning Statement persisted (option ${chosen_index}). positioning statement id ${result.positioning_statement.id}, artifact id ${result.artifact.id}.`,
            },
          ],
          structuredContent: {
            ok: true,
            positioning_statement_id: result.positioning_statement.id,
            artifact_id: result.artifact.id,
            chosen_option: chosen_index,
            grounding,
          },
        };
      } catch (err) {
        const note = err instanceof ArtifactStoreError ? err.message : 'failed to persist Positioning Statement';
        safeLog({ level: 'warn', event: 'tool.persist_positioning_statement.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'persist_positioning_statement' });
        captureMcpEvent(identity.userId as string, 'mcp_positioning_statement_persist_failed', {
          error_class: err instanceof ArtifactStoreError ? 'ArtifactStoreError' : 'unknown',
        });
        return {
          content: [{ type: 'text' as const, text: `persist_positioning_statement failed: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
