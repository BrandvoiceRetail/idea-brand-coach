/**
 * Layer 2 (tool) — `recall` (OWNED, READ — load what we already know about this brand).
 *
 * The symmetric load half of `remember`. Where `get_context_status` is target-bound ("what
 * is still needed to generate artifact X" → a needs_input list), `recall` is target-free: it
 * resolves every context slot KB-first and returns the ones that are FILLED as a readable
 * per-slot summary. It is the session-start resurface reflex — the coach opens already knowing
 * the owner's reviews, listing, positioning, margins, claims, so it never re-asks for what is
 * on file. Resolution is RLS-scoped to the caller (anonymous callers see nothing).
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveAll, type ResolvedSlot, type SlotStatus } from '../service/contextResolver.js';
import { getSlot, type SlotId } from '../contracts/index.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level recall.'),
};

/** FRAMEWORK slots (#17/#18) are system-static, not brand knowledge — never interesting to recall. */
const FRAMEWORK_SLOTS: ReadonlySet<number> = new Set([17, 18]);

const SUMMARY_CHARS = 280;

/** A compact, readable one-liner of a resolved value (string | row[] | object). */
function summarize(value: unknown): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (Array.isArray(value)) text = `${value.length} item(s): ${JSON.stringify(value[0] ?? null)}`;
  else text = JSON.stringify(value);
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > SUMMARY_CHARS ? `${text.slice(0, SUMMARY_CHARS)}…` : text;
}

interface KnownEntry {
  slot: SlotId;
  name: string;
  class: string;
  status: SlotStatus;
  confidence: number;
  summary: string;
}

function toKnown(r: ResolvedSlot): KnownEntry {
  const def = getSlot(r.slot);
  return {
    slot: r.slot,
    name: def.name,
    class: def.class,
    status: r.status,
    confidence: r.confidence,
    summary: summarize(r.value),
  };
}

export function registerRecallTool(server: McpServer): void {
  server.registerTool(
    'recall',
    {
      title: 'Recall what we already know about this brand',
      description:
        "Read tool: load everything on file for this brand — the owner's reviews, listing, positioning intent, voice, target-customer beliefs, revenue/margins/channels/inventory, competitors and product claims — as a readable per-slot summary with its trust status (filled-evidence / filled-stated / filled-inferred / stale). Call it at the START of a working session so you open knowing what has already been captured and never re-ask. Unlike get_context_status this is not tied to generating a specific artifact. RLS-scoped to the caller.",
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const resolved = await resolveAll({ avatarId: avatar_id ?? null });
      const known = resolved
        .filter((r) => r.status !== 'missing' && !FRAMEWORK_SLOTS.has(r.slot))
        .map(toKnown);
      const missing = resolved.filter((r) => r.status === 'missing' && !FRAMEWORK_SLOTS.has(r.slot)).length;

      safeLog({ event: 'tool.recall', caller: userTag(getIdentity()), known: known.length, missing });

      const text = known.length
        ? `On file for this brand (${known.length} item(s)):\n` +
          known.map((k) => `• ${k.name} [${k.status}]: ${k.summary}`).join('\n')
        : "Nothing is on file for this brand yet — start by capturing the owner's customer and brand story.";

      return {
        content: [{ type: 'text' as const, text }],
        structuredContent: { ok: true, known, missing },
      };
    },
  );
}
