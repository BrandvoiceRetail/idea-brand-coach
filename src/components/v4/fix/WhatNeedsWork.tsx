/**
 * WhatNeedsWork (S-13) — Loop-3 impact-ranked to-do list across the funnel.
 *
 * WHAT: Renders `WorkItem[]` (from `src/types/v4Fix.ts`) ordered by the lift each
 * fix could unlock on the numbers. When REAL campaign metrics back a row it shows
 * the estimated lift ("metrics" basis); otherwise it ranks by status severity +
 * priority and shows NO lift number ("coverage" basis). Each row opens its Asset
 * detail via `onSelectAsset`. Loading / empty / error states are explicit.
 *
 * WHY: This is the Diagnose→Analyse→Fix spine's "work on this first" leg. Like the
 * rest of /v4, nothing is fabricated — a lift figure is shown ONLY when grounded
 * in real metrics; when there are none we say so plainly rather than inventing a
 * number. The new campaign/analytics tables are unapplied in prod, so the honest
 * no-data path (coverage-basis ranking, no lift column) is the default reality.
 * All copy is Trevor-voice public vocabulary; no Tier-C internals.
 */
import { useEffect, useMemo } from 'react';
import { ListChecks, AlertTriangle, ChevronRight, TrendingUp, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { STAGES } from '@/config/touchpointTaxonomy';
import type { StageId } from '@/config/touchpointTaxonomy';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { WorkItem, TouchpointStatus } from '@/types/v4Fix';

/**
 * Loop-3 funnel events for this screen. Cast to the shared union at the single
 * call sites below — keeps the canonical client untouched while still flowing
 * through the one PostHog seam (IDs/booleans/counts only, never user-facing copy).
 * Mirrors the sibling GapDecisionTriggerPanel (S-09) v4 telemetry pattern.
 */
type V4WorkEvent = 'v4_what_needs_work_viewed' | 'v4_funnel_asset_opened';

function captureV4(name: V4WorkEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

/**
 * Props degrade to an honest empty state when the Fix engines have produced no
 * ranked work yet. `workItems` is the ranked list; `onSelectAsset` opens a row's
 * Asset detail.
 */
export interface WhatNeedsWorkProps {
  /** Impact-ranked work items; null/empty → honest empty state. */
  workItems?: WorkItem[] | null;
  /** Open a row's Asset detail. Rows without an asset are not clickable. */
  onSelectAsset?: (assetId: string) => void;
  /** True while the audit/metrics engines are in flight. */
  isLoading?: boolean;
  /** Hard error message (e.g. couldn't reach the coach); null = none. */
  error?: string | null;
  /** Retry handler shown alongside the error state. */
  onRetry?: () => void;
}

/** Each user-facing status maps to a semantic token (no hardcoded hex). */
const STATUS_META: Record<TouchpointStatus, { label: string; tone: string }> = {
  aligned: { label: 'On brand', tone: 'bg-muted text-muted-foreground' },
  stale: { label: 'Going stale', tone: 'bg-gold-light text-foreground' },
  misaligned: { label: 'Needs attention', tone: 'bg-idea-d/15 text-idea-d' },
  missing: { label: 'Missing', tone: 'bg-destructive/10 text-destructive' },
};

const STAGE_LABEL: Record<StageId, string> = STAGES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s.label }),
  {} as Record<StageId, string>,
);

function ListShell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-what-needs-work" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-gold-warm" />
          What needs work
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function WhatNeedsWork({
  workItems = null,
  onSelectAsset,
  isLoading = false,
  error = null,
  onRetry,
}: WhatNeedsWorkProps): JSX.Element {
  // Defensive sort by rank so the list reads top-down regardless of input order.
  const items = useMemo(
    () => [...(workItems ?? [])].sort((a, b) => a.rank - b.rank),
    [workItems],
  );
  const hasMetrics = useMemo(() => items.some((i) => i.liftBasis === 'metrics'), [items]);

  // Observability: fire once per resolved view (not on loading/blank renders).
  useEffect(() => {
    if (isLoading || error) return;
    captureV4('v4_what_needs_work_viewed', {
      item_count: items.length,
      lift_basis: hasMetrics ? 'metrics' : 'coverage',
      state: items.length > 0 ? 'data' : 'empty',
    });
  }, [isLoading, error, items.length, hasMetrics]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ListShell>
        <div className="space-y-2" data-testid="v4-work-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </ListShell>
    );
  }

  // ── Error / backend unreachable ──────────────────────────────────────────────
  if (error) {
    return (
      <ListShell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-work-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t reach the coach to rank your work.
          </p>
          <p className="text-muted-foreground">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </ListShell>
    );
  }

  // ── Empty / no ranked work yet ───────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <ListShell>
        <div
          className="space-y-2 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-work-empty"
        >
          <p className="font-medium text-foreground">Nothing to rank yet.</p>
          <p className="text-muted-foreground">
            Map your funnel and add your live assets, and the coach will rank the
            touchpoints whose fix would move your numbers the most. We never invent
            a priority without something real behind it.
          </p>
        </div>
      </ListShell>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  return (
    <ListShell>
      {!hasMetrics && (
        <p
          className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
          data-testid="v4-work-no-metrics-note"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ranked by what&apos;s most off-brand right now. Connect your numbers and
          we&apos;ll rank by the real lift each fix could unlock.
        </p>
      )}

      <ul className="space-y-2" data-testid="v4-work-list">
        {items.map((item) => {
          const statusMeta = STATUS_META[item.status];
          const clickable = Boolean(item.assetId) && Boolean(onSelectAsset);
          const open = (): void => {
            if (!item.assetId || !onSelectAsset) return;
            captureV4('v4_funnel_asset_opened', {
              asset_id: item.assetId,
              touchpoint_id: item.touchpointId,
              rank: item.rank,
              status: item.status,
              has_lift: item.estimatedLift !== null,
            });
            onSelectAsset(item.assetId);
          };

          const Row = clickable ? 'button' : 'div';
          return (
            <li key={item.touchpointId}>
              <Row
                type={clickable ? 'button' : undefined}
                onClick={clickable ? open : undefined}
                disabled={clickable ? false : undefined}
                data-testid={`v4-work-row-${item.touchpointId}`}
                className={`flex w-full min-h-[40px] items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left ${
                  clickable ? 'transition-colors hover:bg-muted/60' : 'cursor-default'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-light text-xs font-bold text-foreground">
                  {item.rank}
                </span>

                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.p0 && (
                      <Badge variant="secondary" className="bg-gold-warm/15 text-gold-warm">
                        Priority
                      </Badge>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary" className={statusMeta.tone}>
                      {statusMeta.label}
                    </Badge>
                    <span className="break-words">{STAGE_LABEL[item.stage]}</span>
                  </span>
                  <span className="block break-words text-xs text-muted-foreground">
                    {item.reason}
                  </span>
                </span>

                {item.estimatedLift !== null && (
                  <span
                    className="flex shrink-0 items-center gap-1 text-right text-sm font-semibold text-idea-e"
                    data-testid={`v4-work-lift-${item.touchpointId}`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />+{item.estimatedLift}%
                  </span>
                )}

                {clickable && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </Row>
            </li>
          );
        })}
      </ul>
    </ListShell>
  );
}
