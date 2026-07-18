/**
 * Layer 1 (service) — onboarding orchestrator.
 *
 * Turns the 30-step manual onboarding choreography (the real 2026-06-28 session) into ONE
 * efficient in-process pass: resolve everything we already know about the brand in parallel,
 * then return a single unified state that ends on the ONE highest-leverage next action.
 *
 * Design (docs/mcp/ONBOARD_ORCHESTRATOR_DESIGN.md):
 *  - Compose the existing read SERVICES (context resolver, avatar list, funnel inventory) —
 *    no tool-to-tool network hops, so the whole read is one fast pass.
 *  - Two scoring rungs that COMPOSE: the low-friction multiple-choice diagnostic (intake #15)
 *    is the cold-start rung that guarantees click-through; once real evidence exists (reviews
 *    #1 / listing #3) we prefer deriving the Trust Gap from that context. This service picks
 *    which rung is the next action — it never fabricates scores itself.
 *  - Never-fabricate seam preserved: missing slots surface as needs_input, never invented.
 *
 * Pure orchestration + prioritization; all I/O is injected (`OnboardReadDeps`) so this is
 * fully unit-testable and the tool layer binds the live services.
 */
import type { ResolvedSlot, SlotStatus } from './contextResolver.js';
import type { AvatarRow } from './avatarLifecycle.js';
import type { FunnelTouchpoint } from './funnelInventory.js';
import { getSlot, type SlotId } from '../contracts/index.js';

/** Statuses that satisfy a slot (evidence/owner-stated). Everything else needs input. */
const SATISFIED: ReadonlySet<SlotStatus> = new Set<SlotStatus>(['filled-evidence', 'filled-stated']);

/** Slots that matter for onboarding, by role. */
const REVIEWS_SLOT: SlotId = 1;
const LISTING_SLOT: SlotId = 3;
const INTAKE_SLOT: SlotId = 15;
/** Evidence + product + owner-intent + intake — the inputs onboarding actually needs. */
const ONBOARD_SLOTS: readonly SlotId[] = [1, 2, 3, 4, 5, 6, 12, 13, 14, 15];

/** A placeholder avatar carries no real definition (empty description) or a stub name. */
function isPlaceholderAvatar(a: AvatarRow): boolean {
  if (!a.description || a.description.trim() === '') return true;
  return /^(default avatar|avatar\s*\d+|new avatar|untitled)$/i.test(a.name.trim());
}

/**
 * The single highest-leverage next step. Voiced per Trevor's onboarding doctrine
 * (docs/mcp/ONBOARDING_VOICE_TREVOR.md): `why` is plain-language diagnosis (no framework
 * jargon), and `invite` is the Recognition-first conversational ask the host delivers to
 * gather the ONE piece of context that unlocks the most — never a form, never a checklist.
 * `tool`/`slot` let the host wire a one-click action.
 */
export interface OnboardNextAction {
  id:
    | 'define_avatar'
    | 'add_evidence'
    | 'take_diagnostic'
    | 'derive_trust_gap'
    | 'connect_analytics'
    | 'run_trust_gap';
  label: string;
  why: string;
  /** The warm, single, conversation-style ask to deliver to the user (Recognition-first). */
  invite: string;
  tool?: string;
  slot?: SlotId;
}

/** One unsatisfied slot the host can ask about (mirrors get_context_status needs_input). */
export interface OnboardNeedsInput {
  slot: SlotId;
  question: string;
  why: string;
  status: SlotStatus;
}

/** The unified onboarding state — one object that answers "where am I and what's next". */
export interface OnboardState {
  /** Enough real evidence on file to derive a Trust Gap without asking for scores. */
  readyToDerive: boolean;
  avatars: { total: number; defined: number; placeholders: number; hasPrimary: boolean };
  evidence: { reviews: boolean; listing: boolean };
  intakeTaken: boolean;
  funnel: { pieces: number; withMetrics: number };
  context: { satisfied: number; total: number; needsInput: OnboardNeedsInput[] };
  nextAction: OnboardNextAction;
  summary: string;
}

/** Injected reads (default-bound to live services in the tool layer). */
export interface OnboardReadDeps {
  resolve: (slots: SlotId[], opts: { avatarId: string | null }) => Promise<ResolvedSlot[]>;
  listAvatars: () => Promise<AvatarRow[]>;
  listFunnel: () => Promise<FunnelTouchpoint[]>;
}

function satisfied(map: Map<SlotId, ResolvedSlot>, slot: SlotId): boolean {
  const r = map.get(slot);
  return !!r && SATISFIED.has(r.status);
}

/** Build the needs_input entry for an unsatisfied slot (host asks; never fabricate). */
function toNeedsInput(r: ResolvedSlot): OnboardNeedsInput {
  const def = getSlot(r.slot);
  return { slot: r.slot, question: def.askQuestion, why: def.name, status: r.status };
}

/**
 * Decide the ONE next action. Order encodes the onboarding ladder:
 *  1. a real customer must exist before anything is coachable;
 *  2. evidence (reviews/listing) is what powers an evidence-grounded Trust Gap;
 *  3. with no evidence, the low-friction multiple-choice diagnostic is the cold-start rung;
 *  4. with evidence on file, prefer DERIVING the Trust Gap from context (no homework);
 *  5. then light up the funnel with real metrics;
 *  6. otherwise we're ready to run it.
 */
function decideNextAction(args: {
  defined: number;
  hasReviews: boolean;
  hasListing: boolean;
  intakeTaken: boolean;
  funnelWithMetrics: number;
}): OnboardNextAction {
  const { defined, hasReviews, hasListing, intakeTaken, funnelWithMetrics } = args;
  const hasEvidence = hasReviews || hasListing;

  // True cold start (nothing on file): lead with the low-friction multiple-choice
  // diagnostic — it's designed to guarantee click-through before we ask for anything.
  if (defined === 0 && !hasEvidence && !intakeTaken) {
    return {
      id: 'take_diagnostic',
      label: 'Start with the 60-second read',
      why: "Quickest way in — a few quick questions about your own listing and I'll show you where buyers are hesitating. No setup, no forms.",
      invite:
        "Let's start where it actually hurts. Pull up your product listing the way a first-time shopper sees it — I'll ask you four quick questions about it and show you where their confidence is leaking. Ready?",
      tool: 'run_trust_gap',
      slot: INTAKE_SLOT,
    };
  }

  if (defined === 0) {
    return {
      id: 'define_avatar',
      label: 'Get clear on who you\'re really selling to',
      why: "Everything I read for you is read through your buyer's eyes — so the first thing I need is a clear picture of who they are.",
      invite:
        "Before I read your brand back to you, tell me about the person you're actually selling to — who are they, and what are they really trying to get when they land on your listing? (If you've got docs or reviews, point me at them and I'll draft this for you.)",
      tool: 'create_avatar',
    };
  }
  if (!hasEvidence) {
    if (!intakeTaken) {
      return {
        id: 'take_diagnostic',
        label: 'Take the 60-second read',
        why: "Nothing of yours on file yet — the quickest way to see where buyers hesitate is a few questions about your own listing.",
        invite:
          "Let's do the fast version first. Look at your listing the way a first-time shopper would, and I'll walk you through four quick questions to find where their confidence drops. Want to go?",
        tool: 'run_trust_gap',
        slot: INTAKE_SLOT,
      };
    }
    return {
      id: 'add_evidence',
      label: 'Show me your actual listing + reviews',
      why: "Once I can see your real words and what customers say back, I stop guessing and start showing you exactly where buyers pull away.",
      invite:
        "Now let me read the real thing back to you. Paste your listing copy and a handful of your reviews — or just give me your ASIN and I'll pull them. I'll reflect back what your buyer is actually hearing.",
      tool: 'ingest_evidence',
      slot: LISTING_SLOT,
    };
  }
  // Evidence is on file → "read me back" then derive, rather than asking for scores.
  if (!intakeTaken) {
    return {
      id: 'derive_trust_gap',
      label: "Let me read your brand back to you",
      why: "You've given me your real listing and reviews — I can read them and show you, in your buyer's words, where trust is breaking down. No scores for you to fill in.",
      invite:
        "I've got your listing and your reviews. Give me a moment and I'll read your brand back to you the way your buyer experiences it — then show you the one place their confidence is slipping.",
      tool: 'assess_idea_dimensions',
    };
  }
  if (funnelWithMetrics === 0) {
    return {
      id: 'connect_analytics',
      label: 'Let\'s see where the drop-off actually is',
      why: "Your read is in — now your real numbers will show which step in the journey is quietly costing you the sale.",
      invite:
        "One more thing to make this real: connect your analytics (Windsor / your ad + Amazon data) and I'll lay your last 30 days against each step of your funnel — so we're fixing the piece that's actually losing money, not guessing.",
    };
  }
  return {
    id: 'run_trust_gap',
    label: 'See your gap and the one piece to fix first',
    why: "Everything's in place — I'll show you your Trust Gap and rank your funnel by what's costing you the most right now.",
    invite:
      "We've got everything we need. Want me to pull it together — your Trust Gap and the single funnel piece that's costing you the most — so you leave with one clear thing to fix?",
    tool: 'run_trust_gap',
  };
}

/**
 * Assemble the unified onboarding state in one pass. Reads run in parallel; the funnel read
 * is allowed to fail soft (a brand with no funnel yet is normal during onboarding).
 */
export async function assembleOnboardState(
  deps: OnboardReadDeps,
  scopeAvatarId: string | null = null,
): Promise<OnboardState> {
  // Read avatars + funnel first so we can SCOPE the context resolve to the caller's avatar.
  // Evidence/context is ingested per-avatar (ingest_evidence/remember take avatar_id) and the
  // resolver falls back avatar→brand-level, so a brand-level-only resolve (avatarId:null) would
  // never resurface avatar-scoped evidence — the coach would re-ask for what it already has.
  const [avatars, funnel] = await Promise.all([
    deps.listAvatars(),
    deps.listFunnel().catch(() => [] as FunnelTouchpoint[]),
  ]);

  const definedAvatars = avatars.filter((a) => !isPlaceholderAvatar(a));
  // Scope: caller-supplied → the brand primary → the only defined avatar → null (true cold start).
  const scopeId =
    scopeAvatarId ??
    definedAvatars.find((a) => a.is_primary)?.id ??
    (definedAvatars.length === 1 ? definedAvatars[0].id : null);

  const resolved = await deps.resolve([...ONBOARD_SLOTS], { avatarId: scopeId });

  const byId = new Map<SlotId, ResolvedSlot>(resolved.map((r) => [r.slot, r]));
  const hasReviews = satisfied(byId, REVIEWS_SLOT);
  const hasListing = satisfied(byId, LISTING_SLOT);
  const intakeTaken = satisfied(byId, INTAKE_SLOT);

  const defined = definedAvatars.length;
  const placeholders = avatars.length - defined;
  const hasPrimary = avatars.some((a) => a.is_primary && !isPlaceholderAvatar(a));

  const funnelWithMetrics = funnel.filter((t) => t.overall_score != null).length;

  const needsInput = resolved.filter((r) => !SATISFIED.has(r.status)).map(toNeedsInput);
  const satisfiedCount = resolved.length - needsInput.length;

  const nextAction = decideNextAction({
    defined,
    hasReviews,
    hasListing,
    intakeTaken,
    funnelWithMetrics,
  });

  const readyToDerive = hasReviews || hasListing;
  const summary = buildSummary({
    defined,
    placeholders,
    hasReviews,
    hasListing,
    intakeTaken,
    funnelPieces: funnel.length,
    funnelWithMetrics,
    nextAction,
  });

  return {
    readyToDerive,
    avatars: { total: avatars.length, defined, placeholders, hasPrimary },
    evidence: { reviews: hasReviews, listing: hasListing },
    intakeTaken,
    funnel: { pieces: funnel.length, withMetrics: funnelWithMetrics },
    context: { satisfied: satisfiedCount, total: resolved.length, needsInput },
    nextAction,
    summary,
  };
}

/**
 * Recognition-first framing (docs/mcp/ONBOARDING_VOICE_TREVOR.md): open by reflecting where
 * the user is in plain, warm language so they feel seen, name the next move as a fix (not a
 * form), then hand the host the conversational `invite` to deliver. No framework jargon, no
 * status dump, no checklist — one ask at a time, in Trevor's voice.
 */
function buildSummary(args: {
  defined: number;
  placeholders: number;
  hasReviews: boolean;
  hasListing: boolean;
  intakeTaken: boolean;
  funnelPieces: number;
  funnelWithMetrics: number;
  nextAction: OnboardNextAction;
}): string {
  let recognition: string;
  if (args.hasListing || args.hasReviews) {
    const have = args.hasListing && args.hasReviews ? 'your listing and your reviews' : args.hasListing ? 'your listing' : 'your reviews';
    recognition = `You're not starting from scratch — I've got ${have} to work from, so I can show you what your buyer is actually experiencing rather than guess.`;
  } else if (args.defined > 0) {
    recognition = "You've told me who you're selling to — now let's find where they're slipping away.";
  } else if (args.placeholders > 0) {
    recognition = "Looks like you got partway in and stalled — easy to pick back up. Let's start where it counts.";
  } else {
    recognition = "If your numbers are off and you can't tell why, you're in the right place — that's exactly what I read for.";
  }
  return `${recognition}\n\n${args.nextAction.invite}`;
}
