/**
 * TrustGapLiftCard (S-16) — Loop-4 "watch the gap close" proof.
 *
 * WHAT: Renders the deterministic Trust Gap before/after (`TrustGapLift` from
 * src/types/v4Remeasure.ts) — the overall score move, each IDEA pillar's
 * before→after with its delta, the biggest mover, the weakest pillar now (the next
 * lever), and the plain-language summary. When fewer than two real diagnostic runs
 * exist it shows an honest "re-run the diagnostic" prompt; a hard read failure
 * shows a retryable error. Loading state is explicit.
 *
 * WHY: This is the Diagnose→Analyse→Fix→Re-measure spine's "prove it worked" leg —
 * the reason the owner keeps going. Like the rest of /v4 nothing is fabricated: the
 * delta is pure arithmetic on two real runs (mirrors the live
 * `compute_trust_gap_lift` engine), and with only one run we say so plainly rather
 * than inventing a before/after. All copy is Tier-A public vocabulary; no Tier-C
 * internals. v23 semantic tokens only (no hex); 0 horizontal overflow at 375px.
 */
import { useEffect } from 'react';
import { Gauge, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { TrustGapLift, TrustPillar, LiftDirection } from '@/types/v4Remeasure';

/**
 * Loop-4 funnel events for this screen. Cast to the shared union at the single
 * call site — keeps the canonical client untouched while still flowing through the
 * one PostHog seam (IDs/booleans/counts only, never user-facing copy). Mirrors the
 * sibling WhatNeedsWork (S-13) v4 telemetry pattern.
 */
type V4LiftEvent = 'v4_trust_gap_lift_viewed';

function captureV4(name: V4LiftEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

const PILLAR_META: Record<TrustPillar, { label: string; tone: string; bar: string }> = {
  insight: { label: 'Insight-driven', tone: 'text-idea-i', bar: 'bg-idea-i' },
  distinctive: { label: 'Distinctive', tone: 'text-idea-d', bar: 'bg-idea-d' },
  empathetic: { label: 'Empathetic', tone: 'text-idea-e', bar: 'bg-idea-e' },
  authentic: { label: 'Authentic', tone: 'text-idea-a', bar: 'bg-idea-a' },
};
const PILLARS: readonly TrustPillar[] = ['insight', 'distinctive', 'empathetic', 'authentic'];

export interface TrustGapLiftCardProps {
  /** The deterministic before/after lift; null when not yet computable. */
  lift?: TrustGapLift | null;
  /** True while the diagnostic history read is in flight. */
  isLoading?: boolean;
  /** Honest message when the lift can't be shown (needs a run, or a read error). */
  message?: string | null;
  /** True when `message` is a need-a-second-run prompt (vs a hard error). */
  needsRun?: boolean;
  /** Retry handler for the error state. */
  onRetry?: () => void;
  /** Send the user to re-run the diagnostic (the needs-run path). */
  onRunDiagnostic?: () => void;
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-trust-gap-lift" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-gold-warm" />
          Your Trust Gap, before and after
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function DirectionIcon({ direction }: { direction: LiftDirection }): JSX.Element {
  if (direction === 'improved') return <ArrowUpRight className="h-4 w-4 text-idea-e" />;
  if (direction === 'declined') return <ArrowDownRight className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

const sign = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const deltaTone = (n: number): string =>
  n > 0 ? 'text-idea-e' : n < 0 ? 'text-destructive' : 'text-muted-foreground';

export function TrustGapLiftCard({
  lift = null,
  isLoading = false,
  message = null,
  needsRun = false,
  onRetry,
  onRunDiagnostic,
}: TrustGapLiftCardProps): JSX.Element {
  // Observability: fire once per resolved view (not on loading renders).
  useEffect(() => {
    if (isLoading) return;
    captureV4('v4_trust_gap_lift_viewed', {
      state: lift ? 'data' : needsRun ? 'needs_run' : message ? 'error' : 'empty',
      direction: lift?.direction ?? null,
      overall_delta: lift?.overallDelta ?? null,
    });
  }, [isLoading, lift, needsRun, message]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-3" data-testid="v4-lift-loading">
          <Skeleton className="h-10 w-40" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </Shell>
    );
  }

  // ── Needs a second run (honest no-data, not an error) ─────────────────────────
  if (!lift && needsRun) {
    return (
      <Shell>
        <div
          className="space-y-3 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-lift-needs-run"
        >
          <p className="font-medium text-foreground">No lift to show yet.</p>
          <p className="text-muted-foreground">
            {message ??
              'Re-run the Trust Gap diagnostic now that your fix is live, and I will show the gap moving against your first run. I never invent a before/after.'}
          </p>
          {onRunDiagnostic && (
            <Button type="button" variant="brand" size="sm" className="gap-2" onClick={onRunDiagnostic}>
              <RefreshCw className="h-4 w-4" />
              Re-run the diagnostic
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Hard error ────────────────────────────────────────────────────────────────
  if (!lift) {
    return (
      <Shell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-lift-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t read your diagnostic history.
          </p>
          {message && <p className="text-muted-foreground">{message}</p>}
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Overall before → after */}
      <div
        className="flex flex-wrap items-end gap-x-3 gap-y-1"
        data-testid="v4-lift-overall"
      >
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {lift.overallBefore}
        </span>
        <span className="pb-1 text-muted-foreground">→</span>
        <span className="text-3xl font-bold tracking-tight text-foreground">
          {lift.overallAfter}
        </span>
        <span
          className={`flex items-center gap-1 pb-1 text-sm font-semibold ${deltaTone(lift.overallDelta)}`}
          data-testid="v4-lift-overall-delta"
        >
          <DirectionIcon direction={lift.direction} />
          {sign(lift.overallDelta)}
        </span>
        <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
      </div>

      {/* Per-pillar before → after with delta + after-score bar */}
      <ul className="space-y-3" data-testid="v4-lift-pillars">
        {PILLARS.map((p) => {
          const meta = PILLAR_META[p];
          const before = lift.pillarBefore[p];
          const after = lift.pillarAfter[p];
          const delta = lift.pillarDeltas[p];
          return (
            <li key={p} data-testid={`v4-lift-pillar-${p}`} className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm">
                <span className={`font-medium ${meta.tone}`}>{meta.label}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span>
                    {before} → <span className="font-semibold text-foreground">{after}</span>/25
                  </span>
                  <Badge variant="secondary" className={`${deltaTone(delta)} bg-muted`}>
                    {sign(delta)}
                  </Badge>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={after}
                aria-valuemin={0}
                aria-valuemax={25}
                aria-label={`${meta.label} now ${after} out of 25`}
              >
                <div
                  className={`h-full rounded-full transition-all ${meta.bar}`}
                  style={{ width: `${(after / 25) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Biggest mover + weakest-now levers */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="v4-lift-levers">
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Biggest mover
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {PILLAR_META[lift.biggestMover.pillar].label}{' '}
            <span className={deltaTone(lift.biggestMover.delta)}>
              ({sign(lift.biggestMover.delta)})
            </span>
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Next lever
          </p>
          <p className="mt-0.5 font-medium text-foreground">
            {PILLAR_META[lift.weakestNow.pillar].label} ({lift.weakestNow.score}/25)
          </p>
        </div>
      </div>

      <p className="rounded-md bg-muted/60 p-3 text-sm text-foreground" data-testid="v4-lift-summary">
        {lift.summary}
      </p>
    </Shell>
  );
}
