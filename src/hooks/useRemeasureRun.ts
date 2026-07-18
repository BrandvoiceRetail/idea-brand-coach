/**
 * useRemeasureRun — drives the Loop-4 (Re-measure) orchestration for V4Remeasure.
 *
 * WHAT: Owns ALL Loop-4 data-fetching through the `remeasureService` seam, scoped
 * to the active avatar (`AvatarContext`). Exposes the per-section state the
 * Re-measure screens render — the deterministic Trust Gap before/after lift and
 * the business-metric (CTR/CVR/AOV/revenue) before/after view — plus the loader.
 *
 * WHY: Pages on /v4 are thin wiring shells (see src/pages/AGENTS.md) — the
 * orchestration (sequence the two reads, pivot the metrics on the lift's measured
 * date) belongs in a hook so V4Remeasure only wires data + handlers to the
 * presentational screens and owns the spine CTA. Modeled on useFixRun.
 *
 * NO FABRICATION: every value comes from `remeasureService`, which degrades to
 * needs_input (e.g. only one diagnostic run, or no avatar) / error rather than
 * inventing a delta. The business-metric read stays empty (honest no-data) until
 * the analytics migration lands. A `needs_input` result is folded into an honest
 * message for the screen — never a synthesised lift.
 */
import { useCallback, useMemo, useState } from 'react';
import { RemeasureService } from '@/services/v4/remeasureService';
import { useAvatarContext } from '@/contexts/AvatarContext';
import type {
  BusinessMetricsView,
  ExperimentLift,
  ExperimentVerdict,
  RemeasureResult,
  TrustGapLift,
} from '@/types/v4Remeasure';

/** Fold a non-ok RemeasureResult into a single honest message for the screens. */
function messageFor(result: RemeasureResult<unknown>): string {
  if (result.status === 'error') return result.error;
  if (result.status === 'needs_input') {
    return result.needs_input[0]?.question ?? 'I need a little more context first.';
  }
  return 'Something went wrong.';
}

export interface RemeasureRunHook {
  /** True when at least one avatar is in the active set (page-level gate). */
  hasAvatar: boolean;
  /** The focus avatar id (null when none) — lets the page reload on a switch. */
  avatarId: string | null;
  /** Positioning Statement of the active avatar SET — the page reloads the lift when it changes. */
  loadKey: string;

  // ── Trust Gap lift (TrustGapLiftCard) ──
  lift: TrustGapLift | null;
  liftLoading: boolean;
  /** Honest message when the lift can't be shown yet (e.g. only one run). */
  liftMessage: string | null;
  /** True when the message is a needs-more-runs prompt vs a hard error. */
  liftNeedsRun: boolean;

  // ── Business metrics (BusinessMetricsCard) ──
  metrics: BusinessMetricsView | null;
  metricsLoading: boolean;
  metricsError: string | null;

  // ── Experiment lifts (ExperimentLiftCard) ──
  experiments: ExperimentLift[] | null;
  experimentsLoading: boolean;
  experimentsError: string | null;

  load: () => Promise<void>;
  /** Record a won / no-lift verdict on an experiment, then refresh the list. */
  markResult: (testId: string, verdict: ExperimentVerdict, resultValue: number | null) => Promise<void>;
}

export function useRemeasureRun(): RemeasureRunHook {
  const { selectedAvatarId, contextAvatarIds, avatars } = useAvatarContext();
  const service = useMemo(() => new RemeasureService(), []);

  // Name lookup for the per-avatar Trust Gap lift summaries (multi-avatar set).
  const avatarNames = useMemo(
    () => Object.fromEntries((avatars ?? []).map((a) => [a.id, a.name])),
    [avatars],
  );
  // A stable positioning statement of the active avatar SET — the lift reloads when the set
  // changes (not only when the focus avatar changes).
  const loadKey = contextAvatarIds.join(',');

  const [lift, setLift] = useState<TrustGapLift | null>(null);
  const [liftLoading, setLiftLoading] = useState(false);
  const [liftMessage, setLiftMessage] = useState<string | null>(null);
  const [liftNeedsRun, setLiftNeedsRun] = useState(false);

  const [metrics, setMetrics] = useState<BusinessMetricsView | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [experiments, setExperiments] = useState<ExperimentLift[] | null>(null);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentsError, setExperimentsError] = useState<string | null>(null);

  const hasAvatar = contextAvatarIds.length > 0;

  /**
   * Read the deterministic Trust Gap lift first, then read the business metrics
   * pivoted on the lift's measured date (the brand-change point). Each maps to its
   * own honest state; none is fabricated when the read returns needs_input / error.
   */
  const load = useCallback(async (): Promise<void> => {
    if (!selectedAvatarId) return;
    setLiftLoading(true);
    setMetricsLoading(true);
    setExperimentsLoading(true);
    setLiftMessage(null);
    setLiftNeedsRun(false);
    setMetricsError(null);
    setExperimentsError(null);

    // Multi-avatar Re-measure: when >1 customer is in the set, fetch the focus
    // avatar's lift with every customer's own delta attached (perAvatar) for the
    // side-by-side; single-avatar uses the unchanged path. Business metrics +
    // experiments are brand-scoped (set-invariant) → always the focus read.
    const isMulti = contextAvatarIds.length > 1;
    const liftRes = isMulti
      ? await service.getTrustGapLiftForSet(contextAvatarIds, avatarNames)
      : await service.getTrustGapLift(selectedAvatarId);
    let pivot: string | null = null;
    if (liftRes.status === 'ok') {
      setLift(liftRes.data);
      pivot = liftRes.data.measuredAt || null;
    } else if (liftRes.status === 'needs_input') {
      // Missing/insufficient diagnostic history is NOT an error — degrade to an
      // honest neutral state (the card's needs-run branch), never the hard
      // "couldn't read your diagnostic history" box. The service can't tell zero
      // prior runs from one, so use a single baseline-honest message that is true
      // either way and never implies a before/after that doesn't exist.
      setLift(null);
      setLiftNeedsRun(true);
      setLiftMessage(
        'No before-and-after to compare yet — I need two real diagnostic runs. Run the Trust Gap diagnostic to set your baseline, then re-run it after your fix and I’ll show the gap closing. I never invent a before/after.',
      );
    } else {
      // Genuine fetch failure only — keep the retryable error path.
      setLift(null);
      setLiftNeedsRun(false);
      setLiftMessage(messageFor(liftRes));
    }
    setLiftLoading(false);

    const metricsRes = await service.getBusinessMetrics(selectedAvatarId, pivot);
    if (metricsRes.status === 'ok') setMetrics(metricsRes.data);
    else {
      setMetrics(null);
      setMetricsError(messageFor(metricsRes));
    }
    setMetricsLoading(false);

    const expRes = await service.getExperimentLifts(selectedAvatarId);
    if (expRes.status === 'ok') setExperiments(expRes.data);
    else {
      setExperiments(null);
      setExperimentsError(messageFor(expRes));
    }
    setExperimentsLoading(false);
  }, [service, selectedAvatarId, contextAvatarIds, avatarNames]);

  /**
   * Record the tester's verdict on an experiment, then refresh so the row flips to
   * its decided state. Surfaces a failed write as the experiments error (honest).
   */
  const markResult = useCallback(
    async (testId: string, verdict: ExperimentVerdict, resultValue: number | null): Promise<void> => {
      const res = await service.markExperimentResult(testId, verdict, resultValue);
      if (res.status !== 'ok') {
        setExperimentsError(messageFor(res));
        return;
      }
      await load();
    },
    [service, load],
  );

  return {
    hasAvatar,
    avatarId: selectedAvatarId,
    loadKey,
    lift,
    liftLoading,
    liftMessage,
    liftNeedsRun,
    metrics,
    metricsLoading,
    metricsError,
    experiments,
    experimentsLoading,
    experimentsError,
    load,
    markResult,
  };
}
