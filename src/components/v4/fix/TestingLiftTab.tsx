/**
 * TestingLiftTab (Loop-3, screen ③) — every fix you put into a test and what it
 * moved.
 *
 * WHAT: Renders the `TestRow[]` the `listTests` seam returns as a scrollable table —
 * Test · Funnel piece · Metric · Baseline → Result · Lift Δ (▲/▼ coloured) · Status
 * · Type — with Status + Metric filter selects. Completed lift feeds the Re-measure
 * step (the funnel's real before/after). Loading / empty / error states are explicit.
 *
 * WHY: This is the "did the fix work" ledger of the Diagnose→Analyse→Fix→Re-measure
 * spine. Like the rest of /v4 NOTHING is fabricated: Lift Δ is derived from a row's
 * real baseline → result and is shown ONLY when both exist (a running test has no
 * result, so its Lift reads an honest "—"). The empty state points the user back to a
 * leaking piece to open a test rather than inventing rows. All copy is Trevor-voice
 * public vocabulary; no Tier-C internals.
 */
import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, AlertTriangle, ArrowUp, ArrowDown, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { METRIC_META } from '@/config/v4Funnel';
import type { MetricKey } from '@/config/v4Funnel';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { TestRow, TestRowStatus, TestLifecycleStage } from '@/types/v4Fix';

/** Status filter — the row statuses plus an "all" passthrough. */
type StatusFilter = 'all' | TestRowStatus;

/** Everyday label + tone for each experiment-lifecycle stage (Tier-A vocabulary). */
const LIFECYCLE_META: Record<TestLifecycleStage, { label: string; tone: string }> = {
  idea: { label: 'Idea', tone: 'bg-muted text-muted-foreground' },
  asset_created: { label: 'Asset created', tone: 'bg-gold-light text-foreground' },
  asset_live: { label: 'Asset live', tone: 'bg-gold-light text-foreground' },
  measuring: { label: 'Measuring', tone: 'bg-gold-light text-foreground' },
  complete: { label: 'Complete', tone: 'bg-idea-e/15 text-idea-e' },
};

/** Render an ISO date as a short, locale-stable day; null reads as an honest "—". */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/**
 * Props degrade to an honest empty state when no tests are open yet. `tests` is the
 * (possibly empty) list from `listTests`; the rest drive the explicit non-data states.
 */
export interface TestingLiftTabProps {
  /** Tests for the avatar; null/empty → honest empty state. */
  tests?: TestRow[] | null;
  /** True while the tests read is in flight. */
  isLoading?: boolean;
  /** Hard error message (e.g. couldn't reach the seam); null = none. */
  error?: string | null;
  /** Retry handler shown alongside the error state. */
  onRetry?: () => void;
  /** Optional export handler; the Export button hides when omitted. */
  onExport?: () => void;
  /** Stamp the ASSET_CREATED milestone for a test (advances `idea` → `asset_created`). */
  onMarkAssetCreated?: (testId: string) => void;
  /** Stamp the ASSET_LIVE milestone for a test (advances `asset_created` → `measuring`). */
  onMarkAssetLive?: (testId: string) => void;
  /** Test id with a milestone stamp in flight; disables its buttons. */
  advancingTestId?: string | null;
}

const STATUS_META: Record<TestRowStatus, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'bg-gold-light text-foreground' },
  completed: { label: 'Completed', tone: 'bg-idea-e/15 text-idea-e' },
};

/** Format a metric value in its natural unit; null reads as an honest "—". */
function formatValue(metric: MetricKey, value: number | null): string {
  if (value === null) return '—';
  const fmt = METRIC_META[metric].format;
  const n = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  switch (fmt) {
    case 'percent':
      // Percent-format metrics are stored as fractions 0–1 (e.g. cvr=0.05 → "5.0%").
      return `${(value * 100).toFixed(1)}%`;
    case 'currency':
      return `$${n}`;
    case 'ratio':
      return `${n}×`;
    default:
      return n;
  }
}

/** Relative lift baseline→result as a whole-percent delta; null when not computable. */
function liftPct(row: TestRow): number | null {
  if (row.baseline === null || row.result === null || row.baseline === 0) return null;
  return Math.round(((row.result - row.baseline) / row.baseline) * 100);
}

function TableShell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-testing-lift" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-4 w-4 text-gold-warm" />
          Testing &amp; Lift
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every fix you put into a test, and what it moved. Completed lift feeds Re-measure.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/**
 * The lifecycle cell: the stage badge, the two milestone dates, and (when a stamp
 * handler is provided and the stage allows it) the single action that advances the
 * experiment — "Mark asset created" while it's an idea, then "Mark asset live"
 * once the asset is built. After ASSET_LIVE the dates stand alone; nothing is ever
 * fabricated (an unstamped milestone reads an honest "—").
 */
function LifecycleCell({
  row,
  busy,
  onMarkAssetCreated,
  onMarkAssetLive,
}: {
  row: TestRow;
  busy: boolean;
  onMarkAssetCreated?: (testId: string) => void;
  onMarkAssetLive?: (testId: string) => void;
}): JSX.Element {
  const meta = LIFECYCLE_META[row.lifecycleStage];
  const advance =
    row.lifecycleStage === 'idea' && onMarkAssetCreated
      ? {
          label: 'Mark asset created',
          milestone: 'asset_created' as const,
          run: () => onMarkAssetCreated(row.id),
        }
      : row.lifecycleStage === 'asset_created' && onMarkAssetLive
        ? {
            label: 'Mark asset live',
            milestone: 'asset_live' as const,
            run: () => onMarkAssetLive(row.id),
          }
        : null;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge variant="secondary" className={meta.tone}>
        {meta.label}
      </Badge>
      <span className="text-xs text-muted-foreground">
        Created {formatDate(row.assetCreatedAt)} · Live {formatDate(row.assetLiveAt)}
      </span>
      {advance && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="min-h-8 gap-1"
          data-testid={`v4-testing-advance-${row.id}`}
          onClick={() => {
            captureAlphaEvent('v4_test_lifecycle_advanced', { milestone: advance.milestone });
            advance.run();
          }}
        >
          {busy ? 'Saving…' : advance.label}
        </Button>
      )}
    </div>
  );
}

export function TestingLiftTab({
  tests = null,
  isLoading = false,
  error = null,
  onRetry,
  onExport,
  onMarkAssetCreated,
  onMarkAssetLive,
  advancingTestId = null,
}: TestingLiftTabProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [metricFilter, setMetricFilter] = useState<MetricKey | 'all'>('all');

  const rows = useMemo(() => tests ?? [], [tests]);

  // Metric options are derived ONLY from metrics actually present — no empty filters.
  const metricOptions = useMemo(() => {
    const seen = new Set<MetricKey>();
    for (const r of rows) seen.add(r.metric);
    return Array.from(seen);
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (statusFilter === 'all' || r.status === statusFilter) &&
          (metricFilter === 'all' || r.metric === metricFilter),
      ),
    [rows, statusFilter, metricFilter],
  );

  // Observability: fire once per resolved view (not on loading/error renders).
  useEffect(() => {
    if (isLoading || error) return;
    captureAlphaEvent('v4_testing_lift_viewed', {
      test_count: rows.length,
      running_count: rows.filter((r) => r.status === 'running').length,
      state: rows.length > 0 ? 'data' : 'empty',
    });
  }, [isLoading, error, rows]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <TableShell>
        <div className="space-y-2" data-testid="v4-testing-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </TableShell>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <TableShell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-testing-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t load your tests.
          </p>
          <p className="text-muted-foreground">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </TableShell>
    );
  }

  // ── Empty / no tests yet ───────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <TableShell>
        <div
          className="space-y-2 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-testing-empty"
        >
          <p className="font-medium text-foreground">No tests yet.</p>
          <p className="text-muted-foreground">
            Open one from a leaking piece — every fix you put into a test shows up here
            with what it moved. We never show a lift number without a real result behind it.
          </p>
        </div>
      </TableShell>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  return (
    <TableShell>
      {/* Toolbar: Status + Metric filters (native selects = testable, mobile-safe). */}
      <div className="flex flex-wrap items-center gap-3" data-testid="v4-testing-toolbar">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Status
          <select
            value={statusFilter}
            data-testid="v4-testing-status-filter"
            onChange={(e) => {
              const next = e.target.value as StatusFilter;
              setStatusFilter(next);
              captureAlphaEvent('v4_testing_lift_filtered', { filter: 'status', value: next });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="all">All</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Metric
          <select
            value={metricFilter}
            data-testid="v4-testing-metric-filter"
            onChange={(e) => {
              const next = e.target.value as MetricKey | 'all';
              setMetricFilter(next);
              captureAlphaEvent('v4_testing_lift_filtered', { filter: 'metric', value: next });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            <option value="all">All</option>
            {metricOptions.map((m) => (
              <option key={m} value={m}>
                {METRIC_META[m].label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex-1" />
        {onExport && (
          <Button type="button" variant="ghost" size="sm" onClick={onExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        )}
      </div>

      {/* Horizontal scroll keeps the 7-column table 0-overflow at 375px. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm" data-testid="v4-testing-table">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Test</th>
              <th className="py-2 pr-3 font-medium">Funnel piece</th>
              <th className="py-2 pr-3 font-medium">Metric</th>
              <th className="py-2 pr-3 font-medium">Baseline → Result</th>
              <th className="py-2 pr-3 font-medium">Lift</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 font-medium">Lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr data-testid="v4-testing-no-match">
                <td colSpan={8} className="py-4 text-center text-xs text-muted-foreground">
                  No tests match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const lift = liftPct(row);
                const statusMeta = STATUS_META[row.status];
                return (
                  <tr
                    key={row.id}
                    data-testid={`v4-testing-row-${row.id}`}
                    className="border-b border-border/60 align-top"
                  >
                    <td className="py-2.5 pr-3 font-medium text-foreground">{row.name}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{row.pieceLabel}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {METRIC_META[row.metric].label}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {formatValue(row.metric, row.baseline)} →{' '}
                      {row.status === 'running' ? 'running' : formatValue(row.metric, row.result)}
                    </td>
                    <td className="py-2.5 pr-3" data-testid={`v4-testing-lift-${row.id}`}>
                      {lift === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : lift >= 0 ? (
                        <span className="flex items-center gap-0.5 font-semibold text-idea-e">
                          <ArrowUp className="h-3.5 w-3.5" />+{lift}%
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 font-semibold text-destructive">
                          <ArrowDown className="h-3.5 w-3.5" />
                          {lift}%
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="secondary" className={statusMeta.tone}>
                        {statusMeta.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge variant="secondary" className="bg-muted text-muted-foreground">
                        {row.kind === 'competitor' ? 'Competitor' : 'Standard'}
                      </Badge>
                    </td>
                    <td className="py-2.5" data-testid={`v4-testing-lifecycle-${row.id}`}>
                      <LifecycleCell
                        row={row}
                        busy={advancingTestId === row.id}
                        onMarkAssetCreated={onMarkAssetCreated}
                        onMarkAssetLive={onMarkAssetLive}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TableShell>
  );
}
