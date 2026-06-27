/**
 * FixTestPanel (S-16) — Loop-3 "fix the leak, then test it" surface.
 *
 * WHAT: Screen ② of the funnel flow. Names THE LEAK (a piece's job metric vs its
 * target + the message-continuity break carried over from the step before), takes
 * the user's fix hypothesis (what they'll change + the metric it moves + today's
 * baseline), generates an on-brand rewrite (variant B) to A/B against the current
 * copy (variant A), and opens the test — which writes to `brand_tests` so the fix
 * shows up in Testing & Lift and feeds Re-measure. The coach is one click away to
 * refine.
 *
 * WHY: This is where Diagnose→Analyse→Fix becomes an actual experiment. Mirroring
 * the rest of Loop-3, NOTHING is fabricated: the leak renders an honest "—" when a
 * reading is absent, the rewrite has explicit loading/error/empty states (never a
 * made-up variant), and every product CLAIM on the rewrite stays amber ("not
 * shipped as fact") until the user confirms real evidence — the same claim-gate
 * firewall as MoveBriefClaimGate.
 *
 * Presentational only: the parent (V4Fix) owns the hypothesis/metric/baseline
 * state, the rewrite engine call, the claim-confirm state, and the openTest seam
 * (→ brand_tests). Types come from src/types/v4Fix.ts + src/config/v4Funnel.ts.
 */
import { useEffect } from 'react';
import {
  AlertCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { METRIC_META, type MetricKey } from '@/config/v4Funnel';
import type { FixLeak } from '@/types/v4Fix';
import type { ClaimGateItem } from '@/types/v4Analyse';
import { FIX_TEST_EVENTS, type FixTestEvent } from './fixTestEvents';

function emit(name: FixTestEvent, props?: Record<string, string | number | boolean | null>): void {
  captureAlphaEvent(name, props);
}

/** The metrics offered in the "metric it moves" picker when none is supplied. */
const DEFAULT_METRIC_OPTIONS: readonly MetricKey[] = ['cvr', 'ctr', 'aov'];

/**
 * Render a metric value in its natural unit (rates are stored as fractions). Returns
 * an honest "—" for a null reading — never a fabricated number.
 */
function formatMetricValue(key: MetricKey, value: number | null): string {
  if (value === null) return '—';
  switch (METRIC_META[key].format) {
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'currency':
      return `$${value.toFixed(2)}`;
    case 'ratio':
      return `${value.toFixed(2)}×`;
    default:
      return value.toLocaleString();
  }
}

export interface FixTestPanelProps {
  /** Everyday label of the piece under fix (e.g. "Amazon Listing — TLB216"). */
  pieceLabel: string;
  /** Journey-stage pill label (e.g. "Consideration → Purchase"). */
  stageLabel: string;
  /** The leak this fix targets — metric vs target + the continuity break. */
  leak: FixLeak;

  // ── Hypothesis (controlled by the parent) ─────────────────────────────────────
  /** The fix hypothesis text ("what will you change & why?"). */
  hypothesis: string;
  onHypothesisChange: (value: string) => void;
  /** The metric the fix moves. */
  metric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
  /** Metrics offered in the picker; defaults to CVR/CTR/AOV. */
  metricOptions?: readonly MetricKey[];
  /** Today's baseline, kept as a display string (e.g. "10.7%"). */
  baseline: string;
  onBaselineChange: (value: string) => void;

  // ── A/B variants ──────────────────────────────────────────────────────────────
  /** Variant A — the current/baseline copy. */
  currentCopy: string;
  /** Variant B — the on-brand rewrite; null until generated (honest empty). */
  rewrite: string | null;
  /** Product claims asserted by the rewrite, claim-gated (amber until confirmed). */
  rewriteClaims?: ClaimGateItem[];
  /** True while the rewrite engine is in flight. */
  rewriteLoading?: boolean;
  /** Hard error from the rewrite engine (null = none). */
  rewriteError?: string | null;
  /** Generate (or retry) the on-brand rewrite → returns variant B. */
  onGenerateRewrite: () => void;
  /** Promote a single claim on the rewrite to confirmed (has real evidence). */
  onConfirmClaim?: (claim: ClaimGateItem, index: number) => void;

  // ── Actions ───────────────────────────────────────────────────────────────────
  /** Open the A/B test → writes brand_tests (hypothesis · metric · baseline · running). */
  onOpenTest: () => void;
  /** True while the test is being opened. */
  openTestLoading?: boolean;
  /** Hard error opening the test (null = none). */
  openTestError?: string | null;
  /** Open the coach to refine the fix. */
  onOpenCoach: () => void;
}

export function FixTestPanel({
  pieceLabel,
  stageLabel,
  leak,
  hypothesis,
  onHypothesisChange,
  metric,
  onMetricChange,
  metricOptions = DEFAULT_METRIC_OPTIONS,
  baseline,
  onBaselineChange,
  currentCopy,
  rewrite,
  rewriteClaims = [],
  rewriteLoading = false,
  rewriteError = null,
  onGenerateRewrite,
  onConfirmClaim,
  onOpenTest,
  openTestLoading = false,
  openTestError = null,
  onOpenCoach,
}: FixTestPanelProps): JSX.Element {
  const unconfirmedCount = rewriteClaims.filter((c) => c.status === 'unconfirmed').length;
  // A test needs a hypothesis and a variant to test against the current copy.
  const canOpenTest = hypothesis.trim().length > 0 && rewrite !== null && !openTestLoading;

  useEffect(() => {
    emit(FIX_TEST_EVENTS.VIEWED, { metric, has_target: leak.target !== null });
    // Fire once per piece view — metric/target mutations don't re-announce it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGenerate(): void {
    emit(FIX_TEST_EVENTS.REWRITE_REQUESTED, { metric });
    onGenerateRewrite();
  }

  function handleConfirm(claim: ClaimGateItem, index: number): void {
    emit(FIX_TEST_EVENTS.CLAIM_CONFIRMED, { slot: claim.slot ?? null });
    onConfirmClaim?.(claim, index);
  }

  function handleOpenTest(): void {
    emit(FIX_TEST_EVENTS.TEST_OPENED, { metric, unconfirmed_count: unconfirmedCount });
    onOpenTest();
  }

  function handleOpenCoach(): void {
    emit(FIX_TEST_EVENTS.COACH_OPENED, { metric });
    onOpenCoach();
  }

  return (
    <div className="space-y-4" data-testid="v4-fix-test-panel">
      {/* ── Header + stage pill ── */}
      <header className="space-y-2">
        <Badge
          variant="outline"
          className="border-gold-warm bg-gold-light/40 text-[0.65rem] uppercase tracking-wide text-foreground"
        >
          {stageLabel}
        </Badge>
        <h2 className="break-words text-lg font-semibold text-foreground">
          Fix &amp; test — {pieceLabel}
        </h2>
      </header>

      {/* ── THE LEAK bar ── */}
      <div
        className="flex flex-col gap-2 rounded-lg bg-foreground p-4 text-background sm:flex-row sm:items-center"
        data-testid="v4-fix-leak"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold-warm">
          <TriangleAlert className="h-4 w-4" />
          The leak
        </span>
        <p className="break-words text-sm">
          {METRIC_META[leak.metric].label}{' '}
          <span className="font-semibold tabular-nums" data-testid="v4-fix-leak-current">
            {formatMetricValue(leak.metric, leak.current)}
          </span>{' '}
          vs{' '}
          <span className="font-semibold tabular-nums" data-testid="v4-fix-leak-target">
            {formatMetricValue(leak.metric, leak.target)}
          </span>{' '}
          target
          {leak.continuityBreak ? (
            <span data-testid="v4-fix-leak-continuity"> · {leak.continuityBreak}</span>
          ) : null}
        </p>
      </div>

      {/* ── The fix (hypothesis) ── */}
      <Card data-testid="v4-fix-hypothesis">
        <CardContent className="space-y-4 p-4">
          <h3 className="text-sm font-semibold text-foreground">The fix (hypothesis)</h3>

          <div className="space-y-1.5">
            <Label htmlFor="v4-fix-hypothesis-input" className="text-xs text-muted-foreground">
              What will you change &amp; why?
            </Label>
            <Textarea
              id="v4-fix-hypothesis-input"
              value={hypothesis}
              onChange={(e) => onHypothesisChange(e.target.value)}
              placeholder="Rewrite the title to deliver the promise the ad made. Expect more visitors to convert."
              className="min-h-24"
              data-testid="v4-fix-hypothesis-textarea"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v4-fix-metric" className="text-xs text-muted-foreground">
                Metric it moves
              </Label>
              <Select
                value={metric}
                onValueChange={(value) => {
                  const next = metricOptions.find((m) => m === value);
                  if (next) onMetricChange(next);
                }}
              >
                <SelectTrigger
                  id="v4-fix-metric"
                  className="min-h-10"
                  data-testid="v4-fix-metric-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METRIC_META[m].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="v4-fix-baseline" className="text-xs text-muted-foreground">
                Baseline (today)
              </Label>
              <Input
                id="v4-fix-baseline"
                value={baseline}
                onChange={(e) => onBaselineChange(e.target.value)}
                placeholder="—"
                className="min-h-10"
                data-testid="v4-fix-baseline-input"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="brand"
            onClick={handleGenerate}
            disabled={rewriteLoading}
            className="min-h-10 w-full gap-2 sm:w-auto"
            data-testid="v4-fix-generate-rewrite"
          >
            {rewriteLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {rewriteLoading ? 'Writing on-brand rewrite…' : 'Generate on-brand rewrite'}
          </Button>
        </CardContent>
      </Card>

      {/* ── A / B variant to test ── */}
      <Card data-testid="v4-fix-variants">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">A / B — variant to test</h3>
            <span className="text-[0.65rem] text-muted-foreground">
              grounded in Signature + avatar · claim-gated
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Variant A — current */}
            <div className="rounded-md border border-border p-3" data-testid="v4-fix-variant-a">
              <h4 className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                A — current (baseline)
              </h4>
              <p className="break-words text-sm text-foreground">{currentCopy}</p>
            </div>

            {/* Variant B — on-brand rewrite (loading / error / empty / value) */}
            <div
              className="rounded-md border border-gold-warm bg-gold-light/30 p-3"
              data-testid="v4-fix-variant-b"
            >
              <h4 className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-warm">
                B — on-brand rewrite
              </h4>
              {rewriteLoading ? (
                <p
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  data-testid="v4-fix-variant-b-loading"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Writing on-brand rewrite…
                </p>
              ) : rewriteError ? (
                <div className="space-y-1" data-testid="v4-fix-variant-b-error">
                  <p className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-words">
                      The coach hit a snag and nothing was made up. ({rewriteError})
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    className="min-h-10 gap-2"
                    data-testid="v4-fix-variant-b-retry"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </Button>
                </div>
              ) : rewrite ? (
                <p className="break-words text-sm text-foreground">{rewrite}</p>
              ) : (
                <p className="text-sm text-muted-foreground" data-testid="v4-fix-variant-b-empty">
                  Generate an on-brand rewrite above to test it against your current copy.
                </p>
              )}
            </div>
          </div>

          {/* Claim gate (the fabrication firewall) — only once a rewrite exists */}
          {rewrite && rewriteClaims.length > 0 && (
            <section className="space-y-2" data-testid="v4-fix-claim-gate">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-semibold text-foreground">Claim gate</h4>
                {unconfirmedCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-gold-warm bg-gold-light/40 text-foreground"
                    data-testid="v4-fix-claim-gate-summary"
                  >
                    {unconfirmedCount} not shipped as fact
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-idea-d text-idea-d"
                    data-testid="v4-fix-claim-gate-summary"
                  >
                    All claims confirmed
                  </Badge>
                )}
              </div>
              <ul className="space-y-2">
                {rewriteClaims.map((claim, index) => {
                  const confirmed = claim.status === 'confirmed';
                  return (
                    <li
                      key={`${claim.claim}-${index}`}
                      data-testid={`v4-fix-claim-${index}`}
                      data-status={claim.status}
                      className={`rounded-md border p-3 ${
                        confirmed
                          ? 'border-idea-d/40 bg-idea-d/5'
                          : 'border-gold-warm bg-gold-light/30'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          {confirmed ? (
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-idea-d" />
                          ) : (
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm" />
                          )}
                          <p className="break-words text-sm text-foreground">{claim.claim}</p>
                        </div>
                        {!confirmed && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirm(claim, index)}
                            className="min-h-10 shrink-0 gap-2"
                            data-testid={`v4-fix-claim-confirm-${index}`}
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
            </section>
          )}

          {/* Open-test error (honest, retryable) */}
          {openTestError && (
            <p
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              data-testid="v4-fix-open-test-error"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">
                Couldn&apos;t open the test — nothing was saved. ({openTestError})
              </span>
            </p>
          )}

          {/* Warning: unconfirmed claims travel flagged */}
          {rewrite && unconfirmedCount > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="v4-fix-claim-warning">
              {unconfirmedCount} claim{unconfirmedCount === 1 ? '' : 's'} will travel flagged as
              unconfirmed — not shipped as fact.
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="brand"
              onClick={handleOpenTest}
              disabled={!canOpenTest}
              className="min-h-10 gap-2"
              data-testid="v4-fix-open-test"
            >
              {openTestLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Open A/B test (sets baseline)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenCoach}
              className="min-h-10 gap-2"
              data-testid="v4-fix-open-coach"
            >
              <MessageSquare className="h-4 w-4" />
              Open the coach to refine
            </Button>
          </div>

          {!canOpenTest && !openTestLoading && (
            <p className="text-xs text-muted-foreground" data-testid="v4-fix-open-test-hint">
              Add a hypothesis and generate a rewrite to open a test.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
