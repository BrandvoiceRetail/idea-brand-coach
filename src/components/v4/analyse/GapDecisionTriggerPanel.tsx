/**
 * GapDecisionTriggerPanel (S-09) — Loop-2 panel pairing the Trust Gap score with
 * the named Decision Trigger (the single lever most likely to move the buyer) and
 * the verbatim evidence behind the derivation.
 *
 * WHAT: Renders the grounded `TrustGapView` (overall + four pillar reads + the
 * weakest-pillar opportunity) alongside the derived `DecisionTriggerView` (named
 * trigger, brand anchor, supporting phrases, placement guidance, "why").
 *
 * WHY: This is the Diagnose→Analyse bridge — it turns a score into the ONE thing
 * to do next. Like Loop-1's read-it-back theatre, nothing here is fabricated:
 * every score comes from the engine and every value is null-guarded. When the
 * engines have not run (or returned nothing), the panel shows an honest
 * "not enough evidence yet" state — never a placeholder number or invented
 * trigger. All copy is Trevor-voice public vocabulary; no Tier-C internals.
 */
import { useEffect } from 'react';
import { Target, ShieldAlert, Quote, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type {
  GapAvatarSummary,
  TrustGapView,
  TrustPillar,
  DecisionTriggerView,
} from '@/types/v4Analyse';

/**
 * Loop-2 funnel event for this screen. Cast to the shared union at the single
 * call site below — keeps the canonical client untouched while still flowing
 * through the one PostHog seam (IDs/booleans only, never user-facing copy).
 * Mirrors the sibling AvatarProfile (S-08) v4 telemetry pattern.
 */
type V4GapTriggerEvent = 'v4_decision_trigger_viewed';

function captureV4(name: V4GapTriggerEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

/**
 * Props are all optional + null-defaulted so the panel degrades to an honest
 * empty state when the Analyse engines have not produced data yet (the new
 * campaign/analytics tables are unapplied in prod — direct reads return empty).
 */
export interface GapDecisionTriggerPanelProps {
  /** Grounded Trust Gap read; null until scored from real evidence. */
  trustGap?: TrustGapView | null;
  /** The single derived Decision Trigger; null until derived from evidence. */
  trigger?: DecisionTriggerView | null;
  /** True while the engines are in flight. */
  isLoading?: boolean;
  /** Hard error message (e.g. couldn't reach the coach); null = none. */
  error?: string | null;
  /** Retry handler shown alongside the error state. */
  onRetry?: () => void;
  /**
   * Per-customer gap/lever breakdown when Analyse considers a multi-avatar SET.
   * The `trustGap` / `trigger` above are the FOCUS customer's full read (the
   * headline); this strip shows each customer's own gap + lever side-by-side. The
   * gap is a number, so there is no honest aggregate — a customer not yet scored
   * reads "not scored yet" (null fields are never filled with an invented number).
   * Self-hides unless length > 1, so the single-avatar render is unchanged.
   */
  perAvatar?: GapAvatarSummary[];
}

/** Each IDEA pillar maps to its semantic token (no hardcoded hex). */
const PILLAR_META: Record<TrustPillar, { label: string; tone: string }> = {
  insight: { label: 'Insight-driven', tone: 'text-idea-i' },
  distinctive: { label: 'Distinctive', tone: 'text-idea-d' },
  empathetic: { label: 'Empathetic', tone: 'text-idea-e' },
  authentic: { label: 'Authentic', tone: 'text-idea-a' },
};

function PanelShell({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Card data-testid="v4-gap-decision-trigger" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-gold-warm" />
          Your gap + the lever that moves it
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function GapDecisionTriggerPanel({
  trustGap = null,
  trigger = null,
  isLoading = false,
  error = null,
  onRetry,
  perAvatar,
}: GapDecisionTriggerPanelProps): JSX.Element {
  const hasData = Boolean(trustGap) || Boolean(trigger);

  // Observability: fire once per resolved view (not on loading/blank renders).
  useEffect(() => {
    if (isLoading || error) return;
    captureV4('v4_decision_trigger_viewed', {
      has_trust_gap: Boolean(trustGap),
      has_trigger: Boolean(trigger),
      trust_gap_overall: trustGap?.overall ?? null,
      trigger_type: trigger?.type ?? null,
      state: hasData ? 'data' : 'empty',
    });
  }, [isLoading, error, trustGap, trigger, hasData]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PanelShell>
        <div className="space-y-3" data-testid="v4-gap-trigger-loading">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-20 w-full" />
        </div>
      </PanelShell>
    );
  }

  // ── Error / backend unreachable ──────────────────────────────────────────────
  if (error) {
    return (
      <PanelShell>
        <div
          className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
          data-testid="v4-gap-trigger-error"
        >
          <p className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" />
            We couldn&apos;t reach the coach to score this.
          </p>
          <p className="text-muted-foreground">{error}</p>
          {onRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </PanelShell>
    );
  }

  // ── Empty / not enough evidence ──────────────────────────────────────────────
  if (!hasData) {
    return (
      <PanelShell>
        <div
          className="space-y-2 rounded-md border border-gold-light bg-gold-light/30 p-4 text-sm"
          data-testid="v4-gap-trigger-empty"
        >
          <p className="font-medium text-foreground">Not enough evidence yet.</p>
          <p className="text-muted-foreground">
            Add your live listing or customer reviews and the coach will score your
            Trust Gap and name the one trigger most likely to move this buyer. We
            never guess a score from a description alone.
          </p>
        </div>
      </PanelShell>
    );
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  return (
    <PanelShell>
      {trustGap && (
        <section className="space-y-3" data-testid="v4-gap-trigger-trustgap">
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-foreground">{trustGap.overall}</span>
            <span className="pb-1 text-sm text-muted-foreground">/ 100 Trust Gap</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {trustGap.pillars.map((p) => {
              const meta = PILLAR_META[p.pillar];
              const isPrimary = p.pillar === trustGap.primaryGap;
              return (
                <div
                  key={p.pillar}
                  data-testid={`v4-gap-pillar-${p.pillar}`}
                  className={`rounded-md bg-muted/60 px-3 py-2 ${
                    isPrimary ? 'ring-1 ring-gold-warm' : ''
                  }`}
                >
                  <p className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wide ${meta.tone}`}>
                    <span>{meta.label}</span>
                    <span className="text-foreground">{p.score}/25</span>
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{p.interpretation}</p>
                </div>
              );
            })}
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-warm">
              Your biggest opportunity
            </p>
            <p className="mt-1 break-words text-sm text-foreground">{trustGap.primaryGapSummary}</p>
          </div>
        </section>
      )}

      {trustGap && trigger && <Separator />}

      {trigger && (
        <section className="space-y-3" data-testid="v4-gap-trigger-decision">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-gold-light text-foreground">
              Decision Trigger
            </Badge>
            <span className="text-lg font-semibold text-foreground">{trigger.type}</span>
          </div>
          <p className="break-words text-sm text-foreground">{trigger.brandAnchor}</p>

          {trigger.evidencePhrases.length > 0 && (
            <div className="space-y-1" data-testid="v4-gap-trigger-evidence">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Quote className="h-3 w-3" />
                The evidence behind it
              </p>
              <ul className="space-y-1">
                {trigger.evidencePhrases.map((phrase, i) => (
                  <li
                    key={`${i}-${phrase.slice(0, 12)}`}
                    className="break-words rounded-md border-l-2 border-gold-warm bg-muted/60 px-3 py-1.5 text-sm italic text-foreground"
                  >
                    &ldquo;{phrase}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="break-words text-sm text-muted-foreground">{trigger.whyThisTrigger}</p>

          <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-idea-d" />
            <p className="break-words text-sm text-foreground">{trigger.placementInstruction}</p>
          </div>
        </section>
      )}

      {/* Per-customer breakdown — only when Analyse considers a multi-avatar set.
          The read above is the FOCUS customer's (the headline); the gap is a number,
          so each customer's own gap + lever is shown side-by-side, never a fabricated
          cross-customer aggregate. A customer not yet scored reads "not scored yet". */}
      {perAvatar && perAvatar.length > 1 && (
        <>
          <Separator />
          <section
            className="rounded-md border border-border bg-muted/40 px-3 py-3"
            data-testid="v4-gap-per-avatar"
          >
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Each customer&apos;s gap + lever
            </p>
            <ul className="flex flex-wrap gap-2">
              {perAvatar.map((pa) => (
                <li
                  key={pa.avatarId}
                  data-testid={`v4-gap-per-avatar-${pa.avatarId}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium"
                >
                  <span className="max-w-[10rem] truncate text-foreground" title={pa.avatarName}>
                    {pa.avatarName}
                  </span>
                  <span aria-hidden className="opacity-50">
                    ·
                  </span>
                  {pa.overall != null ? (
                    <span className="font-semibold tabular-nums text-foreground">
                      {pa.overall}/100
                    </span>
                  ) : (
                    <span className="text-muted-foreground">not scored yet</span>
                  )}
                  {pa.primaryGap && (
                    <>
                      <span aria-hidden className="opacity-50">
                        ·
                      </span>
                      <span className={PILLAR_META[pa.primaryGap].tone}>
                        {PILLAR_META[pa.primaryGap].label}
                      </span>
                    </>
                  )}
                  {pa.triggerType && (
                    <>
                      <span aria-hidden className="opacity-50">
                        ·
                      </span>
                      <span className="text-idea-d">{pa.triggerType}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PanelShell>
  );
}
