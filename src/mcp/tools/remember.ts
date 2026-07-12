/**
 * Layer 2 (tool) — `remember` (OWNED, WRITE, gateWrite — proactive store-as-you-learn).
 *
 * The capture reflex for the never-ask-twice loop. Where `provide_context` answers the
 * `needs_input` slots `get_context_status` asked about (reactive), `remember` lets the coach
 * persist a fact the instant the owner states it (proactive) — so a positioning intent, a
 * margin, a channel size, a product claim mentioned in passing is stored before it scrolls
 * away, not lost until something happens to ask for it.
 *
 * RELEVANCE FILTER (the 18-slot manifest IS the relevance boundary). `remember` only accepts
 * the STATED classes — OWNER-INTENT, BUSINESS-FACT, PRODUCT-TRUTH. A fact that does not map
 * to one of those slots is not the coach's business and is rejected, not stored:
 *   - EVIDENCE slots (verbatim reviews / listing / ad copy) → rejected with a pointer to
 *     `ingest_evidence`, which freezes them as citations. You do not "remember" a review from
 *     chat; you ingest it verbatim.
 *   - INTAKE / FRAMEWORK → not user-answerable facts; rejected.
 *
 * TRUST RAIL. Captured facts route through `storeAnswer` and resolve `filled-stated`
 * (owner asserted) or `filled-inferred` (coach derived, via `source:'inferred'`) — NEVER
 * `filled-evidence`, which only a real snapshot earns. PRODUCT-TRUTH claims stay
 * fabrication-gated downstream, so a remembered claim still needs confirmation before it can
 * enter generated copy. A mis-captured fact is therefore confirmable, not a silent corruption.
 *
 * Per-fact never-fail (mirrors provide_context): one fact that fails to route does not abort
 * the rest. Identity-gated (gateWrite); OWNER-INTENT facts require an avatar_id.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { storeAnswer, ContextWritebackError, type WritebackStore } from '../service/contextWriteback.js';
import { resolve, type SlotStatus } from '../service/contextResolver.js';
import { CONTEXT_SLOTS, getSlot, type SlotClass, type SlotId } from '../contracts/index.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

const VALID_SLOT_IDS = CONTEXT_SLOTS.map((s) => s.id) as SlotId[];

/** Classes `remember` may capture — the "stated" facts. EVIDENCE is verbatim (ingest_evidence). */
const CAPTURABLE_CLASSES: ReadonlySet<SlotClass> = new Set(['OWNER-INTENT', 'BUSINESS-FACT', 'PRODUCT-TRUTH']);

/** Why a slot was refused, with the right redirect — so the coach learns the boundary. */
function rejectionReason(slotClass: SlotClass): string | null {
  if (CAPTURABLE_CLASSES.has(slotClass)) return null;
  if (slotClass === 'EVIDENCE') {
    return 'EVIDENCE is verbatim (reviews/listing/ad copy) — freeze it with ingest_evidence so it counts as a citation, not a remembered fact';
  }
  return `slot class ${slotClass} is not a capturable fact (framework/intake)`;
}

const factSchema = z.object({
  slot: z
    .number()
    .int()
    .refine((id): id is SlotId => (VALID_SLOT_IDS as number[]).includes(id), {
      message: 'slot must be a valid context slot id (1..18)',
    })
    .describe('The context slot id this fact belongs to. Capturable: OWNER-INTENT (12/13/14), BUSINESS-FACT (7-11/16), PRODUCT-TRUTH (5/6).'),
  value: z.unknown().describe('The fact, in the owner’s own words where possible (string, object, or array).'),
  source: z
    .enum(['stated', 'inferred'])
    .optional()
    .describe('stated (default) = the owner asserted it; inferred = you derived it from context (stored for confirmation, not as fact).'),
});

const inputSchema = {
  facts: z.array(factSchema).min(1).describe('One or more {slot, value, source?} facts to capture the moment they surface.'),
  avatar_id: z
    .string()
    .optional()
    .describe('Avatar scope; REQUIRED for OWNER-INTENT facts (positioning/voice/beliefs are avatar-keyed).'),
};

interface FactResult {
  slot: SlotId;
  ok: boolean;
  store?: WritebackStore;
  row_id?: string;
  status?: SlotStatus;
  note?: string;
}

export function registerRememberTool(server: McpServer): void {
  server.registerTool(
    'remember',
    {
      title: 'Remember a fact the owner just stated',
      description:
        'Write tool: capture a brand fact the instant the owner states it, so it is never asked for twice. Relevance-bounded to the coach’s purpose — it accepts only facts that map to a stated context slot (positioning intent, voice, target-customer beliefs, revenue/margins/channels/inventory, competitors, product catalog/claims). Verbatim reviews/listing copy are NOT facts to remember — ingest them with ingest_evidence. Captured facts are stored as confirmable (filled-stated / filled-inferred), never as hard evidence, and any product claim still passes the fabrication gate before it can appear in copy. Use it proactively, every turn a new fact lands — do not wait to be asked. Requires an authenticated Supabase JWT; OWNER-INTENT facts require avatar_id.',
      inputSchema,
    },
    async ({ facts, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;

      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const results: FactResult[] = [];
      const persistedSlots: SlotId[] = [];

      for (const { slot, value, source } of facts) {
        const reason = rejectionReason(getSlot(slot).class);
        if (reason) {
          results.push({ slot, ok: false, note: `not captured — ${reason}` });
          continue;
        }
        try {
          const written = await storeAnswer(slot, value, { avatarId: avatar_id ?? null, source });
          results.push({ slot, ok: true, store: written.store, row_id: written.rowId });
          persistedSlots.push(slot);
        } catch (err) {
          const note =
            err instanceof ContextWritebackError ? err.message : 'failed to persist fact';
          results.push({ slot, ok: false, note });
        }
      }

      // Re-resolve persisted slots so the caller sees the new (confirmable) status.
      if (persistedSlots.length > 0) {
        const reresolved = await resolve(persistedSlots, { avatarId: avatar_id ?? null });
        const statusBySlot = new Map<SlotId, SlotStatus>(reresolved.map((r) => [r.slot, r.status]));
        for (const r of results) {
          if (r.ok) r.status = statusBySlot.get(r.slot);
        }
      }

      const captured = results.filter((r) => r.ok).length;
      const rejected = facts.length - captured;
      safeLog({ event: 'tool.remember', caller: userTag(identity), facts: facts.length, captured, rejected });
      if (captured > 0) {
        captureMcpEvent(identity.userId as string, 'mcp_fact_remembered', { facts: facts.length, captured, rejected });
      }

      return {
        content: [{ type: 'text' as const, text: `Remembered ${captured}/${facts.length} fact(s).` }],
        structuredContent: { ok: captured > 0, captured, rejected, results },
      };
    },
  );
}
