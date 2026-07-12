/**
 * MoveBriefClaimGate (S-11) — Loop-2 closer.
 *
 * WHAT: Expands the chosen positioning move into a 7-slot design brief (title
 * formula, 5 bullets, 7 image slots, PPC tiers) and renders the CLAIM GATE:
 * every product claim is shown amber ("not shipped as fact") until the user
 * confirms it has real evidence behind it; confirmed claims turn green. The user
 * can export the brief at any point — unconfirmed claims travel flagged, never
 * asserted as fact.
 *
 * WHY: This is the fabrication firewall at the point of execution. The coach may
 * craft distinctive EXPRESSION, but a product CLAIM (what the product does/has)
 * must be grounded. Mirroring Loop-1's honest degradation, this surface never
 * fabricates a brief or silently promotes a claim — null brief → honest empty
 * state, error → ret ryable banner, unconfirmed claims stay visibly amber.
 *
 * Presentational only — the parent owns the brief data, the claim state, and the
 * confirm/export wiring. Types come from src/types/v4Analyse.ts (single contract).
 */
import { useEffect } from 'react';
import {
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { AlphaEventProps } from '@/lib/posthogClient';
import type { BriefSlots, ClaimGateItem } from '@/types/v4Analyse';
import { MOVE_BRIEF_EVENTS, type MoveBriefEvent } from './moveBriefEvents';

/**
 * Fire a v4 brief funnel event through the canonical FE analytics client (safe
 * no-op when PostHog is unconfigured). The cast threads a v4-namespaced name
 * through the shared union without editing the shared client — same pattern as
 * the adjacent DecisionBoard.
 */
function emit(name: MoveBriefEvent, props?: AlphaEventProps): void {
  captureAlphaEvent(name, props);
}

export interface MoveBriefClaimGateProps {
  /** The expanded 7-slot brief for the chosen move (null until expanded). */
  brief: BriefSlots | null;
  /**
   * The controlled claim list driving the gate. The parent owns each claim's
   * confirmed/unconfirmed state; typically `brief.claimGate`.
   */
  claims: ClaimGateItem[];
  /** Promote a single claim to confirmed (it has real evidence behind it). */
  onConfirmClaim: (claim: ClaimGateItem, index: number) => void;
  /** Export the brief (unconfirmed claims travel flagged, not as fact). */
  onExport: () => void;
  /** True while the brief is being generated. */
  isLoading?: boolean;
  /** Hard error from the brief engine (null = none). */
  error?: string | null;
  /** Retry the brief generation (rendered with the error banner when provided). */
  onRetry?: () => void;
}

export function MoveBriefClaimGate({
  brief,
  claims,
  onConfirmClaim,
  onExport,
  isLoading = false,
  error = null,
  onRetry,
}: MoveBriefClaimGateProps): JSX.Element {
  const unconfirmedCount = claims.filter((c) => c.status === 'unconfirmed').length;

  useEffect(() => {
    if (brief && !isLoading && !error) {
      emit(MOVE_BRIEF_EVENTS.VIEWED, {
        claim_count: claims.length,
        unconfirmed_count: unconfirmedCount,
      });
    }
    // Fire once the brief resolves; claim mutations don't re-announce a view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, isLoading, error]);

  const handleConfirm = (claim: ClaimGateItem, index: number): void => {
    emit(MOVE_BRIEF_EVENTS.CLAIM_CONFIRMED, { slot: claim.slot ?? null });
    onConfirmClaim(claim, index);
  };

  const handleExport = (): void => {
    emit(MOVE_BRIEF_EVENTS.EXPORTED, {
      claim_count: claims.length,
      unconfirmed_count: unconfirmedCount,
    });
    onExport();
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card data-testid="v4-move-brief-claim-gate">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-gold-warm" />
          Writing your design brief…
        </CardContent>
      </Card>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card data-testid="v4-move-brief-claim-gate">
        <CardContent className="space-y-3 p-6">
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            data-testid="v4-brief-error"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry} className="min-h-10 gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Empty (no brief yet) ─────────────────────────────────────────────────────
  if (!brief) {
    return (
      <Card data-testid="v4-move-brief-claim-gate">
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <FileCheck className="h-5 w-5 text-gold-warm" />
          <p className="break-words" data-testid="v4-brief-empty">
            Choose a move on the Decision Board to expand it into a design brief.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Brief + claim gate ───────────────────────────────────────────────────────
  return (
    <Card data-testid="v4-move-brief-claim-gate">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCheck className="h-5 w-5 text-gold-warm" />
          Your design brief
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Hand this to a freelancer or run it yourself. Every product claim stays flagged until you
          confirm there&apos;s real evidence behind it.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Claim gate (the firewall — surfaced first) ── */}
        <section className="space-y-3" data-testid="v4-claim-gate">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Claim gate</h3>
            {unconfirmedCount > 0 ? (
              <Badge
                variant="outline"
                className="border-gold-warm bg-gold-light/40 text-foreground"
                data-testid="v4-claim-gate-summary"
              >
                {unconfirmedCount} not shipped as fact
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-idea-d text-idea-d"
                data-testid="v4-claim-gate-summary"
              >
                All claims confirmed
              </Badge>
            )}
          </div>

          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="v4-claim-gate-none">
              No product claims in this brief.
            </p>
          ) : (
            <ul className="space-y-2">
              {claims.map((claim, index) => {
                const confirmed = claim.status === 'confirmed';
                return (
                  <li
                    key={`${claim.claim}-${index}`}
                    data-testid={`v4-claim-${index}`}
                    data-status={claim.status}
                    className={`rounded-md border p-3 ${
                      confirmed
                        ? 'border-idea-d/40 bg-idea-d/5'
                        : 'border-gold-warm bg-gold-light/30'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-start gap-2">
                          {confirmed ? (
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-idea-d" />
                          ) : (
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm" />
                          )}
                          <p className="break-words text-sm text-foreground">{claim.claim}</p>
                        </div>
                        <p
                          className="pl-6 text-xs text-muted-foreground"
                          data-testid={`v4-claim-status-${index}`}
                        >
                          {confirmed
                            ? 'Confirmed — cleared to ship as fact.'
                            : claim.reason
                              ? `Not shipped as fact — ${claim.reason}`
                              : 'Not shipped as fact until you confirm the evidence.'}
                        </p>
                      </div>
                      {!confirmed && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleConfirm(claim, index)}
                          className="min-h-10 shrink-0 gap-2"
                          data-testid={`v4-claim-confirm-${index}`}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          I can prove this
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Separator />

        {/* ── Title formula ── */}
        <section className="space-y-1" data-testid="v4-brief-title">
          <h3 className="text-sm font-semibold text-foreground">Title formula</h3>
          <p className="break-words text-sm text-muted-foreground">{brief.titleFormula.brief}</p>
          <p className="break-words text-sm text-foreground">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">e.g. </span>
            {brief.titleFormula.exampleOutput}
          </p>
        </section>

        {/* ── Bullets ── */}
        <section className="space-y-2" data-testid="v4-brief-bullets">
          <h3 className="text-sm font-semibold text-foreground">Listing bullets</h3>
          <ul className="space-y-2">
            {brief.bullets.map((bullet, index) => (
              <li key={`${bullet.element}-${index}`} className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gold-warm">
                  {bullet.element}
                </p>
                <p className="break-words text-sm text-muted-foreground">{bullet.brief}</p>
                <p className="break-words text-sm text-foreground">{bullet.exampleOutput}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 7-slot image brief ── */}
        <section className="space-y-2" data-testid="v4-brief-image-slots">
          <h3 className="text-sm font-semibold text-foreground">Image brief (7 slots)</h3>
          <ol className="space-y-2">
            {brief.imageBrief.map((slot, index) => (
              <li
                key={`${slot.slot}-${index}`}
                className="rounded-md border border-border p-3"
                data-testid={`v4-brief-slot-${index}`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gold-warm">
                  {slot.slot}
                </p>
                <p className="break-words text-sm text-foreground">{slot.intent}</p>
                <p className="break-words text-xs text-muted-foreground">{slot.brief}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── PPC keyword tiers ── */}
        <section className="space-y-2" data-testid="v4-brief-ppc">
          <h3 className="text-sm font-semibold text-foreground">PPC keywords</h3>
          {(['tierA', 'tierB', 'tierC'] as const).map((tier) => (
            <div key={tier} className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tier.replace('tier', 'Tier ')}
              </span>
              {brief.ppcKeywords[tier].length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                brief.ppcKeywords[tier].map((kw, i) => (
                  <Badge key={`${kw}-${i}`} variant="secondary" className="max-w-full break-words">
                    {kw}
                  </Badge>
                ))
              )}
            </div>
          ))}
        </section>

        <Separator />

        {/* ── Export CTA (the spine-advancing primary action) ── */}
        <div className="space-y-2">
          {unconfirmedCount > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="v4-export-warning">
              {unconfirmedCount} claim{unconfirmedCount === 1 ? '' : 's'} will export flagged as
              unconfirmed — not shipped as fact.
            </p>
          )}
          <Button
            type="button"
            variant="brand"
            onClick={handleExport}
            className="min-h-10 w-full gap-2 sm:w-auto"
            data-testid="v4-brief-export"
          >
            <Download className="h-4 w-4" />
            Export brief
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
