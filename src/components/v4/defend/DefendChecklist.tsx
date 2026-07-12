/**
 * DefendChecklist (S-17) — Loop-5 "hold the gains" checklist.
 *
 * WHAT: Renders the deterministic defend checklist (`DefendChecklistItem[]` built
 * by `defendService.buildChecklist`) as a status list — each row shows a real
 * derived state (done / needs attention / pending / coming) with a plain-language
 * detail. Loading / error states are explicit.
 *
 * WHY: Defend needs a single glanceable "are my gains safe?" surface. Every state
 * is computed from real loop signals (drift count, whether the lift was confirmed
 * on a real re-run); the competitor row is honestly `coming`. No state is
 * fabricated — a `pending` row says "not established yet", never a false green.
 *
 * Tier-A vocabulary only; v23 semantic tokens (no hex); 0 horizontal overflow at
 * 375px.
 */
import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Circle, Clock, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type {
  ChecklistState,
  DefendAvatarStatus,
  DefendChecklistItem,
} from '@/types/v4Defend';
import { DefendPerAvatarStrip } from './DefendPerAvatarStrip';

type V4ChecklistEvent = 'v4_defend_checklist_viewed';

function captureV4(name: V4ChecklistEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

const STATE_META: Record<
  ChecklistState,
  { Icon: typeof CheckCircle2; tone: string; label: string }
> = {
  done: { Icon: CheckCircle2, tone: 'text-idea-e', label: 'Done' },
  attention: { Icon: AlertTriangle, tone: 'text-gold-warm', label: 'Needs attention' },
  pending: { Icon: Circle, tone: 'text-muted-foreground', label: 'Pending' },
  coming: { Icon: Clock, tone: 'text-idea-d', label: 'Coming' },
};

export interface DefendChecklistProps {
  items?: DefendChecklistItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /**
   * Per-customer Defend posture when the checklist covers a multi-avatar SET. The
   * checklist rows above are the rolled-up view; this strip shows where each
   * customer stands. Absent/single-element = no strip.
   */
  perAvatar?: DefendAvatarStatus[];
}

function Shell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-defend-checklist" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-idea-d" />
          Defend checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function DefendChecklist({
  items = [],
  isLoading = false,
  error = null,
  onRetry,
  perAvatar = [],
}: DefendChecklistProps): JSX.Element {
  useEffect(() => {
    if (isLoading || error || items.length === 0) return;
    captureV4('v4_defend_checklist_viewed', {
      done: items.filter((i) => i.state === 'done').length,
      attention: items.filter((i) => i.state === 'attention').length,
    });
  }, [isLoading, error, items]);

  if (isLoading) {
    return (
      <Shell>
        <div className="space-y-2" data-testid="v4-defend-checklist-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-defend-checklist-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            We couldn&apos;t build your defend checklist.
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

  // Honest empty state — never render a bare card with an empty list.
  if (items.length === 0) {
    return (
      <Shell>
        <p
          className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
          data-testid="v4-defend-checklist-empty"
        >
          No checklist items yet — re-measure your lift and I&apos;ll build your
          defend checklist from what actually changed.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="space-y-2">
        {items.map((item) => {
          const meta = STATE_META[item.state];
          const { Icon } = meta;
          return (
            <li
              key={item.key}
              data-testid={`v4-defend-checklist-item-${item.key}`}
              data-state={item.state}
              className="flex items-start gap-3 rounded-md border border-border p-3"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.tone}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="break-words font-medium text-foreground">{item.label}</p>
                <p className="break-words text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <DefendPerAvatarStrip perAvatar={perAvatar} caption="Where each avatar stands" />
    </Shell>
  );
}
