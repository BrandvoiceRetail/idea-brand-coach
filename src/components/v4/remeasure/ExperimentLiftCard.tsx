/**
 * ExperimentLiftCard (S-16) — Loop-4 before/after on each EXPERIMENT.
 *
 * WHAT: Renders the user's experiments (`ExperimentLift[]` from
 * src/types/v4Remeasure.ts) as before → after → lift Δ rows, each with its
 * lifecycle stage (Idea / Asset created / Asset live / Measuring / Complete) and a
 * "Mark won / no-lift" action once a real after-number exists. Experiments with no
 * live asset / no post-live Windsor pull render an honest "pending — go live and
 * re-pull your Windsor metrics to measure lift" state. Loading / error / empty
 * states are explicit.
 *
 * WHY: This closes the experiment loop — the case-study unit ("the change won, by
 * this much"). Like the rest of /v4 nothing is fabricated: `after` is only the
 * recorded result or a real `campaign_metrics` pull windowed by the go-live date; a
 * pending experiment says so plainly rather than showing a made-up number, and the
 * verdict is the tester's call, never inferred. All copy is Tier-A public
 * vocabulary; v23 semantic tokens only (no hex); 0 horizontal overflow at 375px.
 */
import { useEffect } from 'react';
import { FlaskConical, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';
import type {
  ExperimentLift,
  ExperimentVerdict,
  TestLifecycleStage,
} from '@/types/v4Remeasure';
import type { MetricFormat } from '@/config/v4Funnel';

type V4ExperimentEvent = 'v4_experiment_lift_viewed' | 'v4_experiment_result_marked';

function captureV4(name: V4ExperimentEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

const STAGE_LABEL: Record<TestLifecycleStage, string> = {
  idea: 'Idea',
  asset_created: 'Asset created',
  asset_live: 'Asset live',
  measuring: 'Measuring',
  complete: 'Complete',
};

export interface ExperimentLiftCardProps {
  /** The experiments to render; null while loading or on error. */
  lifts?: ExperimentLift[] | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Record a won / no-lift verdict (writes brand_tests via the service seam). */
  onMark?: (testId: string, verdict: ExperimentVerdict, resultValue: number | null) => void;
}

/** Format one metric value for its unit; em-dash when absent (never fabricated). */
function fmt(value: number | null, format: MetricFormat): string {
  if (value == null) return '—';
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
  if (format === 'ratio') return `${value.toFixed(2)}x`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const deltaTone = (n: number): string =>
  n > 0 ? 'text-idea-e' : n < 0 ? 'text-destructive' : 'text-muted-foreground';

function LiftDelta({ exp }: { exp: ExperimentLift }): JSX.Element {
  if (exp.lift == null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = exp.lift > 0;
  const down = exp.lift < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`flex items-center gap-0.5 text-sm font-semibold ${deltaTone(exp.lift)}`}>
      <Icon className="h-4 w-4" />
      {fmt(exp.lift, exp.format)}
      {exp.liftPct != null && <span className="text-xs">({up ? '+' : ''}{exp.liftPct}%)</span>}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-experiment-lift" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-gold-warm" />
          Your experiments, before and after
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ExperimentRow({
  exp,
  onMark,
}: {
  exp: ExperimentLift;
  onMark?: ExperimentLiftCardProps['onMark'];
}): JSX.Element {
  const measured = exp.status === 'measured';
  const decided = exp.status === 'won' || exp.status === 'no_lift';

  // Fire the experiment-closure funnel event alongside the write — IDs/verdict only,
  // never user-facing copy (mirrors the page-level telemetry split).
  const mark = (verdict: ExperimentVerdict): void => {
    captureV4('v4_experiment_result_marked', { testId: exp.testId, verdict });
    onMark?.(exp.testId, verdict, exp.after);
  };

  return (
    <li
      data-testid={`v4-experiment-row-${exp.testId}`}
      className="space-y-2 rounded-md border border-border bg-background p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="min-w-0 break-words font-medium text-foreground">{exp.pieceLabel}</span>
        <Badge variant="secondary" className="bg-muted text-muted-foreground">
          {STAGE_LABEL[exp.stage]}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{exp.metricLabel}</span>
        <span className="tabular-nums">{fmt(exp.before, exp.format)}</span>
        <span>→</span>
        <span className="font-semibold tabular-nums text-foreground">{fmt(exp.after, exp.format)}</span>
        <LiftDelta exp={exp} />
      </div>

      {/* Pending: no live asset / no post-live pull → honest, never a made-up number. */}
      {exp.status === 'pending' && (
        <p
          className="rounded-md border border-gold-light bg-gold-light/30 p-2 text-xs text-muted-foreground"
          data-testid={`v4-experiment-pending-${exp.testId}`}
        >
          Pending — go live and re-pull your Windsor metrics to measure lift.
        </p>
      )}

      {/* Decided: show the recorded verdict. */}
      {decided && (
        <Badge
          variant={exp.status === 'won' ? 'default' : 'secondary'}
          className={exp.status === 'won' ? 'bg-idea-e text-white' : 'bg-muted'}
          data-testid={`v4-experiment-verdict-${exp.testId}`}
        >
          {exp.status === 'won' ? 'Won' : 'No lift'}
        </Badge>
      )}

      {/* Measured but unjudged → the tester's call. */}
      {measured && onMark && (
        <div className="flex flex-wrap gap-2 pt-1" data-testid={`v4-experiment-actions-${exp.testId}`}>
          <Button type="button" variant="brand" size="sm" onClick={() => mark('won')}>
            Mark won
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => mark('no_lift')}>
            No lift
          </Button>
        </div>
      )}
    </li>
  );
}

export function ExperimentLiftCard({
  lifts = null,
  isLoading = false,
  error = null,
  onRetry,
  onMark,
}: ExperimentLiftCardProps): JSX.Element {
  useEffect(() => {
    if (isLoading || error) return;
    captureV4('v4_experiment_lift_viewed', {
      count: lifts?.length ?? 0,
      measured: lifts?.filter((l) => l.status === 'measured').length ?? 0,
      decided: lifts?.filter((l) => l.status === 'won' || l.status === 'no_lift').length ?? 0,
    });
  }, [isLoading, error, lifts]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-2" data-testid="v4-experiment-loading">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Shell>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Shell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-experiment-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t read your experiments.
          </p>
          <p className="text-muted-foreground">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Empty (no experiments opened yet) ─────────────────────────────────────────
  if (!lifts || lifts.length === 0) {
    return (
      <Shell>
        <div
          className="space-y-2 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-experiment-empty"
        >
          <p className="font-medium text-foreground">No experiments yet.</p>
          <p className="text-muted-foreground">
            Open a test from a funnel piece in Fix, push the asset live, then come back
            here to measure the lift. I never invent a before/after.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Data ──────────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <ul className="space-y-2" data-testid="v4-experiment-list">
        {lifts.map((exp) => (
          <ExperimentRow key={exp.testId} exp={exp} onMark={onMark} />
        ))}
      </ul>
    </Shell>
  );
}
