/**
 * V4Remeasure — the Re-measure stage (Loop-4, S-16).
 *
 * WHAT: The thin wiring shell that orchestrates the Loop-4 flow inside the /v4
 * shell (sidebar + spine stepper + bottom-nav): the deterministic Trust Gap
 * before/after TrustGapLiftCard + the business-metric BusinessMetricsCard. ALL
 * data-fetching is owned by `useRemeasureRun` (the remeasureService seam scoped to
 * the active avatar); this page only passes data + handlers to the presentational
 * screens, owns the primary CTA that advances the spine (Re-measure → Defend), and
 * emits the page-level funnel events.
 *
 * WHY: Pages on /v4 are thin shells (src/pages/AGENTS.md). Keeping orchestration in
 * the hook lets this file stay a readable map of the Re-measure leg of the
 * Diagnose → Analyse → Fix → Re-measure → Defend spine.
 *
 * NO FABRICATION: the Trust Gap delta is pure arithmetic on two REAL diagnostic
 * runs (mirrors the live compute_trust_gap_lift engine); with only one run an
 * honest "re-run the diagnostic" prompt shows instead of a made-up before/after.
 * Business metrics are empty until the analytics migration lands → honest no-data,
 * never a fabricated lift. With no avatar an honest gate sends the user to Analyse.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Gauge, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrustGapLiftCard } from '@/components/v4/remeasure/TrustGapLiftCard';
import { BusinessMetricsCard } from '@/components/v4/remeasure/BusinessMetricsCard';
import { ExperimentLiftCard } from '@/components/v4/remeasure/ExperimentLiftCard';
import { useRemeasureRun } from '@/hooks/useRemeasureRun';
import { V4_ROUTES } from '@/config/v4';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';

/**
 * Page-level Loop-4 funnel events. Cast to the shared union at this single seam
 * (keeps the canonical posthogClient registry untouched) — IDs/booleans only,
 * never user-facing copy. Mirrors the V4Fix page telemetry pattern.
 */
type V4RemeasurePageEvent =
  | 'v4_remeasure_stage_viewed'
  | 'v4_remeasure_gate_blocked'
  | 'v4_remeasure_advanced_to_defend';

function emitPage(name: V4RemeasurePageEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export default function V4Remeasure(): JSX.Element {
  const navigate = useNavigate();
  const {
    hasAvatar,
    avatarId,
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
  } = useRemeasureRun();

  // Keyed on the avatar id (not a boolean) so switching avatars while the page
  // stays mounted re-loads for the new avatar instead of keeping stale data.
  const loadedForRef = useRef<string | null>(null);

  // Auto-load on entry — and again whenever the active avatar changes.
  useEffect(() => {
    emitPage('v4_remeasure_stage_viewed', { has_avatar: hasAvatar });
    if (hasAvatar && loadedForRef.current !== avatarId) {
      loadedForRef.current = avatarId;
      void load();
    } else if (!hasAvatar) {
      emitPage('v4_remeasure_gate_blocked', {});
    }
  }, [hasAvatar, avatarId, load]);

  // Gate the CTA consistently with the other stages: block while the lift read is
  // in flight, and block a hard error with no resolution. Allow advance when a
  // real lift exists OR the system honestly says a second diagnostic run is needed
  // — never trap the tester at this terminal-but-one stage.
  const canAdvance = !liftLoading && (Boolean(lift) || liftNeedsRun);

  const handleAdvance = (): void => {
    emitPage('v4_remeasure_advanced_to_defend', {
      has_lift: Boolean(lift),
      direction: lift?.direction ?? null,
      has_metrics: Boolean(metrics?.hasData),
    });
    navigate(V4_ROUTES.DEFEND);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Gauge className="h-7 w-7 text-gold-warm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Re-measure</h1>
          <p className="text-muted-foreground">Prove the lift — watch the gap close</p>
        </div>
      </header>

      {/* Honest gate: no avatar scoped yet → send the user back to Analyse. */}
      {!hasAvatar ? (
        <Card data-testid="v4-remeasure-avatar-gate">
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-gold-warm" />
              Let&apos;s lock in your customer first
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              The before/after is scoped to one customer — I won&apos;t guess which.
              Build and confirm your avatar in Analyse and I&apos;ll bring you back
              here to measure the lift. Nothing is invented along the way.
            </p>
            <Button
              type="button"
              variant="brand"
              className="min-h-[40px] gap-2"
              onClick={() => navigate(V4_ROUTES.ANALYSE)}
              data-testid="v4-remeasure-go-analyse"
            >
              Go to Analyse
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <TrustGapLiftCard
            lift={lift}
            isLoading={liftLoading}
            message={liftMessage}
            needsRun={liftNeedsRun}
            onRetry={() => void load()}
            onRunDiagnostic={() => navigate(V4_ROUTES.DIAGNOSE)}
          />

          <BusinessMetricsCard
            view={metrics}
            isLoading={metricsLoading}
            error={metricsError}
            onRetry={() => void load()}
          />

          <ExperimentLiftCard
            lifts={experiments}
            isLoading={experimentsLoading}
            error={experimentsError}
            onRetry={() => void load()}
            onMark={(testId, verdict, resultValue) =>
              void markResult(testId, verdict, resultValue)
            }
          />

          {/* Primary CTA — advances the spine to Defend. */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {lift
                ? 'Lift measured. Lock in the gains and defend the position you just earned.'
                : 'Re-run the diagnostic to measure your lift, then defend the gains.'}
            </p>
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              onClick={handleAdvance}
              disabled={!canAdvance}
              data-testid="v4-remeasure-continue-to-defend"
            >
              Continue to Defend
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
