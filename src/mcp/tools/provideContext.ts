/**
 * Layer 2 (tool) — `provide_context` (OWNED, WRITE, gateWrite — store-on-answer).
 *
 * The other half of the never-ask-twice loop: accepts the user's answers to the
 * `needs_input` slots surfaced by `get_context_status` and writes each back to the
 * correct store for its trust class via `contextWriteback.storeAnswer` (EVIDENCE →
 * evidence_snapshots/user_product_reviews, BUSINESS-FACT/PRODUCT-TRUTH → business_facts
 * KB rows with versioning, OWNER-INTENT → avatar_field_values field_source='manual').
 *
 * After persisting, it RE-RESOLVES the answered slots so the caller sees the updated
 * status (the asked-once → filled-stated flip the §2 gate requires). Identity-gated:
 * anonymous callers are denied before any store is touched (gateWrite, guardrail #5).
 *
 * Per-answer never-fail: one answer that fails to route/persist does not abort the
 * others — its result carries `ok:false` + a note, while the rest still persist.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { storeAnswer, ContextWritebackError, type WritebackStore } from '../service/contextWriteback.js';
import { resolve, type SlotStatus } from '../service/contextResolver.js';
import { CONTEXT_SLOTS, type SlotId } from '../contracts/index.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const VALID_SLOT_IDS = CONTEXT_SLOTS.map((s) => s.id) as SlotId[];

const answerSchema = z.object({
  slot: z
    .number()
    .int()
    .refine((id): id is SlotId => (VALID_SLOT_IDS as number[]).includes(id), {
      message: 'slot must be a valid context slot id (1..18)',
    })
    .describe('The context slot id (1..18) this answer fills.'),
  value: z.unknown().describe('The answer payload — string, object, or array, per the slot.'),
  confirm: z
    .boolean()
    .optional()
    .describe('Set true when confirming an inferred/stale current_guess rather than supplying a new value.'),
});

const inputSchema = {
  answers: z.array(answerSchema).min(1).describe('One or more {slot, value, confirm?} answers to persist.'),
  avatar_id: z
    .string()
    .optional()
    .describe('Avatar scope; REQUIRED for OWNER-INTENT slots (avatar_field_values is avatar-keyed).'),
  product_id: z
    .string()
    .optional()
    .describe('Own-product id; when set, EVIDENCE review answers (slot 1) land in user_product_reviews.'),
};

interface AnswerResult {
  slot: SlotId;
  ok: boolean;
  store?: WritebackStore;
  row_id?: string;
  status?: SlotStatus;
  note?: string;
}

export function registerProvideContextTool(server: McpServer): void {
  server.registerTool(
    'provide_context',
    {
      title: 'Provide context answers',
      description:
        'Write tool: persist user answers to context slots (the answers to get_context_status\'s needs_input) into the correct store per trust class, then re-resolve each to confirm the new status. Closes the never-ask-twice loop. Requires an authenticated Supabase JWT; OWNER-INTENT slots require avatar_id. Per-answer never-fail: a single bad answer does not abort the rest.',
      inputSchema,
    },
    async ({ answers, avatar_id, product_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const results: AnswerResult[] = [];
      const persistedSlots: SlotId[] = [];

      for (const { slot, value } of answers) {
        try {
          const written = await storeAnswer(slot, value, {
            avatarId: avatar_id ?? null,
            productId: product_id ?? null,
          });
          results.push({ slot, ok: true, store: written.store, row_id: written.rowId });
          persistedSlots.push(slot);
        } catch (err) {
          const note =
            err instanceof ContextWritebackError ? err.message : 'failed to persist context answer';
          results.push({ slot, ok: false, note });
        }
      }

      // Re-resolve only the slots that persisted, so the caller sees the asked-once flip.
      if (persistedSlots.length > 0) {
        const reresolved = await resolve(persistedSlots, { avatarId: avatar_id ?? null });
        const statusBySlot = new Map<SlotId, SlotStatus>(reresolved.map((r) => [r.slot, r.status]));
        for (const r of results) {
          if (r.ok) r.status = statusBySlot.get(r.slot);
        }
      }

      const persisted = results.filter((r) => r.ok).length;
      safeLog({
        event: 'tool.provide_context',
        caller: userTag(identity),
        answers: answers.length,
        persisted,
        failed: answers.length - persisted,
      });
      if (persisted > 0) {
        captureMcpEvent(identity.userId as string, 'mcp_context_provided', {
          answers: answers.length,
          persisted,
          failed: answers.length - persisted,
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Persisted ${persisted}/${answers.length} context answer(s).`,
          },
        ],
        structuredContent: {
          ok: persisted > 0,
          persisted,
          failed: answers.length - persisted,
          results,
        },
      };
    },
  );
}
