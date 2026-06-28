/**
 * BusinessMetricsCard (S-16) — Loop-4 before/after on the numbers.
 *
 * WHAT: Renders the four headline business metrics (CTR / CVR / AOV / revenue) as
 * before→after pairs tied to the brand-change pivot (`BusinessMetricsView` from
 * src/types/v4Remeasure.ts). A cell shows a real figure ONLY when a real
 * `campaign_metrics` row backs it; otherwise it shows an em-dash and the panel
 * surfaces an honest "connect your numbers" no-data state. Loading / error states
 * are explicit.
 *
 * WHY: This is the money half of the Re-measure proof — did the brand fix move the
 * commercial numbers, not just the Trust Gap. The campaign/analytics migration is
 * unapplied in prod, so `hasData: false` (no rows) is the CURRENT reality and the
 * honest no-data state is what most users see — we never fabricate a lift to fill
 * the table. All copy is Tier-A public vocabulary; no Tier-C internals. v23
 * semantic tokens only (no hex); 0 horizontal overflow at 375px.
 */
import { useEffect } from 'react';
import { LineChart, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { BusinessMetricsView, MetricDelta } from '@/types/v4Remeasure';

type V4MetricsEvent = 'v4_business_metrics_viewed';

function captureV4(name: V4MetricsEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export interface BusinessMetricsCardProps {
  /** The before/after metrics view; null while loading or on error. */
  view?: BusinessMetricsView | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

/** Format one metric value for its unit; em-dash when absent (never fabricated). */
function fmt(value: number | null, unit: MetricDelta['unit']): string {
  if (value == null) return '—';
  if (unit === 'rate') return `${(value * 100).toFixed(1)}%`;
  // currency — locale-grouped, no forced currency symbol (varies by seller).
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function DeltaTag({ m }: { m: MetricDelta }): JSX.Element | null {
  if (m.pctChange == null) return null;
  const up = m.pctChange > 0;
  const down = m.pctChange < 0;
  const tone = up ? 'text-idea-e' : down ? 'text-destructive' : 'text-muted-foreground';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`flex items-center justify-end gap-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {m.pctChange}%
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-business-metrics" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChart className="h-4 w-4 text-gold-warm" />
          The numbers, before and after
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function BusinessMetricsCard({
  view = null,
  isLoading = false,
  error = null,
  onRetry,
}: BusinessMetricsCardProps): JSX.Element {
  useEffect(() => {
    if (isLoading || error) return;
    captureV4('v4_business_metrics_viewed', {
      state: view?.hasData ? 'data' : 'no_data',
      metric_count: view?.metrics.filter((m) => m.before != null || m.after != null).length ?? 0,
    });
  }, [isLoading, error, view]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-2" data-testid="v4-metrics-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
          data-testid="v4-metrics-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t read your campaign numbers.
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

  const metrics = view?.metrics ?? [];

  // No real rows → show ONLY the honest no-data banner. We never render a table of
  // em-dashes that could read like a (blank) result the user is meant to act on.
  if (!view?.hasData) {
    return (
      <Shell>
        <div
          className="space-y-2 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-metrics-no-data"
        >
          <p className="font-medium text-foreground">No numbers connected yet.</p>
          <p className="text-muted-foreground">
            Connect your store and ad analytics and I&apos;ll show CTR, conversion,
            order value and revenue move against the day your brand change went live.
            Until there&apos;s real data here, I won&apos;t show a number.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Data present: cells still read "—" for any metric with no backing row. */}
      <div className="overflow-hidden rounded-md border border-border" data-testid="v4-metrics-table">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-2 bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Metric</span>
          <span className="text-right">Before</span>
          <span className="text-right">After</span>
          <span className="text-right">Change</span>
        </div>
        <ul>
          {metrics.map((m) => (
            <li
              key={m.kind}
              data-testid={`v4-metric-row-${m.kind}`}
              className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-2 border-t border-border px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words font-medium text-foreground">{m.label}</span>
              <span className="text-right tabular-nums text-muted-foreground">
                {fmt(m.before, m.unit)}
              </span>
              <span className="text-right font-semibold tabular-nums text-foreground">
                {fmt(m.after, m.unit)}
              </span>
              <span className="text-right">
                <DeltaTag m={m} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
