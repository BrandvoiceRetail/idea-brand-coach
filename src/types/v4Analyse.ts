/**
 * Loop-2 (Analyse) shared domain types.
 *
 * WHAT: The single contract the Analyse screens (AnalyseRun, AvatarProfile,
 * GapDecisionTriggerPanel, DecisionBoard, MoveBriefClaimGate) and the
 * `analyseService` seam all import. Defining it once keeps the screens and the
 * integrator from drifting on field names.
 *
 * WHY: Loop-2 is the Diagnose→Analyse→Fix spine's "make sense of it" leg —
 * Avatar → Trust Gap + Decision Trigger → positioning Move → 7-slot Brief +
 * claim gate. Like Loop-1's read-it-back theatre, EVERY value here is grounded:
 * a `finding` exists only on a step that returned `ok`/`done`, scores come from
 * the real engines, and a claim is never asserted as fact unless confirmed.
 * Nothing on this surface is fabricated — the service returns `needs_input` or
 * `error` rather than synthesising a number, a move, or a claim.
 *
 * The run-step shape deliberately mirrors `src/types/onboardingReflection.ts`
 * (same five-state status union, same null-finding-until-done invariant) so the
 * two build-theatres share one mental model.
 */
import type {
  AvatarPortrait,
  NeedsInputItem,
  ReflectionStepStatus,
} from '@/types/onboardingReflection';

/** Re-export the four-field portrait (who/problem/desire/channel) — one definition. */
export type { AvatarPortrait, NeedsInputItem };

/** The Analyse build-theatre uses the SAME five-state union as Loop-1. */
export type AnalyseStepStatus = ReflectionStepStatus;

/** Stable ids for the Analyse run steps (keys + telemetry). */
export type AnalyseStepId = 'avatar' | 'gap_trigger' | 'moves' | 'brief';

/**
 * One step the coach runs during the Analyse build-theatre. Mirrors
 * `ReflectionStep`: `finding` is the ONE real result, set only when the step
 * reached `done`; null on every other state. Never a placeholder.
 */
export interface AnalyseRunStep {
  /** Stable id for keys + telemetry. */
  id: AnalyseStepId;
  /** User-facing everyday label — Tier-A only ("Sketching your customer"). */
  label: string;
  /** Everyday tool name announced ("avatar build", "Trust Gap"); never a raw tool id. */
  tool: string;
  /** The one-line "why" shown under the label. */
  rationale: string;
  /** Live status — the shared five-state union. */
  status: AnalyseStepStatus;
  /** The grounded finding; null until `done`, null on every non-done state. */
  finding: string | null;
}

/**
 * Aggregate state the Analyse run hook exposes and the screens render. Holds the
 * live timeline plus each grounded artifact (null until its step produces one).
 */
export interface AnalyseRunState {
  /** Live per-step timeline. */
  steps: AnalyseRunStep[];
  /** True while the chain is in flight. */
  isRunning: boolean;
  /** True once every step has reached a terminal state. */
  hasRun: boolean;
  /** First `needs_input` demand surfaced by any step (null = none). */
  needsInput: NeedsInputItem[] | null;
  /** First hard error surfaced by any step (null = none). */
  runError: string | null;
  /** The active four-field avatar this loop reasons over (null until built). */
  avatar: AvatarPortrait | null;
  /** Trust Gap read (null until scored from real evidence). */
  trustGap: TrustGapView | null;
  /** The single dominant Decision Trigger (null until derived). */
  decisionTrigger: DecisionTriggerView | null;
  /** Candidate positioning moves (empty until the move engine returns them). */
  moves: PositioningMove[];
  /** The move the user selected to expand into a brief (null until chosen). */
  selectedMoveId: string | null;
  /** The expanded 7-slot brief (null until a move is expanded). */
  brief: BriefSlots | null;
}

// ── Trust Gap ───────────────────────────────────────────────────────────────

/** The four IDEA trust pillars (each scored /25). */
export type TrustPillar = 'insight' | 'distinctive' | 'empathetic' | 'authentic';

/** One pillar's score + plain-language coaching read. */
export interface TrustPillarView {
  pillar: TrustPillar;
  /** Score out of 25 (from the engine; never invented). */
  score: number;
  /** The coach's 2–3 sentence read for this pillar. */
  interpretation: string;
}

/**
 * The Trust Gap diagnostic, grounded in real listing/review evidence. A view of
 * the `diagnostic-interpretation` output — overall score, per-pillar reads, and
 * the bridging summary for the weakest pillar (the user's biggest opportunity).
 */
export interface TrustGapView {
  /** Overall score out of 100. */
  overall: number;
  /** The four pillar reads. */
  pillars: TrustPillarView[];
  /** The weakest pillar — the single biggest opportunity. */
  primaryGap: TrustPillar;
  /** The bridging summary that turns the score into a next move. */
  primaryGapSummary: string;
}

// ── Decision Trigger ──────────────────────────────────────────────────────────

/** The six dominant Decision Trigger types (Trevor-voice public vocabulary). */
export type DecisionTriggerType =
  | 'Identity'
  | 'Belonging'
  | 'Permission'
  | 'Fear-of-Loss'
  | 'Recognition'
  | 'Momentum';

/**
 * The single dominant Decision Trigger, DERIVED from the Trust Gap scores and
 * real review evidence — never chosen, never invented. A view of the
 * `identify-decision-trigger` output. All copy here is already public-facing
 * (no Tier-C / CAPTURE internals).
 */
export interface DecisionTriggerView {
  /** The dominant trigger type. */
  type: DecisionTriggerType;
  /** One-line brand anchor ("like Dove, your customer buys ..."). */
  brandAnchor: string;
  /** Short verbatim phrases from the evidence that support the derivation. */
  evidencePhrases: string[];
  /** Plain-language guidance on where to place it (no CAPTURE element names). */
  placementInstruction: string;
  /** The coach's plain paragraph on why this trigger, citing their evidence. */
  whyThisTrigger: string;
  /** Engine confidence 0..1. */
  confidence: number;
}

/**
 * One customer's headline gap/trigger in a multi-avatar Analyse set — the
 * side-by-side row the panel shows beneath the focus customer's full read. Every
 * field is null until that customer is actually scored (Trust Gap pillar scores
 * live in the Diagnose stage); a number is NEVER invented to fill the column.
 */
export interface GapAvatarSummary {
  avatarId: string;
  avatarName: string;
  /** Overall Trust Gap /100 for this customer; null when not yet scored. */
  overall: number | null;
  /** This customer's weakest pillar (their biggest opportunity); null when unscored. */
  primaryGap: TrustPillar | null;
  /** This customer's dominant Decision Trigger; null when none was derived. */
  triggerType: DecisionTriggerType | null;
}

/**
 * The gap + trigger read the Analyse panel renders. The single-avatar path
 * carries just the focus read; a multi-avatar SET additionally attaches
 * `perAvatar` — each selected customer's own headline gap/trigger — with the
 * FOCUS customer's full read as the headline (`trustGap` / `decisionTrigger`).
 * The gap is a number, so there is no honest aggregate across customers; the
 * focus is the representative, never another customer's gap shown as the focus's.
 */
export interface GapTriggerBundle {
  /** The focus customer's Trust Gap (the headline). */
  trustGap: TrustGapView;
  /** The focus customer's dominant Decision Trigger (null until derived). */
  decisionTrigger: DecisionTriggerView | null;
  /** Per-customer breakdown — present only for a multi-avatar SET (length > 1). */
  perAvatar?: GapAvatarSummary[];
}

// ── Decision Board (positioning moves) ────────────────────────────────────────

/** One criterion's score for a positioning move, with the rationale. */
export interface MoveCriterionScore {
  /** Plain-language criterion name (from the live coach criteria). */
  criterion: string;
  /** Score for this criterion (engine-produced). */
  score: number;
  /** Why the move scored this on the criterion. */
  why: string;
}

/**
 * A candidate positioning move on the Decision Board — a distinctive angle to
 * TEST, scored against the live coach criteria. The user selects one to expand
 * into a brief. Moves come from the move engine; this surface never fabricates a
 * move when the engine is unavailable (it shows an honest empty state instead).
 */
export interface PositioningMove {
  /** Stable id for selection + telemetry. */
  id: string;
  /** The headline angle (one distinctive line to test). */
  headline: string;
  /** Why this move could work — grounded in the avatar + evidence. */
  rationale: string;
  /** Per-criterion scores against the live coach criteria. */
  criteriaScores: MoveCriterionScore[];
  /** Composite score across criteria (engine-computed). */
  composite: number;
}

// ── Brief + claim gate ────────────────────────────────────────────────────────

/** One slot of the 7-slot image brief (Hero, Image 2..7). */
export interface BriefSlot {
  /** Slot label ("Hero", "Image 2", …). */
  slot: string;
  /** What the slot should accomplish. */
  intent: string;
  /** The instruction an execution tool / freelancer can run with. */
  brief: string;
}

/**
 * The expanded brief for a chosen move. The "7 slots" is the image brief; the
 * title formula, bullets and PPC tiers ride alongside so a freelancer can run
 * the full listing. Every product claim is run through the fabrication gate
 * (`claimGate`): unconfirmed claims are flagged, never shipped as fact.
 */
export interface BriefSlots {
  /** The title formula brief + example. */
  titleFormula: { brief: string; exampleOutput: string };
  /** The 5 listing bullets. */
  bullets: Array<{ element: string; brief: string; exampleOutput: string }>;
  /** EXACTLY 7 image-brief slots. */
  imageBrief: BriefSlot[];
  /** PPC keyword tiers. */
  ppcKeywords: { tierA: string[]; tierB: string[]; tierC: string[] };
  /** Every product claim asserted by the brief, with its gate verdict. */
  claimGate: ClaimGateItem[];
}

/** A product claim run through the publish/fabrication gate. */
export interface ClaimGateItem {
  /** The claim text as it would appear in copy. */
  claim: string;
  /** Gate verdict: only `confirmed` claims may ship as fact. */
  status: 'confirmed' | 'unconfirmed';
  /** Optional brief slot the claim belongs to. */
  slot?: number;
  /** Why it was flagged (when not confirmed) — what evidence is missing. */
  reason?: string;
}

// ── Service result discriminants (no-fabrication seam) ────────────────────────

/**
 * The discriminated result every `analyseService` method returns. `ok` carries
 * real data; `needs_input` carries the grounding demand (ask the user); `error`
 * carries a message. The service NEVER synthesises data to avoid `needs_input`
 * or `error` — honest degradation over fabrication.
 */
export type AnalyseResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'needs_input'; needs_input: NeedsInputItem[] }
  | { status: 'error'; error: string };

/** The combined artifact `runAnalyse` returns on success. */
export interface AnalyseBundle {
  avatar: AvatarPortrait;
  trustGap: TrustGapView | null;
  decisionTrigger: DecisionTriggerView | null;
}

/** Input to the gap + trigger step — real evidence and/or pillar scores. */
export interface GapTriggerInput {
  /** Listing/review evidence text (grounds both engines). */
  evidence?: string;
  /** The four pillar scores (/25 each) — required to derive the trigger. */
  scores?: Partial<Record<TrustPillar, number>>;
}
