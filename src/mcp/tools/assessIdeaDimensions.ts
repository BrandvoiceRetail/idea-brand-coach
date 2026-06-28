/**
 * Layer 2 (tool) — `assess_idea_dimensions` (OWNED, WRITE-gated read of the user's evidence).
 *
 * The keystone that unblocks onboarding: DERIVE the four IDEA dimension scores from the user's
 * own evidence (listing #3, reviews #1, positioning #12, customer beliefs #14) instead of
 * asking them to type four numbers — then feed the SAME deterministic buildTrustGap (parity).
 * Honesty floor: a dimension the engine can't read confidently is returned as needs_input, and
 * the overall Trust Gap is only produced when all four clear the floor. Always PROVISIONAL —
 * the user confirms. Never fabricates.
 *
 * gateWrite first (the derivation is an authenticated, LLM-backed read of private evidence and
 * sits behind the per-user cost guardrail like the forensic read).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { EdgeFnClient } from '../edgeFn/client.js';
import { resolve as resolveSlots, type ResolvedSlot } from '../service/contextResolver.js';
import { assessIdeaDimensions, type DeriveEngine, type DerivedDimension, type AssessResult } from '../service/assessIdeaDimensions.js';
import type { SlotId } from '../contracts/slots.js';
import type { TrustGapDimension } from '../../lib/trustGap.js';
import { gateWrite } from './writeAuth.js';
import { requireOwnedAvatar } from '../service/avatarOwnership.js';
import { safeLog } from '../logging/redact.js';
import { userTag, type Identity } from '../context/identity.js';
import { captureMcpEvent, captureMcpException } from '../posthog.js';

const REVIEWS_SLOT: SlotId = 1;
const LISTING_SLOT: SlotId = 3;
const POSITIONING_SLOT: SlotId = 12;
const BELIEFS_SLOT: SlotId = 14;
const FILLED: ReadonlySet<ResolvedSlot['status']> = new Set(['filled-evidence', 'filled-stated']);

const inputSchema = {
  avatar_id: z.string().optional().describe('Avatar scope; omit for the brand-level read.'),
};

/** Pull pasteable text out of a resolved slot (string | row[] | object). */
function slotText(resolved: ResolvedSlot | undefined): string | null {
  if (!resolved || !FILLED.has(resolved.status) || resolved.value == null) return null;
  const v = resolved.value;
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v
      .map((e) => {
        if (typeof e === 'string') return e.trim();
        if (e && typeof e === 'object') {
          const o = e as Record<string, unknown>;
          return ['title', 'bullets', 'description', 'body', 'text', 'review', 'content']
            .map((k) => (typeof o[k] === 'string' ? (o[k] as string) : Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x) => typeof x === 'string').join('\n') : ''))
            .filter(Boolean)
            .join('\n');
        }
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join('\n\n') : null;
  }
  return null;
}

/** The engine response shape (the evidence edge fn, derive mode). */
interface DeriveResponse {
  dimensions?: Array<{
    dimension: string;
    score: number;
    confidence?: 'high' | 'medium' | 'low';
    grounding?: 'evidence' | 'inference';
    where_it_shows_up?: Array<{ quote_or_observation?: string } | string>;
    brand_read?: string;
    read?: string;
  }>;
  error?: string;
}

const VALID_DIMS = new Set<TrustGapDimension>(['insight', 'distinctive', 'empathetic', 'authentic']);

/** Map the edge fn's derive reply into the service's DerivedDimension[]. */
function toDerived(reply: DeriveResponse): DerivedDimension[] {
  const out: DerivedDimension[] = [];
  for (const d of reply.dimensions ?? []) {
    const dim = d.dimension as TrustGapDimension;
    if (!VALID_DIMS.has(dim)) continue;
    const citations = (d.where_it_shows_up ?? [])
      .map((c) => (typeof c === 'string' ? c : c.quote_or_observation ?? ''))
      .filter((s): s is string => !!s);
    out.push({
      dimension: dim,
      score: typeof d.score === 'number' ? d.score : 0,
      confidence: d.confidence ?? (d.grounding === 'evidence' ? 'medium' : 'low'),
      grounding: d.grounding ?? 'inference',
      citations,
      read: d.read ?? d.brand_read ?? '',
    });
  }
  return out;
}

/** Live derive engine: the evidence edge fn in derive mode (scores omitted ⇒ engine assigns). */
function liveEngine(edge: EdgeFnClient): DeriveEngine {
  return async (evidence) => {
    const res = await edge.invoke<DeriveResponse>('diagnostic-interpretation-evidence', {
      derive: true,
      evidence,
    });
    if (!res.ok || !res.data || res.data.error) {
      return { ok: false, note: res.data?.error ?? res.note ?? 'derive engine unavailable' };
    }
    return { ok: true, dimensions: toDerived(res.data) };
  };
}

export interface AssessIdeaDimensionsDeps {
  resolve: typeof resolveSlots;
  engine: DeriveEngine;
}

export function registerAssessIdeaDimensionsTool(server: McpServer, deps?: Partial<AssessIdeaDimensionsDeps>): void {
  const resolveFn = deps?.resolve ?? resolveSlots;
  const engine = deps?.engine ?? liveEngine(new EdgeFnClient());

  server.registerTool(
    'assess_idea_dimensions',
    {
      title: 'Read the Trust Gap from your evidence (no scores to fill in)',
      description:
        "Derive the four IDEA dimension scores from the user's OWN evidence (listing copy, reviews, positioning) instead of asking them to type numbers, then compute the Trust Gap with the same deterministic engine as the app. Use this once real listing/review evidence is on file — it's how onboarding produces a Trust Gap without a homework wall. Honest by construction: a dimension it can't read confidently comes back as needs_input (never a fabricated score), and the overall Trust Gap is only produced when all four clear the floor. Results are PROVISIONAL — present them as a starting read for the user to confirm, framed on where their buyer hesitates (no framework jargon). Requires an authenticated Supabase JWT." +
        groundingPreamble('assess_idea_dimensions') +
        appGroundingPreamble('assess_idea_dimensions'),
      inputSchema,
    },
    async ({ avatar_id }) => {
      const { identity, denied } = gateWrite();
      if (denied) return denied;
      const { denied: avatarDenied } = await requireOwnedAvatar(avatar_id);
      if (avatarDenied) return avatarDenied;
      const avatarId = avatar_id ?? null;

      try {
        const [reviews, listing, positioning, beliefs] = await resolveFn(
          [REVIEWS_SLOT, LISTING_SLOT, POSITIONING_SLOT, BELIEFS_SLOT],
          { avatarId },
        );
        const evidence: Record<string, string> = {};
        const lt = slotText(listing);
        const rt = slotText(reviews);
        const pt = slotText(positioning);
        const bt = slotText(beliefs);
        if (lt) evidence.listing_copy = lt;
        if (rt) evidence.reviews = rt;
        if (pt) evidence.positioning = pt;
        if (bt) evidence.customer_beliefs = bt;

        const result = await assessIdeaDimensions(evidence, engine);

        safeLog({
          event: 'tool.assess_idea_dimensions',
          caller: userTag(identity),
          ok: result.ok,
          has_trust_gap: !!result.trustGap,
          needs_input: result.needsInput.length,
        });
        captureMcpEvent(identity.userId as string, 'mcp_idea_dimensions_assessed', {
          ok: result.ok,
          has_trust_gap: !!result.trustGap,
          needs_input: result.needsInput.length,
        });

        if (!result.ok) {
          return {
            content: [{ type: 'text' as const, text: assessNeedsText(result.note, result.needsInput.length) }],
            structuredContent: { ok: false, provisional: false, needs_input: result.needsInput, note: result.note },
          };
        }

        return {
          content: [{ type: 'text' as const, text: assessText(result) }],
          structuredContent: { ...result, needs_input: result.needsInput },
        };
      } catch (err) {
        safeLog({ level: 'warn', event: 'tool.assess_idea_dimensions.failed', caller: userTag(identity) });
        captureMcpException(err, identity.userId as string, { tool: 'assess_idea_dimensions' });
        return {
          content: [{ type: 'text' as const, text: 'I hit a snag reading your evidence — try again in a moment.' }],
          structuredContent: { ok: false, note: 'assess failed' },
          isError: true,
        };
      }
    },
  );
}

/** Recognition-first framing of the derived read (conversion-wound voice, no jargon). */
function assessText(r: AssessResult): string {
  if (r.trustGap) {
    const gap = r.trustGap.primaryGap;
    const gapRead = r.dimensions.find((d) => d.dimension === gap)?.read;
    return (
      `Here's what your buyer is experiencing, read from your own listing and reviews — a starting read for you to confirm.\n\n` +
      `Where they're hesitating most: ${gap}${gapRead ? ` — ${gapRead}` : ''}.\n\n` +
      `That's the one to fix first. Want me to show you exactly where it shows up and what to change?`
    );
  }
  const names = r.needsInput.map((n) => n.dimension).join(', ');
  return `I can read most of your brand from what's on file, but I'm not confident enough on ${names} to score it honestly — one concrete example each and I'll complete your read. I won't guess on something this important.`;
}

function assessNeedsText(note: string | undefined, n: number): string {
  if (note === 'no evidence to read') {
    return "I don't have your real words yet. Paste your listing and a few reviews (or give me your ASIN) and I'll read your brand back to you — where buyers hesitate and what to fix.";
  }
  return `I couldn't complete the read${n ? ` (${n} dimension(s) need one more input)` : ''}. Share a bit more of your listing/reviews and I'll finish it.`;
}
