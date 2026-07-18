/**
 * DriftWatchCard (S-17) — Loop-5 Positioning Statement-drift monitor.
 *
 * WHAT: The "is the brand drifting back open?" watch. Shows a calm all-clear when
 * zero assets have drifted from the current Positioning Statement, or names the drifted
 * assets (real `DriftItem[]` from Loop-3 `getDrift`) and offers a one-tap jump to
 * Fix to re-check them. Loading / error states are explicit.
 *
 * WHY: Defend is the spine's "hold the gains" leg — a Positioning Statement edit silently
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
import type { DefendAvatarStatus, DriftWatch } from '@/types/v4Defend';
import { DefendPerAvatarStrip } from './DefendPerAvatarStrip';

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
  /**
   * True when there is a real baseline to defend (>=1 aligned asset + a Positioning Statement).
   * When false the all-clear is suppressed for an honest neutral state. Defaults to
   * true so existing callers keep the all-clear behaviour.
   */
  hasBaseline?: boolean;
  /**
   * Per-customer drift posture when Defend considers a multi-avatar SET. The
   * headline above is the weakest-link rollup (drift = union across the set); this
   * strip shows the per-customer breakdown. Absent/single-element = no strip.
   */
  perAvatar?: DefendAvatarStatus[];
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-defend-drift-watch" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-idea-d" />
          Positioning drift watch
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
  hasBaseline = true,
  perAvatar = [],
}: DriftWatchCardProps): JSX.Element {
  const count = watch?.count ?? 0;
  useEffect(() => {
    if (isLoading || error || !watch) return;
    captureV4('v4_defend_drift_watch_viewed', {
      state: !hasBaseline ? 'none' : count === 0 ? 'clear' : 'drifted',
      count,
    });
  }, [isLoading, error, watch, count, hasBaseline]);

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

  // Nothing aligned to a Positioning Statement yet → an honest neutral state. Zero drift over
  // zero aligned assets is "nothing to defend yet", never a false all-clear.
  if (!hasBaseline) {
    return (
      <Shell>
        <div
          className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm"
          data-testid="v4-defend-drift-none"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Nothing to defend yet.</p>
            <p className="text-muted-foreground">
              Work a fix first — align an asset to your positioning — and I&apos;ll
              watch it for drift.
            </p>
          </div>
        </div>
        <DefendPerAvatarStrip perAvatar={perAvatar} />
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
              Every aligned asset still matches your current positioning. Nothing has
              drifted back open.
            </p>
          </div>
        </div>
        <DefendPerAvatarStrip perAvatar={perAvatar} />
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
          {count} {noun} drifted from your positioning
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
      <DefendPerAvatarStrip perAvatar={perAvatar} />
    </Shell>
  );
}
