/**
 * DriftWatchCard (S-17) — Loop-5 Signature-drift monitor.
 *
 * WHAT: The "is the brand drifting back open?" watch. Shows a calm all-clear when
 * zero assets have drifted from the current Signature, or names the drifted
 * assets (real `DriftItem[]` from Loop-3 `getDrift`) and offers a one-tap jump to
 * Fix to re-check them. Loading / error states are explicit.
 *
 * WHY: Defend is the spine's "hold the gains" leg — a Signature edit silently
 * invalidates prior audits, so the brand can quietly drift back to where it
 * started. This card surfaces ONLY real drift the service computed — it never
 * fabricates a count, and shows an honest all-clear at zero drift (it does NOT
 * self-hide here, unlike the Fix DriftBanner: on Defend the all-clear IS the
 * reassurance the user came to see).
 *
 * Tier-A vocabulary only; v23 semantic tokens (no hex); 0 horizontal overflow at
 * 375px; tap targets ≥40px.
 */
import { useEffect } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { DriftWatch } from '@/types/v4Defend';

type V4DriftWatchEvent = 'v4_defend_drift_watch_viewed';

function captureV4(name: V4DriftWatchEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export interface DriftWatchCardProps {
  /** The real drift watch; null while loading or on error. */
  watch?: DriftWatch | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Jump to Fix to re-check the drifted assets. */
  onRecheck?: () => void;
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-defend-drift-watch" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-idea-d" />
          Signature drift watch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function DriftWatchCard({
  watch = null,
  isLoading = false,
  error = null,
  onRetry,
  onRecheck,
}: DriftWatchCardProps): JSX.Element {
  const count = watch?.count ?? 0;
  useEffect(() => {
    if (isLoading || error || !watch) return;
    captureV4('v4_defend_drift_watch_viewed', {
      state: count === 0 ? 'clear' : 'drifted',
      count,
    });
  }, [isLoading, error, watch, count]);

  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-2" data-testid="v4-defend-drift-loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-defend-drift-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t check your assets for drift.
          </p>
          <p className="text-muted-foreground">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" className="min-h-[40px]" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  // All-clear — the reassurance the Defend user came to see.
  if (count === 0) {
    return (
      <Shell>
        <div
          className="flex items-start gap-3 rounded-md border border-idea-d/30 bg-idea-d/5 p-4 text-sm"
          data-testid="v4-defend-drift-clear"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-idea-d" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Holding steady.</p>
            <p className="text-muted-foreground">
              Every aligned asset still matches your current Signature. Nothing has
              drifted back open.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const noun = count === 1 ? 'asset' : 'assets';
  return (
    <Shell>
      <div
        className="space-y-3 rounded-md border border-gold-warm/40 bg-gold-warm/10 p-4 text-sm"
        data-testid="v4-defend-drift-list"
      >
        <p className="flex items-center gap-2 font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-gold-warm" aria-hidden="true" />
          {count} {noun} drifted from your Signature
        </p>
        <ul className="space-y-1.5">
          {(watch?.items ?? []).map((item) => (
            <li
              key={item.assetId}
              data-testid={`v4-defend-drift-item-${item.assetId}`}
              className="flex items-center justify-between gap-2 border-t border-border/60 pt-1.5 first:border-t-0 first:pt-0"
            >
              <span className="min-w-0 break-words font-medium text-foreground">
                {item.touchpointLabel}
              </span>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">{item.stage}</span>
            </li>
          ))}
        </ul>
        {onRecheck && (
          <Button
            type="button"
            className="min-h-[40px] w-full sm:w-auto"
            onClick={onRecheck}
            data-testid="v4-defend-drift-recheck"
          >
            Re-check {count} {noun} in Fix
          </Button>
        )}
      </div>
    </Shell>
  );
}
