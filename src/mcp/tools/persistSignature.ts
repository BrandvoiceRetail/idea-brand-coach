/**
 * Layer 2 (tool) — `persist_signature` (OWNED, WRITE — closes the Alpha
 * "persist chosen Signature" item).
 *
 * Identity-gated (gateWrite, D5): a write runs only for an authenticated caller; the
 * artifactStore's RLS-bound client then scopes the row to `auth.uid()`. Persists the
 * full options set plus the user's pick through `saveSignatureChoice`, which writes BOTH
 * a `signatures` row (the dedicated store the app reads) AND a `signature` artifact (so
 * the chain stays whole for downstream stages). Both are validated against
 * `signatureContract` before any DB write.
 *
 * Grounding: derived from the caller's `used_reviews` flag (the engine's evidence
 * discipline) — `used_reviews:true` ⇒ grounding 'evidence'. The signature contract carries
 * no PRODUCT-TRUTH/policy claims, so no evidence_refs are required for inference mode;
 * evidence mode records the synthesized-bundle ref so the §6 grounding gate is satisfied.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { saveSignatureChoice, ArtifactStoreError } from '../service/artifactStore.js';
import { signatureOptionSchema, type EvidenceRef, type Grounding } from '../contracts/index.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

const inputSchema = {
  options: z
    .array(signatureOptionSchema)
    .min(1)
    .describe('The full Signature option set as produced by generate_signature ({option, sentence}).'),
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

export function registerPersistSignatureTool(server: McpServer): void {
  server.registerTool(
    'persist_signature',
    {
      title: 'Persist chosen Signature',
      description:
        'Write tool: persist the user\'s chosen Signature. Writes a signatures row (the dedicated store the app reads) AND a signature artifact (keeping the chain whole), both validated against the Signature contract and RLS-scoped to the caller. Requires an authenticated Supabase JWT. grounding is derived from used_reviews (true ⇒ evidence).',
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
        const result = await saveSignatureChoice({
          options,
          chosenOption: chosen_index,
          grounding,
          evidenceRefs,
          avatarId: avatar_id ?? null,
        });
        safeLog({
          event: 'tool.persist_signature',
          caller: userTag(identity),
          chosen: chosen_index,
          grounding,
        });
        captureMcpEvent(identity.userId as string, 'mcp_signature_persisted', {
          chosen_option: chosen_index,
          grounding,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Signature persisted (option ${chosen_index}). signature id ${result.signature.id}, artifact id ${result.artifact.id}.`,
            },
          ],
          structuredContent: {
            ok: true,
            signature_id: result.signature.id,
            artifact_id: result.artifact.id,
            chosen_option: chosen_index,
            grounding,
          },
        };
      } catch (err) {
        const note = err instanceof ArtifactStoreError ? err.message : 'failed to persist Signature';
        safeLog({ level: 'warn', event: 'tool.persist_signature.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'persist_signature' });
        captureMcpEvent(identity.userId as string, 'mcp_signature_persist_failed', {
          error_class: err instanceof ArtifactStoreError ? 'ArtifactStoreError' : 'unknown',
        });
        return {
          content: [{ type: 'text' as const, text: `persist_signature failed: ${note}` }],
          structuredContent: { ok: false, note },
          isError: true,
        };
      }
    },
  );
}
