/**
 * Layer 2 (tool) — `get_context_status` (OWNED, READ — the clarification surface).
 *
 * Resolves the union of `requiredContext` slots for a target output (an artifact kind,
 * or one of the two gold workbooks) via the read-only context resolver, then returns:
 *   - `fill_map`: every required slot with its resolved {status, source, confidence}.
 *   - `needs_input`: the subset the calling agent should ask about — anything NOT
 *     `filled-evidence`/`filled-stated` (i.e. `filled-inferred | missing | conflict |
 *     stale`, per manifest §5 step 3) — each carrying the slot's `askQuestion` (from
 *     slots.ts), the `why` (slot name), and a `current_guess` (the resolved value, if any).
 *
 * This is the never-fabricate seam: generators read this, and where slots are not
 * evidence/stated they surface `needs_input` instead of inventing content.
 *
 * READ-ONLY: no writes. Resolution runs on the JWT-bound RLS client; an anonymous
 * caller resolves to all-`missing` (every store read returns null under no identity),
 * which is the correct "we know nothing yet" answer rather than an error.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolve, type ResolvedSlot, type SlotStatus } from '../service/contextResolver.js';
import { CONTRACTS, getSlot, type ArtifactKind, type SlotId } from '../contracts/index.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

/** Statuses that DO satisfy a slot — anything else queues for clarification (§5 step 3). */
const SATISFIED: ReadonlySet<SlotStatus> = new Set<SlotStatus>(['filled-evidence', 'filled-stated']);

/** The two gold workbooks, each a union of the artifact kinds that compose its sheets. */
const WORKBOOK_KINDS: Record<'workbook_a' | 'workbook_b', readonly ArtifactKind[]> = {
  // Workbook A: Trust Gap → Avatar S1-S4 + Positioning Statement → Canvas → Brief → Audit×IDEA.
  workbook_a: [
    'diagnostic_interpretation',
    'avatar_s1_vocab',
    'avatar_s2_jobmap',
    'avatar_s3_triggers',
    'avatar_s4_objections',
    'positioning_statement',
    'brand_canvas',
    'export_brief',
    'audit_x_idea',
  ],
  // Workbook B: the tiered investment matrix + 90-day rollout.
  workbook_b: ['marketing_audit', 'rollout_plan'],
};

const ARTIFACT_KINDS = Object.keys(CONTRACTS) as ArtifactKind[];
const TARGETS = [...ARTIFACT_KINDS, 'workbook_a', 'workbook_b'] as const;
type Target = (typeof TARGETS)[number];

const inputSchema = {
  target: z
    .enum(TARGETS as unknown as [Target, ...Target[]])
    .describe('What to compute a context fill-map for: an artifact kind, or "workbook_a" / "workbook_b".'),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

/** The required-slot union for a target (artifact kind → its contract; workbook → union). */
function requiredSlotsFor(target: Target): SlotId[] {
  if (target === 'workbook_a' || target === 'workbook_b') {
    const union = new Set<SlotId>();
    for (const kind of WORKBOOK_KINDS[target]) {
      for (const slot of CONTRACTS[kind].requiredContext) union.add(slot);
    }
    return [...union];
  }
  return [...CONTRACTS[target as ArtifactKind].requiredContext];
}

/** Shape one resolved slot for the structured `fill_map`. */
function toFillEntry(r: ResolvedSlot): {
  slot: SlotId;
  name: string;
  class: string;
  status: SlotStatus;
  source: string | null;
  confidence: number;
} {
  const def = getSlot(r.slot);
  return {
    slot: r.slot,
    name: def.name,
    class: def.class,
    status: r.status,
    source: r.source,
    confidence: r.confidence,
  };
}

/** Build a `needs_input` entry from an unsatisfied slot (manifest §5 step 4 shape). */
function toNeedsInput(r: ResolvedSlot): {
  slot: SlotId;
  question: string;
  why: string;
  current_guess: unknown;
  status: SlotStatus;
} {
  const def = getSlot(r.slot);
  return {
    slot: r.slot,
    question: def.askQuestion,
    why: def.name,
    // `missing` carries no guess; everything else surfaces the resolved value to confirm.
    current_guess: r.status === 'missing' ? null : r.value,
    status: r.status,
  };
}

export function registerGetContextStatusTool(server: McpServer): void {
  server.registerTool(
    'get_context_status',
    {
      title: 'Context status for an output',
      description:
        'Read tool: resolve the union of required context slots for a target output (an artifact kind, or "workbook_a" / "workbook_b") KB-first and return a per-slot fill-map plus a needs_input list of slots to ask the user about (anything not evidence-/owner-stated). The clarification surface for the never-ask-twice loop — generators consult this instead of fabricating. Resolution is RLS-scoped to the caller.',
      inputSchema,
    },
    async ({ target, avatar_id }) => {
      // Ownership gate (consistent with the write-tool retrofit): a present-but-foreign
      // avatar_id is refused rather than silently degrading to a brand-level fill-map. RLS
      // already scopes the resolver to the caller, so an anon caller needs no separate gate
      // (requireOwnedAvatar no-ops on a null avatar_id; a foreign one resolves to a denial).
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const slots = requiredSlotsFor(target as Target);
      const resolved = await resolve(slots, { avatarId: avatar_id ?? null });

      const fillMap = resolved.map(toFillEntry);
      const needsInput = resolved.filter((r) => !SATISFIED.has(r.status)).map(toNeedsInput);

      safeLog({
        event: 'tool.get_context_status',
        caller: userTag(getIdentity()),
        target,
        slots: slots.length,
        needs_input: needsInput.length,
      });

      const summary =
        needsInput.length === 0
          ? `All ${slots.length} required slots for ${target} are filled.`
          : `${needsInput.length} of ${slots.length} slots for ${target} need input: ${needsInput
              .map((n) => `#${n.slot} ${n.why}`)
              .join('; ')}.`;

      return {
        content: [{ type: 'text' as const, text: summary }],
        structuredContent: {
          ok: true,
          target,
          fill_map: fillMap,
          needs_input: needsInput,
          all_filled: needsInput.length === 0,
        },
      };
    },
  );
}
