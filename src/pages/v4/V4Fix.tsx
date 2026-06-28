/**
 * V4Fix — the Fix stage (Loop 3, Funnel-by-Job).
 *
 * WHAT: The thin wiring shell that orchestrates the Loop-3 funnel flow inside the
 * /v4 shell (sidebar + spine stepper + bottom-nav). It composes the rebuilt
 * funnel as a small set of sub-views over ONE entity — a funnel piece = an active
 * brand asset = a campaign (decision #1):
 *   • `map`     — the job-first FunnelMap ("is each piece doing its job?") + the
 *                 self-hiding Signature DriftBanner. The default surface.
 *   • `detail`  — FunnelPieceDetail ("did this piece do its job?") for one piece.
 *   • `fix`     — FixTestPanel: name the leak, write an on-brand rewrite, open an
 *                 A/B test against the current copy.
 *   • `testing` — TestingLiftTab: every fix put into a test and what it moved.
 * AddPieceDialog is a modal overlay reachable from the map / "check an asset".
 *
 * ALL data-fetching is owned by `useFixRun` (the fixService seam scoped to the
 * active avatar). This page only manages which sub-view is shown, passes typed
 * data + handlers to the presentational screens, owns the primary CTA that
 * advances the spine (Fix → Re-measure), and emits the page-level funnel events.
 *
 * NO FABRICATION: the funnel/metrics/drift reads are owner-scoped to a real
 * avatar; with no avatar yet an honest gate sends the user back to Analyse rather
 * than inventing a map. A piece's metrics are an honest `no_data` until Windsor
 * data is ingested (the metrics seam is empty pre-deploy) — every screen renders
 * its own loading / empty / error+retry state and shows "—", never a guessed
 * number.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, FlaskConical, Map as MapIcon, Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DriftBanner } from '@/components/v4/fix/DriftBanner';
import { FunnelMap } from '@/components/v4/fix/FunnelMap';
import { FunnelPieceDetail } from '@/components/v4/fix/FunnelPieceDetail';
import { AddPieceDialog } from '@/components/v4/fix/AddPieceDialog';
import { FixTestPanel } from '@/components/v4/fix/FixTestPanel';
import { TestingLiftTab } from '@/components/v4/fix/TestingLiftTab';
import { FixBreadcrumb } from '@/components/v4/fix/FixBreadcrumb';
import type { GroundedField } from '@/components/v4/GroundedStrip';
import { useFixRun } from '@/hooks/useFixRun';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { V4_ROUTES } from '@/config/v4';
import { FUNNEL_JOBS, METRIC_META, type MetricKey } from '@/config/v4Funnel';
import { getTouchpoint, getStages } from '@/config/touchpointTaxonomy';
import { DEFAULT_BRAND_TAGS } from '@/hooks/useFunnelTracker';
import type { DataResult, FixLeak, MetricRange, PieceMetrics } from '@/types/v4Fix';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';

/** The Loop-3 sub-views this page switches between. */
type FixView = 'map' | 'detail' | 'fix' | 'testing';

/**
 * Page-level Loop-3 funnel events. All names are registered in the canonical
 * `posthogClient` registry — IDs/slugs/booleans only, never user-facing copy.
 */
function emitPage(
  name:
    | 'v4_fix_stage_viewed'
    | 'v4_fix_gate_blocked'
    | 'v4_fix_view_changed'
    | 'v4_fix_advanced_to_remeasure',
  properties?: AlphaEventProps,
): void {
  captureAlphaEvent(name, properties);
}

/** Everyday stage label from the taxonomy (Tier-A). */
function stageLabelFor(stageId: string): string {
  return getStages().find((s) => s.id === stageId)?.label ?? stageId;
}

/** Parse a user-typed baseline ("10.7%", "$24.99") into a number; 0 when blank. */
function parseBaseline(raw: string): number {
  const n = Number(raw.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function V4Fix(): JSX.Element {
  const navigate = useNavigate();
  const {
    hasAvatar,
    avatarId,
    avatarName,
    pieces,
    piecesLoading,
    piecesError,
    drift,
    tests,
    testsLoading,
    testsError,
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
  } = useFixRun();

  // Avatar scope for the toolbar selector (the canonical store).
  const { avatars, setCurrentAvatar } = useAvatarContext();
  const avatarOptions = useMemo(
    () => (avatars ?? []).filter((a) => !a.is_template).map((a) => ({ id: a.id, name: a.name })),
    [avatars],
  );

  const [view, setViewState] = useState<FixView>('map');
  const [addOpen, setAddOpen] = useState(false);

  // The piece whose test was last opened — drives the "← Back to {piece}" return
  // affordance in Testing & Lift so opening a test is never a dead-end.
  const [lastWorkedPiece, setLastWorkedPiece] = useState<{ id: string; label: string } | null>(null);

  // Toolbar scope, lifted from FunnelMap so the controls drive real reads:
  // `range` threads into the piece-metrics window; `marketplace` is the parent-owned
  // storefront scope. (Avatar switching is owned by AvatarContext.)
  const [range, setRange] = useState<MetricRange>('30d');
  const [marketplace, setMarketplace] = useState('amazon_us');

  // FixTestPanel form state (ephemeral view-local UI; the seam owns the data).
  const [hypothesis, setHypothesis] = useState('');
  const [metric, setMetric] = useState<MetricKey>('cvr');
  const [baseline, setBaseline] = useState('');

  const brandTags = useMemo(() => DEFAULT_BRAND_TAGS, []);

  // Keyed on the avatar id (not a boolean) so switching avatars while the page
  // stays mounted re-loads the funnel for the new avatar instead of showing stale
  // data scoped to the old one.
  const loadedForRef = useRef<string | null>(null);

  // Auto-load the funnel on entry — and again whenever the active avatar changes.
  useEffect(() => {
    emitPage('v4_fix_stage_viewed', { has_avatar: hasAvatar });
    if (hasAvatar && loadedForRef.current !== avatarId) {
      loadedForRef.current = avatarId;
      void load();
    } else if (!hasAvatar) {
      emitPage('v4_fix_gate_blocked', {});
    }
  }, [hasAvatar, avatarId, load]);

  // Reset the fix form whenever the piece under fix changes (default the metric
  // to that stage's primary job metric).
  useEffect(() => {
    if (!selectedPiece) return;
    setHypothesis('');
    setBaseline('');
    setMetric(FUNNEL_JOBS[selectedPiece.stage].primaryMetrics[0]);
  }, [selectedPiece]);

  const goTo = (next: FixView): void => {
    setViewState(next);
    emitPage('v4_fix_view_changed', { view: next });
  };

  // Breadcrumb / tab "Funnel" = the canonical "up" control for the Funnel
  // drill-down. Jumping to the map clears the piece selection (leaving the
  // drill-down is a clean slate — no stale piece lingers); jumping to detail
  // keeps the worked piece. Replaces the scattered single-step back buttons.
  const handleCrumb = (target: 'map' | 'detail'): void => {
    if (target === 'map') {
      clearSelection();
      goTo('map');
    } else {
      goTo('detail');
    }
  };

  const pieceLabel = selectedPiece
    ? getTouchpoint(selectedPiece.touchpointId)?.label ?? selectedPiece.touchpointId
    : '';

  // ── Map handlers ───────────────────────────────────────────────────────────
  const handleSelectPiece = (brandAssetId: string): void => {
    void selectPiece(brandAssetId, range);
    goTo('detail');
  };

  // ── Detail action handlers ─────────────────────────────────────────────────
  const handleGetBriefOrTest = (): void => {
    goTo('fix');
  };
  const handleCheckAsset = (): void => {
    // "Check an uploaded asset" = put it under the coach's eye via the upload flow.
    setAddOpen(true);
  };

  // ── Fix → open a test ──────────────────────────────────────────────────────
  const rewrite = useMemo<string | null>(() => {
    if (!brief) return null;
    return brief.titleFormula.exampleOutput || brief.bullets[0]?.exampleOutput || null;
  }, [brief]);

  const handleOpenTest = async (): Promise<void> => {
    if (!selectedPiece) return;
    const ok = await openTest({
      pieceId: selectedPiece.id,
      pieceLabel,
      hypothesis,
      metric,
      baseline: parseBaseline(baseline),
    });
    if (ok) {
      // Remember the worked piece so Testing & Lift can offer a route back to it.
      setLastWorkedPiece({ id: selectedPiece.id, label: pieceLabel });
      toast.success('Test opened. Track its lift in Testing & Lift.');
      goTo('testing');
    }
  };

  // ── Spine advance ──────────────────────────────────────────────────────────
  const handleAdvance = (): void => {
    emitPage('v4_fix_advanced_to_remeasure', {
      piece_count: pieces?.length ?? 0,
      worked_piece: Boolean(selectedPiece),
    });
    navigate(V4_ROUTES.REMEASURE);
  };

  // The CTA unlocks once the funnel has been read (you can see what needs work).
  const canAdvance = pieces !== null && !piecesError;

  // ── Testing & Lift export ──────────────────────────────────────────────────
  // Download the real tests ledger as CSV (no fabricated rows; honest blanks for
  // a running test's result). Only reachable when rows exist (the tab hides the
  // button otherwise), so we never export an empty file.
  const handleExportTests = (): void => {
    const rows = tests ?? [];
    captureAlphaEvent('v4_testing_lift_exported', { test_count: rows.length });
    const esc = (v: string): string => `"${v.replace(/"/g, '""')}"`;
    const header = ['Test', 'Funnel piece', 'Metric', 'Baseline', 'Result', 'Status', 'Type'];
    const body = rows.map((r) =>
      [
        r.name,
        r.pieceLabel,
        r.metric,
        r.baseline ?? '',
        r.result ?? '',
        r.status,
        r.kind,
      ]
        .map((c) => esc(String(c)))
        .join(','),
    );
    const csv = [header.map(esc).join(','), ...body].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `testing-lift-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // The leak the fix targets: the piece's primary job metric vs target (none set
  // in Alpha) + the continuity break carried from the verdict. Honest "—" current.
  const leak = useMemo<FixLeak>(() => {
    const current =
      selectedPiece && pieceMetrics?.status === 'ok'
        ? pieceMetrics.data.metrics[metric]?.value ?? null
        : null;
    return {
      metric,
      current,
      target: null,
      continuityBreak:
        selectedPiece && selectedPiece.status !== 'doing_job'
          ? 'The promise from the step before isn’t carried through here.'
          : null,
    };
  }, [selectedPiece, pieceMetrics, metric]);

  const metricOptions = useMemo<MetricKey[]>(() => {
    const fromJob = selectedPiece ? FUNNEL_JOBS[selectedPiece.stage].primaryMetrics : [];
    return Array.from(new Set<MetricKey>([...fromJob, 'cvr', 'ctr', 'aov']));
  }, [selectedPiece]);

  // Coach-insight bar copy: the narrative bridge from the piece's verdict + its
  // primary-job-metric reading to the highest-leverage fix. Self-hides for a
  // missing slot (nothing built) or no selection. NEVER states a fabricated
  // number — when the metric has no reading it says so honestly.
  const insight = useMemo<string | null>(() => {
    if (!selectedPiece || selectedPiece.status === 'missing') return null;
    const primary = FUNNEL_JOBS[selectedPiece.stage].primaryMetrics[0];
    const label = METRIC_META[primary].label;
    if (selectedPiece.status === 'doing_job') {
      return `This piece is doing its job — it holds the message from the step before and ${label} is where you want it. Keep it as the control when you test the leaks elsewhere.`;
    }
    const reading =
      pieceMetrics?.status === 'ok' ? pieceMetrics.data.metrics[primary]?.value ?? null : null;
    const numberPhrase =
      reading === null
        ? `you don't have a ${label} reading pulled for it yet`
        : `${label} is the number to move`;
    return `This piece is leaking — traffic reaches it but ${numberPhrase}, and the promise from the step before isn't carried through. Fix the message continuity first, then put ${label} into a test.`;
  }, [selectedPiece, pieceMetrics]);

  const grounded: GroundedField[] = selectedPiece
    ? [{ label: 'Avatar', present: Boolean(avatarId) }]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Wrench className="h-7 w-7 text-gold-warm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fix</h1>
          <p className="text-muted-foreground">Map the funnel, fix what moves the numbers</p>
        </div>
      </header>

      {/* Honest gate: no avatar scoped yet → send the user back to Analyse. */}
      {!hasAvatar ? (
        <Card data-testid="v4-fix-avatar-gate">
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-gold-warm" />
              Let&apos;s lock in your customer first
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              The funnel map is scoped to one customer — I won&apos;t guess which.
              Build and confirm your avatar in Analyse and I&apos;ll bring you
              straight back here to map and fix your funnel. Nothing is invented
              along the way.
            </p>
            <Button
              type="button"
              variant="brand"
              className="min-h-[40px] gap-2"
              onClick={() => navigate(V4_ROUTES.ANALYSE)}
              data-testid="v4-fix-go-analyse"
            >
              Go to Analyse
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Sub-view tabs — Funnel · Testing & Lift. */}
          <nav
            className="flex flex-wrap gap-2 border-b border-border pb-2"
            aria-label="Fix sub-views"
            data-testid="v4-fix-subnav"
          >
            <Button
              type="button"
              size="sm"
              variant={view === 'map' || view === 'detail' || view === 'fix' ? 'brand' : 'ghost'}
              className="min-h-9 gap-1.5"
              onClick={() => handleCrumb('map')}
              data-testid="v4-fix-tab-funnel"
            >
              <MapIcon className="h-4 w-4" />
              Funnel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'testing' ? 'brand' : 'ghost'}
              className="min-h-9 gap-1.5"
              onClick={() => goTo('testing')}
              data-testid="v4-fix-tab-testing"
            >
              <FlaskConical className="h-4 w-4" />
              Testing &amp; Lift
            </Button>
          </nav>

          {/* Funnel drill-down trail — the canonical "up" control for map → piece
              → Fix (replaces the scattered back buttons). Sticky header on mobile
              (sits below the spine stepper at top-12); inline above content on
              desktop. Only the Funnel drill-down (detail/fix) has a trail. */}
          {(view === 'detail' || view === 'fix') && (
            <div className="sticky top-12 z-10 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6 md:static md:top-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
              <FixBreadcrumb view={view} pieceLabel={pieceLabel || null} onCrumb={handleCrumb} />
            </div>
          )}

          {/* ── Map view (default) ── */}
          {view === 'map' && (
            <div className="space-y-4">
              <DriftBanner driftItems={drift} onRecheck={() => void recheckDrift()} />
              <FunnelMap
                pieces={pieces}
                loading={piecesLoading}
                error={piecesError}
                coveragePct={null}
                avatars={avatarOptions}
                selectedAvatarId={avatarId}
                onAvatarChange={(id) => void setCurrentAvatar(id)}
                marketplace={marketplace}
                onMarketplaceChange={setMarketplace}
                range={range}
                onRangeChange={setRange}
                onSelectPiece={handleSelectPiece}
                onAddPiece={() => setAddOpen(true)}
                onRetry={() => void load()}
              />

              {/* Primary CTA — advances the spine once the funnel has been read. */}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {canAdvance
                    ? "Funnel mapped. When you've worked the top fixes, re-measure to prove the lift."
                    : 'Mapping your funnel…'}
                </p>
                <Button
                  type="button"
                  variant="brand"
                  className="gap-2"
                  onClick={handleAdvance}
                  disabled={!canAdvance}
                  data-testid="v4-fix-continue-to-remeasure"
                >
                  Continue to Re-measure
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Piece detail view ── */}
          {view === 'detail' &&
            (selectedPiece ? (
              <FunnelPieceDetail
                piece={selectedPiece}
                pieceLabel={avatarName ? `${pieceLabel} — ${avatarName}` : pieceLabel}
                metrics={pieceMetrics ?? ({ status: 'no_data', reason: 'Open a piece to read its numbers.' } as DataResult<PieceMetrics>)}
                metricsLoading={pieceMetricsLoading}
                onRetryMetrics={() => void retryPieceMetrics()}
                insight={insight}
                grounded={grounded}
                onUpdateStored={() => setAddOpen(true)}
                onGetBrief={handleGetBriefOrTest}
                onOpenTest={handleGetBriefOrTest}
                onCheckAsset={handleCheckAsset}
              />
            ) : (
              <Card data-testid="v4-fix-detail-empty">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Pick a piece from the funnel map to work on it here.
                </CardContent>
              </Card>
            ))}

          {/* ── Fix & test view ── */}
          {view === 'fix' &&
            (selectedPiece ? (
              <div className="space-y-3">
                <FixTestPanel
                  pieceLabel={pieceLabel}
                  stageLabel={stageLabelFor(selectedPiece.stage)}
                  leak={leak}
                  hypothesis={hypothesis}
                  onHypothesisChange={setHypothesis}
                  metric={metric}
                  onMetricChange={setMetric}
                  metricOptions={metricOptions}
                  baseline={baseline}
                  onBaselineChange={setBaseline}
                  currentCopy={selectedPiece.storedContent.title ?? '(no stored copy yet)'}
                  rewrite={rewrite}
                  rewriteClaims={brief?.claimGate ?? []}
                  rewriteLoading={briefLoading}
                  rewriteError={briefError}
                  onGenerateRewrite={() => void generateRewrite()}
                  onConfirmClaim={confirmClaim}
                  onOpenTest={() => void handleOpenTest()}
                  openTestLoading={openTestSubmitting}
                  openTestError={openTestError}
                  onOpenCoach={() =>
                    toast.info('Open a Brand Coach chat to refine this fix with the coach.')
                  }
                />
              </div>
            ) : (
              <Card data-testid="v4-fix-test-empty">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Pick a piece from the funnel map to open a test.
                </CardContent>
              </Card>
            ))}

          {/* ── Testing & Lift view ── */}
          {view === 'testing' && (
            <div className="space-y-3">
              {/* No dead-end: hop straight back to the piece whose test we just
                  opened (not just the tab). */}
              {lastWorkedPiece && (
                <button
                  type="button"
                  onClick={() => {
                    void selectPiece(lastWorkedPiece.id, range);
                    goTo('detail');
                  }}
                  data-testid="v4-fix-testing-back-to-piece"
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to {lastWorkedPiece.label}
                </button>
              )}
              <TestingLiftTab
                tests={tests}
                isLoading={testsLoading}
                error={testsError}
                onRetry={() => void load()}
                onExport={handleExportTests}
                onMarkAssetCreated={(id) => void markAssetCreated(id)}
                onMarkAssetLive={(id) => void markAssetLive(id)}
                advancingTestId={advancingTestId}
              />
            </div>
          )}
        </div>
      )}

      {/* Add-a-piece dialog (modal overlay) — reachable from the map / check-asset. */}
      <AddPieceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        avatarId={avatarId}
        brandTags={brandTags}
        onAdded={() => void onPieceAdded()}
      />
    </div>
  );
}
