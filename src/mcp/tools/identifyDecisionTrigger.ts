/**
 * Layer 2 (tool) — `identify_decision_trigger` (OWNED, identity-gated).
 *
 * Surfaces THE named Decision Trigger™ — the product's hero output — on the MCP/connector
 * surface. Until now the named, six-type lever lived ONLY in the `identify-decision-trigger`
 * edge fn (auth + credit-gated, Decision Trigger Brief v2.20) and was unreachable via any
 * tool: `run_diagnostic_evidence` calls `diagnostic-interpretation-evidence`, and the avatar
 * S3 stage emits search/volume bands — neither is the named Recognition-type lever. This
 * binds the real derivation engine verbatim.
 *
 * The trigger is DERIVED, never chosen: Stage 1 is a deterministic prior from the four Trust
 * Gap scores (weakest pillar predicts the trigger); Stage 2 extracts VERBATIM evidence phrases
 * + a placement instruction from the seller's own listing + reviews. Inputs are the four scores
 * (the caller has them from `run_trust_gap`) + the resolved evidence (#1 reviews, #3 listing).
 * No evidence -> needs_input (never fabricate). Identity-gated; the edge fn re-validates the JWT,
 * applies its (Alpha no-op) credit gate, and meters/persists server-side.
 *
 * NOTE (open product decision, flagged for Trevor): this treats the named six-type lever as
 * THE Decision Trigger (per Skill 09); the avatar-S3 search/volume bands remain a separate
 * artifact. Canonicalising / merging those two is a follow-up — it does not gate this tool.
 */
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { EdgeFnClient } from '../edgeFn/client.js';
import { resolve as resolveSlots, type ResolvedSlot } from '../service/contextResolver.js';
import type { SlotId } from '../contracts/slots.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag } from '../context/identity.js';
import { captureMcpEvent } from '../posthog.js';

/** Evidence slots: #1 reviews, #3 listing copy. */
const REVIEWS_SLOT: SlotId = 1;
const LISTING_SLOT: SlotId = 3;
// Includes `conflict`/`stale`: reconcile() carries a real winning value for both, so the
// trigger still derives from on-file reviews/listing when two stores hold them rather than
// falsely reporting no evidence (store-and-resurface). EVIDENCE slots have no staleness window.
const FILLED: ReadonlySet<ResolvedSlot['status']> = new Set(['filled-evidence', 'filled-stated', 'conflict', 'stale']);

const inputSchema = {
  scores: z
    .object({
      insight: z.number().min(0).max(25),
      distinctive: z.number().min(0).max(25),
      empathetic: z.number().min(0).max(25),
      authentic: z.number().min(0).max(25),
    })
    .describe('The four Trust Gap™ scores out of 25 (from run_trust_gap). The weakest pillar predicts the trigger.'),
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level chain.'),
};

export interface IdentifyTriggerDeps {
  resolve: typeof resolveSlots;
  edgeFn: EdgeFnClient;
  /** Session id seam (defaults to a random uuid) so tests are deterministic. */
  newSessionId: () => string;
}

function withDefaults(deps?: Partial<IdentifyTriggerDeps>): IdentifyTriggerDeps {
  return {
    resolve: deps?.resolve ?? resolveSlots,
    edgeFn: deps?.edgeFn ?? new EdgeFnClient(),
    newSessionId: deps?.newSessionId ?? ((): string => `mcp-${randomUUID()}`),
  };
}

function filledText(slot: ResolvedSlot | undefined): string {
  if (!slot || !FILLED.has(slot.status)) return '';
  return typeof slot.value === 'string' ? slot.value : slot.value == null ? '' : JSON.stringify(slot.value);
}

export type IdentifyTriggerResult =
  | { status: 'derived'; trigger: Record<string, unknown> }
  | { status: 'needs_evidence' }
  | { status: 'failed'; note: string };

/** Resolve evidence, then invoke the derivation engine verbatim. Exported for the test. */
export async function runIdentifyDecisionTrigger(
  scores: { insight: number; distinctive: number; empathetic: number; authentic: number },
  avatarId: string | null,
  deps: IdentifyTriggerDeps,
): Promise<IdentifyTriggerResult> {
  const [reviews, listing] = await deps.resolve([REVIEWS_SLOT, LISTING_SLOT], { avatarId });
  const reviewsText = filledText(reviews);
  const listingText = filledText(listing);

  // The trigger is DERIVED from the seller's own evidence — never invented. No evidence -> ask.
  if (!reviewsText && !listingText) {
    return { status: 'needs_evidence' };
  }

  const evidence = {
    listings: listingText ? [{ description: listingText }] : [],
    topReviews: reviewsText ? reviewsText.split(/\n{1,}/).map((s) => s.trim()).filter(Boolean).slice(0, 50) : [],
  };
  const res = await deps.edgeFn.invoke<Record<string, unknown>>('identify-decision-trigger', {
    sessionId: deps.newSessionId(),
    avatarId,
    scores,
    evidence,
  });
  if (!res.ok || !res.data || (res.data as { error?: unknown }).error) {
    return { status: 'failed', note: res.note ?? String((res.data as { error?: unknown })?.error ?? 'engine returned no trigger') };
  }
  return { status: 'derived', trigger: res.data };
}

export function registerIdentifyDecisionTriggerTool(server: McpServer, deps?: Partial<IdentifyTriggerDeps>): void {
  const resolved = withDefaults(deps);
  server.registerTool(
    'identify_decision_trigger',
    {
      title: 'Identify the Decision Trigger',
      description:
        "Derive the single Decision Trigger™ — the one psychological lever that makes this seller's customer act now — from their four Trust Gap™ scores (pass the scores from run_trust_gap) + their own listing and reviews. The trigger is DERIVED from the evidence, never chosen: you get the dominant trigger, 2–3 VERBATIM evidence phrases from the reviews, a brand anchor, and one placement instruction (where to put the fix). If no listing/reviews have been imported yet, it returns needs_input — import evidence first (ingest_evidence); it never invents a trigger. Requires an authenticated Supabase JWT." +
        appGroundingPreamble('identify_decision_trigger'),
      inputSchema,
    },
    async ({ scores, avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;

      const out = await runIdentifyDecisionTrigger(scores, avatar_id ?? null, resolved);

      if (out.status === 'needs_evidence') {
        safeLog({ event: 'tool.identify_decision_trigger.needs_input', caller: userTag(identity) });
        const msg =
          'Import the listing and at least a few reviews first (ingest_evidence), then derive the Decision Trigger — it is read from the customer’s own words, never invented.';
        return {
          content: [{ type: 'text' as const, text: msg }],
          structuredContent: { ok: false, needs_input: [{ slot: REVIEWS_SLOT, question: msg, why: 'The Decision Trigger is derived from real listing + review evidence; with none, there is nothing to read.' }] },
        };
      }
      if (out.status === 'failed') {
        safeLog({ level: 'warn', event: 'tool.identify_decision_trigger.failed', caller: userTag(identity) });
        return {
          content: [{ type: 'text' as const, text: `identify_decision_trigger unavailable: ${out.note}` }],
          structuredContent: { ok: false, note: out.note },
        };
      }

      safeLog({ event: 'tool.identify_decision_trigger', caller: userTag(identity) });
      captureMcpEvent(identity.userId ?? 'anon', 'mcp_decision_trigger_derived', {});
      return {
        content: [{ type: 'text' as const, text: 'Decision Trigger™ derived from the seller’s Trust Gap scores + their own evidence.' }],
        structuredContent: { ok: true, ...out.trigger },
      };
    },
  );
}
