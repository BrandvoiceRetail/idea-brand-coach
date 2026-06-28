/**
 * useFixRun — drives the Loop-3 (Fix / Funnel-by-Job) orchestration for V4Fix.
 *
 * WHAT: Owns ALL Loop-3 data-fetching through the `fixService` seam, scoped to
 * the active avatar (`AvatarContext`). One funnel piece = one active brand asset
 * = one campaign (decision #1), so the hook is organised around that single
 * entity: the funnel pieces themselves, one piece's metrics (the "did it do its
 * job?" read), the on-brand rewrite + claim-gate for a fix, the tests ledger, and
 * the Signature-drift list. It also exposes the handlers the Fix screens fire —
 * open a piece, generate a rewrite, confirm a claim, open a test, re-check drift.
 *
 * WHY: Pages on /v4 are thin wiring shells (see src/pages/AGENTS.md) — the
 * orchestration (parallel reads, selection, per-piece metrics, rewrite/claim
 * state, openTest write + ledger refresh) belongs in a hook so V4Fix only manages
 * which sub-view is shown and wires data + handlers to the presentational screens.
 * Modeled on useAnalyseRun / the prior Fix hook.
 *
 * NO FABRICATION: every value comes from `fixService`, which degrades to
 * `no_data` / `needs_input` / `error` rather than inventing a piece, a metric, a
 * rewrite, a lift, or a test result. A piece's metrics are an honest `no_data`
 * until Windsor data is ingested (the `get-funnel-piece-metrics` seam is empty
 * pre-deploy); the screens render "—", never a guessed number.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { FixService, type OpenTestInput } from '@/services/v4/fixService';
import { useAvatarContext } from '@/contexts/AvatarContext';
import type { ClaimGateItem } from '@/types/v4Analyse';
import type {
  BriefSlots,
  DataResult,
  DriftItem,
  FixResult,
  FunnelPiece,
  MetricRange,
  PieceMetrics,
  TestRow,
} from '@/types/v4Fix';

/** Fold a non-ok FixResult into a single honest message for the screens. */
function messageFor(result: FixResult<unknown>): string {
  if (result.status === 'error') return result.error;
  if (result.status === 'needs_input') {
    return result.needs_input[0]?.question ?? 'I need a little more context first.';
  }
  return 'Something went wrong.';
}

/** Honest placeholder while a piece's metrics have not been read yet. */
const PENDING_METRICS: DataResult<PieceMetrics> = {
  status: 'no_data',
  reason: 'Opening this piece — reading its numbers…',
};

export interface FixRunHook {
  /** True when an avatar is selected to scope the funnel to (page-level gate). */
  hasAvatar: boolean;
  /** The active avatar id (null when none) — lets the page reload on a switch. */
  avatarId: string | null;
  /** The active avatar's display name (for piece labels); null when none. */
  avatarName: string | null;

  // ── Funnel pieces (FunnelMap) ──
  pieces: FunnelPiece[] | null;
  piecesLoading: boolean;
  /** Hard read error (couldn't reach the coach); null = none. */
  piecesError: string | null;
  /** Honest "no pieces yet" reason; null when there are pieces or an error. */
  piecesNoData: string | null;

  // ── Signature drift (DriftBanner) ──
  drift: DriftItem[];

  // ── Tests ledger (TestingLiftTab) ──
  tests: TestRow[] | null;
  testsLoading: boolean;
  testsError: string | null;
  testsNoData: string | null;
  /** Test id with a lifecycle milestone stamp in flight; null when none. */
  advancingTestId: string | null;

  // ── Selected piece (FunnelPieceDetail) ──
  selectedPiece: FunnelPiece | null;
  /** The selected piece's metric read (ok | no_data | error); null until opened. */
  pieceMetrics: DataResult<PieceMetrics> | null;
  pieceMetricsLoading: boolean;

  // ── Rewrite / brief for the fix (FixTestPanel variant B) ──
  brief: BriefSlots | null;
  briefLoading: boolean;
  briefError: string | null;

  // ── Open-test write (FixTestPanel) ──
  openTestSubmitting: boolean;
  openTestError: string | null;

  // ── Handlers ──
  load: () => Promise<void>;
  /** Open a piece's detail; `range` scopes the "did it do its job?" metric window. */
  selectPiece: (brandAssetId: string, range?: MetricRange) => Promise<void>;
  clearSelection: () => void;
  retryPieceMetrics: () => Promise<void>;
  onPieceAdded: () => Promise<void>;
  generateRewrite: () => Promise<void>;
  confirmClaim: (claim: ClaimGateItem, index: number) => void;
  openTest: (input: OpenTestInput) => Promise<boolean>;
  /** Stamp the ASSET_CREATED milestone on a test, then reload the ledger. */
  markAssetCreated: (testId: string) => Promise<void>;
  /** Stamp the ASSET_LIVE milestone on a test, then reload the ledger. */
  markAssetLive: (testId: string) => Promise<void>;
  recheckDrift: () => Promise<void>;
}

export function useFixRun(): FixRunHook {
  const { selectedAvatarId, currentAvatar } = useAvatarContext();
  const service = useMemo(() => new FixService(), []);

  const [pieces, setPieces] = useState<FunnelPiece[] | null>(null);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesError, setPiecesError] = useState<string | null>(null);
  const [piecesNoData, setPiecesNoData] = useState<string | null>(null);

  const [drift, setDrift] = useState<DriftItem[]>([]);

  const [tests, setTests] = useState<TestRow[] | null>(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [testsNoData, setTestsNoData] = useState<string | null>(null);

  const [selectedPiece, setSelectedPiece] = useState<FunnelPiece | null>(null);
  const [pieceMetrics, setPieceMetrics] = useState<DataResult<PieceMetrics> | null>(null);
  const [pieceMetricsLoading, setPieceMetricsLoading] = useState(false);
  // The range the open piece's metrics were read at — so retry re-reads the same
  // window the user selected in the toolbar (not always the default).
  const lastRangeRef = useRef<MetricRange>('30d');

  const [brief, setBrief] = useState<BriefSlots | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [openTestSubmitting, setOpenTestSubmitting] = useState(false);
  const [openTestError, setOpenTestError] = useState<string | null>(null);

  const [advancingTestId, setAdvancingTestId] = useState<string | null>(null);

  const hasAvatar = Boolean(selectedAvatarId);

  /** Read the tests ledger and fold its three outcomes into honest state. */
  const refreshTests = useCallback(
    async (avatarId: string): Promise<void> => {
      const res = await service.listTests(avatarId);
      if (res.status === 'ok') {
        setTests(res.data);
        setTestsNoData(null);
        setTestsError(null);
      } else if (res.status === 'no_data') {
        setTests([]);
        setTestsNoData(res.reason);
        setTestsError(null);
      } else {
        setTests(null);
        setTestsError(res.error);
      }
    },
    [service],
  );

  /**
   * Load the funnel in parallel: the pieces (the map), the Signature-drift list,
   * and the tests ledger. Each maps to its own honest state; none is fabricated
   * when the read returns no_data / error.
   */
  const load = useCallback(async (): Promise<void> => {
    if (!selectedAvatarId) return;
    setPiecesLoading(true);
    setPiecesError(null);
    setPiecesNoData(null);
    setTestsLoading(true);
    setTestsError(null);
    setTestsNoData(null);

    const [piecesRes, driftRes] = await Promise.all([
      service.getFunnelPieces(selectedAvatarId),
      service.getDrift(selectedAvatarId),
      refreshTests(selectedAvatarId),
    ]);

    if (piecesRes.status === 'ok') {
      setPieces(piecesRes.data);
    } else if (piecesRes.status === 'no_data') {
      setPieces([]);
      setPiecesNoData(piecesRes.reason);
    } else {
      setPieces(null);
      setPiecesError(piecesRes.error);
    }
    setPiecesLoading(false);

    setDrift(driftRes.status === 'ok' ? driftRes.data : []);
    setTestsLoading(false);
  }, [service, selectedAvatarId, refreshTests]);

  /** Read one piece's metrics for the detail's "did it do its job?" panel. */
  const readPieceMetrics = useCallback(
    async (piece: FunnelPiece, range: MetricRange): Promise<void> => {
      lastRangeRef.current = range;
      setPieceMetricsLoading(true);
      const res = await service.getPieceMetrics(piece.id, range);
      setPieceMetrics(res);
      setPieceMetricsLoading(false);
    },
    [service],
  );

  /** Open a piece's detail; resets the rewrite/test state and reads its metrics. */
  const selectPiece = useCallback(
    async (brandAssetId: string, range: MetricRange = '30d'): Promise<void> => {
      const piece = (pieces ?? []).find((p) => p.id === brandAssetId) ?? null;
      setSelectedPiece(piece);
      setBrief(null);
      setBriefError(null);
      setOpenTestError(null);
      if (!piece) {
        setPieceMetrics(null);
        return;
      }
      setPieceMetrics(PENDING_METRICS);
      await readPieceMetrics(piece, range);
    },
    [pieces, readPieceMetrics],
  );

  /** Retry the selected piece's metric read after an error (same range). */
  const retryPieceMetrics = useCallback(async (): Promise<void> => {
    if (selectedPiece) await readPieceMetrics(selectedPiece, lastRangeRef.current);
  }, [selectedPiece, readPieceMetrics]);

  /** Back out of a piece detail / fix surface to the map. */
  const clearSelection = useCallback((): void => {
    setSelectedPiece(null);
    setPieceMetrics(null);
    setBrief(null);
    setBriefError(null);
    setOpenTestError(null);
  }, []);

  /** Re-load the funnel after a new piece is added (pieces + tests + drift). */
  const onPieceAdded = useCallback(async (): Promise<void> => {
    await load();
  }, [load]);

  /**
   * Generate the on-brand rewrite for the open piece via the claim-gated brief
   * engine (variant B for the A/B test). Surfaces needs_input/error honestly —
   * never a fabricated rewrite or an unconfirmed claim asserted as fact.
   */
  const generateRewrite = useCallback(async (): Promise<void> => {
    if (!selectedPiece || !selectedAvatarId) return;
    setBriefLoading(true);
    setBriefError(null);
    const result = await service.generateBrief({
      touchpointId: selectedPiece.touchpointId,
      avatarId: selectedAvatarId,
      context: selectedPiece.storedContent.title ?? undefined,
    });
    if (result.status === 'ok') setBrief(result.data);
    else {
      setBrief(null);
      setBriefError(messageFor(result));
    }
    setBriefLoading(false);
  }, [service, selectedPiece, selectedAvatarId]);

  /** Promote one product claim to confirmed on the live rewrite (claim gate). */
  const confirmClaim = useCallback((_claim: ClaimGateItem, index: number): void => {
    setBrief((prev) =>
      prev
        ? {
            ...prev,
            claimGate: prev.claimGate.map((c, i) =>
              i === index ? { ...c, status: 'confirmed', reason: undefined } : c,
            ),
          }
        : prev,
    );
  }, []);

  /**
   * Open a test against the open piece (writes brand_tests). On success refreshes
   * the tests ledger so Testing & Lift shows it; returns whether it succeeded so
   * the page can route to the ledger. Never fabricates a result.
   */
  const openTest = useCallback(
    async (input: OpenTestInput): Promise<boolean> => {
      setOpenTestSubmitting(true);
      setOpenTestError(null);
      const res = await service.openTest(input);
      if (res.status === 'ok') {
        if (selectedAvatarId) await refreshTests(selectedAvatarId);
        setOpenTestSubmitting(false);
        return true;
      }
      setOpenTestError(res.status === 'no_data' ? res.reason : res.error);
      setOpenTestSubmitting(false);
      return false;
    },
    [service, selectedAvatarId, refreshTests],
  );

  /**
   * Stamp a lifecycle milestone on a test (ASSET_CREATED / ASSET_LIVE), then reload
   * the ledger so the derived stage + date show. Surfaces a write failure as a
   * tests error; never fabricates the milestone date.
   */
  const stampMilestone = useCallback(
    async (testId: string, kind: 'created' | 'live'): Promise<void> => {
      setAdvancingTestId(testId);
      const res =
        kind === 'created'
          ? await service.markAssetCreated(testId)
          : await service.markAssetLive(testId);
      if (res.status !== 'ok') {
        setTestsError(res.status === 'no_data' ? res.reason : res.error);
      } else if (selectedAvatarId) {
        await refreshTests(selectedAvatarId);
      }
      setAdvancingTestId(null);
    },
    [service, selectedAvatarId, refreshTests],
  );

  const markAssetCreated = useCallback(
    (testId: string): Promise<void> => stampMilestone(testId, 'created'),
    [stampMilestone],
  );
  const markAssetLive = useCallback(
    (testId: string): Promise<void> => stampMilestone(testId, 'live'),
    [stampMilestone],
  );

  /** Re-read drift + the funnel after the user works on a drifted piece. */
  const recheckDrift = useCallback(async (): Promise<void> => {
    await load();
  }, [load]);

  return {
    hasAvatar,
    avatarId: selectedAvatarId,
    avatarName: currentAvatar?.name ?? null,
    pieces,
    piecesLoading,
    piecesError,
    piecesNoData,
    drift,
    tests,
    testsLoading,
    testsError,
    testsNoData,
    advancingTestId,
    selectedPiece,
    pieceMetrics,
    pieceMetricsLoading,
    brief,
    briefLoading,
    briefError,
    openTestSubmitting,
    openTestError,
    load,
    selectPiece,
    clearSelection,
    retryPieceMetrics,
    onPieceAdded,
    generateRewrite,
    confirmClaim,
    openTest,
    markAssetCreated,
    markAssetLive,
    recheckDrift,
  };
}
