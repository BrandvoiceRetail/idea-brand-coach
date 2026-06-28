/**
 * useOnboardingReflectionRun — drives the Loop-1 read-it-back build-theatre.
 *
 * Modeled on useForensicAvatarBuild: a sequential step loop that flips each step
 * pending → running → terminal and fills a `finding` ONLY from the real step
 * result (never synthesised in the UI). Unlike the forensic build it does NOT
 * abort on the first non-`ok` step — the theatre shows every step reaching a
 * terminal state and surfaces the first blocker as a run-level banner, so the
 * user can still confirm what WAS heard.
 *
 * Side effect: the extracted slots (the user's own words) are written into the
 * V4 context as `filled-inferred` (source 'megaprompt'); `confirmFindings`
 * promotes them to `filled-stated` ("Sounds right ✓") so they're never re-asked.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { OnboardingReflectionService } from '@/services/OnboardingReflectionService';
import { useV4Context } from '@/contexts/V4ContextStore';
import { portraitFromSlots, type ExtractedSlot } from '@/lib/v4/megapromptParse';
import type {
  AvatarPortrait,
  NeedsInputItem,
  ReflectionStep,
  ReflectionStepResult,
} from '@/types/onboardingReflection';

/** The static step catalogue — labels/tools/rationales are Tier-A only. */
const STEP_DEFS: ReadonlyArray<Pick<ReflectionStep, 'id' | 'label' | 'tool' | 'rationale'>> = [
  {
    id: 'read_back',
    label: 'Reading it back',
    tool: 'review read-back',
    rationale: 'So we work from your own words, not my assumptions.',
  },
  {
    id: 'avatar_sketch',
    label: 'Sketching your customer',
    tool: 'avatar build',
    rationale: "A first picture of who you're really for.",
  },
  {
    id: 'trust_gap',
    label: 'Trust Gap',
    tool: 'Trust Gap',
    rationale: 'To see where buyers hesitate before they buy.',
  },
] as const;

const initialSteps = (): ReflectionStep[] =>
  STEP_DEFS.map((d) => ({ ...d, status: 'pending', finding: null }));

export interface OnboardingReflectionHook {
  /** The live timeline steps (status + grounded finding per step). */
  steps: ReflectionStep[];
  /** True while the chain is in flight (disables the confirm gate). */
  isRunning: boolean;
  /** True once a run has completed (every step terminal). */
  hasRun: boolean;
  /** First needs_input demand surfaced by any step (null = none). */
  needsInput: NeedsInputItem[] | null;
  /** First hard error surfaced by any step (null = none). */
  runError: string | null;
  /** The four-field portrait, restated from the paste (null until/unless derivable). */
  portrait: AvatarPortrait | null;
  /** Run the read-it-back chain over the supplied megaprompt. */
  runReflection: (megaprompt: string) => Promise<void>;
  /**
   * Answer one missing context slot inline: persist it as a stated fact, then
   * re-run the read-it-back so the now-filled slot flows into the restatement /
   * avatar / Trust-Gap steps (no dead-end on a thin paste).
   */
  answerNeedsInput: (key: string, value: string) => Promise<void>;
  /** Promote every inferred slot to stated ("Sounds right ✓"). */
  confirmFindings: () => void;
}

/** Merge slot lists, later sources overriding earlier ones by key. */
function mergeSlots(...lists: ReadonlyArray<readonly ExtractedSlot[]>): ExtractedSlot[] {
  const byKey = new Map<string, ExtractedSlot>();
  for (const list of lists) {
    for (const slot of list) {
      const value = slot.value.trim();
      if (value) byKey.set(slot.key, { key: slot.key, value });
    }
  }
  return [...byKey.values()];
}

export function useOnboardingReflectionRun(): OnboardingReflectionHook {
  const { provideContext, fillMap } = useV4Context();
  const service = useMemo(() => new OnboardingReflectionService(), []);

  // The last paste, so an inline gap-answer can re-run the same read-back.
  const lastMegapromptRef = useRef('');
  const [steps, setSteps] = useState<ReflectionStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [needsInput, setNeedsInput] = useState<NeedsInputItem[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [portrait, setPortrait] = useState<AvatarPortrait | null>(null);

  const setStep = useCallback((id: string, patch: Partial<ReflectionStep>): void => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // Apply one step result to its row + accumulate the first blocker. finding is
  // set ONLY on 'ok' — every other terminal state leaves finding null.
  const applyResult = useCallback(
    (id: string, result: ReflectionStepResult): void => {
      if (result.status === 'ok') {
        setStep(id, { status: 'done', finding: result.finding });
        return;
      }
      if (result.status === 'needs_input') {
        setStep(id, { status: 'needs_input', finding: null });
        setNeedsInput((prev) => prev ?? result.needs_input);
        return;
      }
      setStep(id, { status: 'failed', finding: null });
      setRunError((prev) => prev ?? result.error);
    },
    [setStep],
  );

  // Core run: read-back over the paste, MERGED with already-known context slots
  // (prior stated/inferred values + any inline gap-answers) so a re-run after the
  // user fills a gap restates the richer picture. Nothing here is fabricated —
  // every merged value is the user's own word, from the paste or a typed answer.
  const runWith = useCallback(
    async (megaprompt: string, manualSlots: readonly ExtractedSlot[]): Promise<void> => {
      setIsRunning(true);
      setHasRun(false);
      setNeedsInput(null);
      setRunError(null);
      setPortrait(null);
      setSteps(initialSteps());

      const parsed = service.extract(megaprompt);
      // Persist the parsed words as inferred — confirmable, never re-asked.
      if (parsed.length > 0) {
        provideContext(parsed.map((s) => ({ key: s.key, value: s.value, source: 'megaprompt', confirm: false })));
      }

      // Precedence (lowest → highest): stored < parsed < manual. Stored context only
      // FILLS slots the fresh paste didn't mention; the paste the user just submitted
      // always WINS over stale stored values (otherwise a returning user's old brand
      // bleeds over their new words), and an inline gap-answer wins over both.
      const stored: ExtractedSlot[] = fillMap
        .filter((s): s is typeof s & { value: string } => Boolean(s.value))
        .map((s) => ({ key: s.key, value: s.value }));
      const slots = mergeSlots(stored, parsed, manualSlots);
      setPortrait(portraitFromSlots(slots));

      try {
        setStep('read_back', { status: 'running' });
        applyResult('read_back', service.readItBack(megaprompt, slots));

        setStep('avatar_sketch', { status: 'running' });
        applyResult('avatar_sketch', service.sketchAvatar(slots));

        setStep('trust_gap', { status: 'running' });
        applyResult('trust_gap', await service.runTrustGap(megaprompt));
      } finally {
        setIsRunning(false);
        setHasRun(true);
      }
    },
    [service, provideContext, applyResult, setStep, fillMap],
  );

  const runReflection = useCallback(
    async (megaprompt: string): Promise<void> => {
      lastMegapromptRef.current = megaprompt;
      await runWith(megaprompt, []);
    },
    [runWith],
  );

  const answerNeedsInput = useCallback(
    async (key: string, value: string): Promise<void> => {
      const trimmed = value.trim();
      if (!trimmed) return;
      // A typed answer is owner-stated — persist it and re-run with it merged in.
      provideContext([{ key, value: trimmed, source: 'manual' }]);
      await runWith(lastMegapromptRef.current, [{ key, value: trimmed }]);
    },
    [provideContext, runWith],
  );

  const confirmFindings = useCallback((): void => {
    const inferred = fillMap.filter((s) => s.status === 'filled-inferred' && s.value);
    if (inferred.length === 0) return;
    provideContext(inferred.map((s) => ({ key: s.key, value: s.value as string, confirm: true })));
  }, [fillMap, provideContext]);

  return {
    steps,
    isRunning,
    hasRun,
    needsInput,
    runError,
    portrait,
    runReflection,
    answerNeedsInput,
    confirmFindings,
  };
}
