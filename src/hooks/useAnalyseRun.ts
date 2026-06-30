/**
 * useAnalyseRun — drives the Loop-2 (Analyse) orchestration for V4Analyse.
 *
 * WHAT: Owns ALL Loop-2 data-fetching through the `analyseService` seam plus the
 * confirmed `V4ContextStore`, and exposes the live build-theatre timeline
 * (avatar → gap/trigger) alongside the per-section state the Analyse screens
 * render (avatar / Trust Gap + Decision Trigger / positioning moves / 7-slot
 * brief + claim gate) and the handlers that advance the flow.
 *
 * WHY: Pages on /v4 are thin wiring shells (see src/pages/AGENTS.md) — the
 * orchestration (sequential step loop, retry, move selection, brief expansion,
 * claim-gate state) belongs in a hook so V4Analyse only wires data + handlers to
 * the presentational screens and owns the spine CTA. Modeled on
 * useOnboardingReflectionRun: each step flips pending → running → terminal and a
 * `finding` is set ONLY from a real `ok` result, never synthesised in the UI.
 *
 * NO FABRICATION: every value comes from the service (which degrades to
 * needs_input / error rather than inventing). The Trust-Gap pillar scores live in
 * the separate Diagnose stage, so without them getGapAndTrigger honestly returns
 * needs_input here → the gap/trigger panel shows its "not enough evidence yet"
 * state. The move engine is net-new and may be unreachable → honest no-moves.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnalyseService } from '@/services/v4/analyseService';
import { useV4Context, type V4ResolvedSlot } from '@/contexts/V4ContextStore';
import { useAvatarContext } from '@/contexts/AvatarContext';
import type {
  AnalyseResult,
  AnalyseRunStep,
  AnalyseStepId,
  AvatarPortrait,
  BriefSlots,
  ClaimGateItem,
  DecisionTriggerView,
  GapAvatarSummary,
  GapTriggerBundle,
  NeedsInputItem,
  PositioningMove,
  TrustGapView,
} from '@/types/v4Analyse';

/** Static catalogue for the auto-run timeline — Tier-A labels/tools only. */
const STEP_DEFS: ReadonlyArray<Pick<AnalyseRunStep, 'id' | 'label' | 'tool' | 'rationale'>> = [
  {
    id: 'avatar',
    label: 'Sketching your customer',
    tool: 'avatar build',
    rationale: 'So every move is for the customer you actually serve.',
  },
  {
    id: 'gap_trigger',
    label: 'Reading your Trust Gap',
    tool: 'Trust Gap',
    rationale: 'To name the one lever most likely to move this buyer.',
  },
] as const;

const initialSteps = (): AnalyseRunStep[] =>
  STEP_DEFS.map((d) => ({ ...d, status: 'pending', finding: null }));

/**
 * Rebuild a megaprompt from the CONFIRMED context slots so the deterministic
 * `analyseService.buildAvatar` (which restates the user's own words) has the same
 * input the onboarding paste produced. Only uses owner-stated values — never
 * invents. Phrasing is tuned so the megaprompt parser captures each value
 * verbatim; non-standard channels simply fall back (the field stays editable).
 */
function megapromptFromContext(slots: readonly V4ResolvedSlot[]): string {
  const by = (key: string): string | undefined =>
    slots.find((s) => s.key === key && s.value)?.value ?? undefined;
  const lines: string[] = [];
  const brand = by('brand_name');
  const product = by('product');
  const customer = by('customer');
  const problem = by('problem');
  const channel = by('channel');
  const goal = by('goal');
  if (brand) lines.push(`We're ${brand.charAt(0).toUpperCase()}${brand.slice(1)}.`);
  if (product) lines.push(`We sell ${product}.`);
  if (customer) lines.push(`Made for ${customer}.`);
  if (problem) lines.push(`Their pain ${problem}.`);
  if (channel) lines.push(`We sell on ${channel}.`);
  if (goal) lines.push(`We want to ${goal}.`);
  return lines.join(' ');
}

export interface AnalyseRunHook {
  // ── Build-theatre (AnalyseRun) ──
  steps: AnalyseRunStep[];
  isRunning: boolean;
  hasRun: boolean;
  needsInput: NeedsInputItem[] | null;
  runError: string | null;
  /** True when the confirmed context lacks the minimum (customer + problem). */
  hasContext: boolean;

  // ── Active customer SET (multi-avatar awareness) ──
  /** True when at least one customer is in the active set. */
  hasAvatar: boolean;
  /** Signature of the active customer SET — presentation re-arms the run on change. */
  loadKey: string;
  /** The active customer set (ids[0] = the focus the build reasons over). */
  avatarIds: string[];
  /** id → display name for every selectable customer (for set/per-avatar labels). */
  avatarNames: Record<string, string>;
  /** The FOCUS customer id (= avatarIds[0]); the portrait + moves are scoped to it. */
  focusAvatarId: string | null;

  // ── Avatar (AvatarProfile) ──
  avatar: AvatarPortrait | null;
  avatarConfirmed: boolean;

  // ── Gap + Decision Trigger (GapDecisionTriggerPanel) ──
  trustGap: TrustGapView | null;
  decisionTrigger: DecisionTriggerView | null;
  /** Per-customer gap/trigger breakdown for a multi-avatar set; null otherwise. */
  gapPerAvatar: GapAvatarSummary[] | null;

  // ── Decision Board (DecisionBoard) ──
  moves: PositioningMove[];
  movesLoading: boolean;
  movesError: string | null;
  selectedMoveId: string | null;
  /**
   * The customer the current moves were generated FOR (set-aware labelling). Moves
   * are an expensive generate over ONE confirmed (focus) customer — they are NOT
   * fanned out to N generates; the board labels them with this customer and the
   * user switches focus (the avatar chip) to generate moves for another. null until
   * moves are generated; goes stale-aware when it differs from `focusAvatarId`.
   */
  movesAvatarId: string | null;
  /** Display name for {@link movesAvatarId}; null when unknown / not yet generated. */
  movesAvatarName: string | null;

  // ── Brief + claim gate (MoveBriefClaimGate) ──
  brief: BriefSlots | null;
  claims: ClaimGateItem[];
  briefLoading: boolean;
  briefError: string | null;

  // ── Handlers ──
  runAnalyse: () => Promise<void>;
  editAvatar: (field: keyof AvatarPortrait, value: string) => void;
  confirmAvatar: (portrait: AvatarPortrait) => void;
  generateMoves: () => Promise<void>;
  chooseMove: (move: PositioningMove) => Promise<void>;
  confirmClaim: (claim: ClaimGateItem, index: number) => void;
}

export function useAnalyseRun(): AnalyseRunHook {
  const { contextCard, provideContext } = useV4Context();
  const { selectedAvatarId, contextAvatarIds, avatars } = useAvatarContext();
  const service = useMemo(() => new AnalyseService(), []);

  // Name lookup for the per-customer gap/trigger summaries (multi-avatar set).
  const avatarNames = useMemo(
    () => Object.fromEntries((avatars ?? []).map((a) => [a.id, a.name])),
    [avatars],
  );
  // A stable signature of the active customer SET — the build re-arms when the set
  // changes (not only when the focus customer changes).
  const loadKey = contextAvatarIds.join(',');

  const [steps, setSteps] = useState<AnalyseRunStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [needsInput, setNeedsInput] = useState<NeedsInputItem[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [avatar, setAvatar] = useState<AvatarPortrait | null>(null);
  const [avatarConfirmed, setAvatarConfirmed] = useState(false);
  const [trustGap, setTrustGap] = useState<TrustGapView | null>(null);
  const [decisionTrigger, setDecisionTrigger] = useState<DecisionTriggerView | null>(null);
  const [gapPerAvatar, setGapPerAvatar] = useState<GapAvatarSummary[] | null>(null);

  const [moves, setMoves] = useState<PositioningMove[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [movesError, setMovesError] = useState<string | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const [movesAvatarId, setMovesAvatarId] = useState<string | null>(null);

  const [brief, setBrief] = useState<BriefSlots | null>(null);
  const [claims, setClaims] = useState<ClaimGateItem[]>([]);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const megaprompt = useMemo(() => megapromptFromContext(contextCard), [contextCard]);
  const hasContext = useMemo(
    () => contextCard.some((s) => s.key === 'customer' && s.value) &&
      contextCard.some((s) => s.key === 'problem' && s.value),
    [contextCard],
  );
  const hasAvatar = contextAvatarIds.length > 0;

  const setStep = useCallback((id: AnalyseStepId, patch: Partial<AnalyseRunStep>): void => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /**
   * Re-arm the build-theatre when the active customer SET changes — a build is for
   * the customer(s) it ran over, so switching the set must not leave a stale avatar
   * / gap / moves / brief on screen for the prior selection. Keyed on `loadKey`
   * (the set signature), not the focus id alone, so adding or removing a customer
   * also resets. (Initial mount is a no-op over already-initial state.)
   */
  useEffect(() => {
    setSteps(initialSteps());
    setIsRunning(false);
    setHasRun(false);
    setNeedsInput(null);
    setRunError(null);
    setAvatar(null);
    setAvatarConfirmed(false);
    setTrustGap(null);
    setDecisionTrigger(null);
    setGapPerAvatar(null);
    setMoves([]);
    setMovesError(null);
    setSelectedMoveId(null);
    setMovesAvatarId(null);
    setBrief(null);
    setClaims([]);
    setBriefError(null);
  }, [loadKey]);

  /**
   * The auto-run build-theatre: build the avatar (deterministic, from the user's
   * own words), then read the gap + trigger. Each step reaches a terminal state;
   * the first blocker surfaces as a run-level banner (never a fabricated finding).
   */
  const runAnalyse = useCallback(async (): Promise<void> => {
    setIsRunning(true);
    setHasRun(false);
    setNeedsInput(null);
    setRunError(null);
    setAvatar(null);
    setAvatarConfirmed(false);
    setTrustGap(null);
    setDecisionTrigger(null);
    setGapPerAvatar(null);
    setSteps(initialSteps());

    try {
      // Step 1 — avatar (deterministic restatement of confirmed context).
      setStep('avatar', { status: 'running' });
      const avatarResult = service.buildAvatar(megaprompt);
      if (avatarResult.status === 'ok') {
        const p = avatarResult.data;
        setAvatar(p);
        setStep('avatar', {
          status: 'done',
          finding: `For ${p.who} — struggling with ${p.problem}.`,
        });
      } else if (avatarResult.status === 'needs_input') {
        setStep('avatar', { status: 'needs_input', finding: null });
        setNeedsInput((prev) => prev ?? avatarResult.needs_input);
      } else {
        setStep('avatar', { status: 'failed', finding: null });
        setRunError((prev) => prev ?? avatarResult.error);
      }

      // Step 2 — Trust Gap + Decision Trigger. Without real pillar scores (they
      // live in the Diagnose stage) this honestly returns needs_input. Multi-avatar:
      // when >1 customer is in the set, read the focus customer's gap with every
      // customer's own headline gap/trigger attached (perAvatar) for the
      // side-by-side; single-avatar uses the unchanged path (byte-identical).
      setStep('gap_trigger', { status: 'running' });
      const isMulti = contextAvatarIds.length > 1;
      const gap: AnalyseResult<GapTriggerBundle> = isMulti
        ? await service.getGapAndTriggerForSet(contextAvatarIds, avatarNames, { evidence: megaprompt })
        : await service.getGapAndTrigger({ evidence: megaprompt });
      if (gap.status === 'ok') {
        setTrustGap(gap.data.trustGap);
        setDecisionTrigger(gap.data.decisionTrigger);
        setGapPerAvatar(gap.data.perAvatar ?? null);
        setStep('gap_trigger', {
          status: 'done',
          finding: `Trust Gap ${gap.data.trustGap.overall}/100 — biggest opportunity: ${gap.data.trustGap.primaryGap}.`,
        });
      } else if (gap.status === 'needs_input') {
        setStep('gap_trigger', { status: 'needs_input', finding: null });
        setNeedsInput((prev) => prev ?? gap.needs_input);
      } else {
        setStep('gap_trigger', { status: 'failed', finding: null });
        setRunError((prev) => prev ?? gap.error);
      }
    } finally {
      setIsRunning(false);
      setHasRun(true);
    }
  }, [service, megaprompt, setStep, contextAvatarIds, avatarNames]);

  const editAvatar = useCallback((field: keyof AvatarPortrait, value: string): void => {
    setAvatar((prev) => (prev ? { ...prev, [field]: value } : prev));
    setAvatarConfirmed(false);
  }, []);

  /**
   * Confirm the (possibly edited) avatar as the active customer and write the
   * fields back to the context store as stated — so they're never re-asked.
   */
  const confirmAvatar = useCallback(
    (portrait: AvatarPortrait): void => {
      setAvatar(portrait);
      setAvatarConfirmed(true);
      provideContext([
        { key: 'customer', value: portrait.who, confirm: true },
        { key: 'problem', value: portrait.problem, confirm: true },
        { key: 'goal', value: portrait.desire, confirm: true },
        { key: 'channel', value: portrait.channel, confirm: true },
      ]);
    },
    [provideContext],
  );

  /**
   * Generate candidate positioning moves for the confirmed avatar + trigger.
   * needs_input (e.g. the move engine isn't deployed) surfaces as an honest
   * error message on the board — never a fabricated move.
   */
  const generateMoves = useCallback(async (): Promise<void> => {
    if (!avatar) return;
    setMovesLoading(true);
    setMovesError(null);
    // Label which customer these moves are FOR. Moves are an expensive generate over
    // the ONE confirmed (focus) customer — never fanned out to N generates; the
    // board labels them with this customer and the user switches focus to generate
    // moves for another. Captured at generate time so a later focus switch reads as
    // stale (movesAvatarId !== focusAvatarId) rather than mislabelling.
    setMovesAvatarId(selectedAvatarId);
    try {
      const result = await service.generatePositioningMoves(avatar, decisionTrigger);
      if (result.status === 'ok') {
        setMoves(result.data);
      } else if (result.status === 'needs_input') {
        setMoves([]);
        setMovesError(result.needs_input[0]?.question ?? 'No positioning moves yet.');
      } else {
        setMoves([]);
        setMovesError(result.error);
      }
    } finally {
      setMovesLoading(false);
    }
  }, [service, avatar, decisionTrigger, selectedAvatarId]);

  /**
   * Expand the chosen move into the 7-slot brief, seeding the claim gate from the
   * brief's own claims (each unconfirmed until the user proves it).
   */
  const chooseMove = useCallback(
    async (move: PositioningMove): Promise<void> => {
      setSelectedMoveId(move.id);
      setBriefLoading(true);
      setBriefError(null);
      setBrief(null);
      setClaims([]);
      try {
        const result = await service.expandMoveToBrief(move);
        if (result.status === 'ok') {
          setBrief(result.data);
          setClaims(result.data.claimGate);
        } else if (result.status === 'needs_input') {
          setBriefError(result.needs_input[0]?.question ?? 'The brief needs more context first.');
        } else {
          setBriefError(result.error);
        }
      } finally {
        setBriefLoading(false);
      }
    },
    [service],
  );

  const confirmClaim = useCallback((_claim: ClaimGateItem, index: number): void => {
    setClaims((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'confirmed', reason: undefined } : c)),
    );
  }, []);

  const movesAvatarName = movesAvatarId ? (avatarNames[movesAvatarId] ?? null) : null;

  return {
    steps,
    isRunning,
    hasRun,
    needsInput,
    runError,
    hasContext,
    hasAvatar,
    loadKey,
    avatarIds: contextAvatarIds,
    avatarNames,
    focusAvatarId: selectedAvatarId,
    avatar,
    avatarConfirmed,
    trustGap,
    decisionTrigger,
    gapPerAvatar,
    moves,
    movesLoading,
    movesError,
    selectedMoveId,
    movesAvatarId,
    movesAvatarName,
    brief,
    claims,
    briefLoading,
    briefError,
    runAnalyse,
    editAvatar,
    confirmAvatar,
    generateMoves,
    chooseMove,
    confirmClaim,
  };
}
