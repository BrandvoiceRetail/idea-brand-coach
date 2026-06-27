/**
 * AnalyseRun (S-07) — Loop-2 Analyse build-theatre.
 *
 * WHAT: A presentational, read-only live timeline of the deeper Analyse pass —
 * the coach running run_trust_gap → run_diagnostic_evidence → build_avatar_stage
 * step-by-step — reusing the Loop-1 read-it-back look (OnboardingReflectionRun)
 * and the SAME five-state discriminated step union (see src/types/v4Analyse.ts).
 *
 * WHY: Loop-2 is the spine's "make sense of it" leg. Showing each engine call as
 * it runs (with the everyday tool name + the "why") earns trust, and binding the
 * ONE grounded finding to a step ONLY when it returned `done` keeps the surface
 * honest — nothing here is fabricated.
 *
 * No-fabrication invariants (proven in __tests__):
 *  - a step with status !== 'done' renders NO finding (finding is null upstream);
 *  - findings are passed in from the run hook (the real result), never made here;
 *  - needs_input / failed steps surface the honest banner instead of a finding;
 *  - zero steps renders an honest idle/empty state, never a placeholder result.
 *
 * Presentational only — the parent/integrator owns the run wiring + onComplete.
 * State (isRunning / hasRun / findingCount) is DERIVED from `steps` so there is
 * one source of truth. Observability: PostHog funnel events fire on run start,
 * each step completion, and the terminal (completed / failed) transition.
 */
import { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle, AlertCircle, Microscope, Sparkles, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { captureAlphaEvent, type AlphaEventProps } from '@/lib/posthogClient';
import type { AnalyseRunStep, AnalyseStepStatus, NeedsInputItem } from '@/types/v4Analyse';

const STATUS_ICON: Record<AnalyseStepStatus, JSX.Element> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-gold-warm" />,
  done: <CheckCircle2 className="h-4 w-4 text-idea-d" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  needs_input: <AlertCircle className="h-4 w-4 text-gold-warm" />,
};

const TERMINAL: ReadonlySet<AnalyseStepStatus> = new Set<AnalyseStepStatus>(['done', 'failed', 'needs_input']);

/**
 * v4 Analyse funnel events. Kept as a local union (cast once at the seam) so this
 * story does not edit the shared posthogClient `AlphaEventName` registry — the
 * integrator/registry owner can promote these later. Properties stay PII-free
 * (counts / ids / booleans only), matching the client's content discipline.
 */
type AnalyseEventName =
  | 'v4_analyse_run_started'
  | 'v4_analyse_step_completed'
  | 'v4_analyse_run_completed'
  | 'v4_analyse_run_failed';

function emitAnalyse(name: AnalyseEventName, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export interface AnalyseRunProps {
  /** The live per-step timeline (status + grounded finding per step). */
  steps: AnalyseRunStep[];
  /** First needs_input demand surfaced by any step (null/absent = none). */
  needsInput?: NeedsInputItem[] | null;
  /** First hard error surfaced by any step (null/absent = none). */
  runError?: string | null;
  /** Retry the whole run after a top-level error (omit to hide the button). */
  onRetry?: () => void;
  /**
   * Fired ONCE when the run reaches a fully-terminal state, with the final
   * steps. The parent decides what to do next (reveal Avatar / advance spine).
   */
  onComplete?: (steps: AnalyseRunStep[]) => void;
}

export function AnalyseRun({
  steps,
  needsInput = null,
  runError = null,
  onRetry,
  onComplete,
}: AnalyseRunProps): JSX.Element {
  const started = steps.some((s) => s.status !== 'pending');
  const isRunning = steps.some((s) => s.status === 'running');
  const hasRun = steps.length > 0 && steps.every((s) => TERMINAL.has(s.status));
  const findingCount = steps.filter((s) => s.status === 'done' && s.finding).length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;

  // ── Observability: emit on meaningful transitions only (deduped via refs) ──
  const startedRef = useRef(false);
  const doneIdsRef = useRef<Set<string>>(new Set());
  const completedRef = useRef(false);

  useEffect(() => {
    if (started && !startedRef.current) {
      startedRef.current = true;
      emitAnalyse('v4_analyse_run_started', { step_count: steps.length });
    }
    for (const s of steps) {
      if (s.status === 'done' && !doneIdsRef.current.has(s.id)) {
        doneIdsRef.current.add(s.id);
        emitAnalyse('v4_analyse_step_completed', { step_id: s.id, has_finding: Boolean(s.finding) });
      }
    }
    if (hasRun && !completedRef.current) {
      completedRef.current = true;
      if (runError || failedCount > 0) {
        emitAnalyse('v4_analyse_run_failed', { finding_count: findingCount, failed_count: failedCount });
      } else {
        emitAnalyse('v4_analyse_run_completed', { finding_count: findingCount });
      }
      onComplete?.(steps);
    }
  }, [steps, started, hasRun, runError, failedCount, findingCount, onComplete]);

  // ── Honest empty / idle state: no steps to show yet ──
  if (steps.length === 0) {
    return (
      <Card data-testid="analyse-run">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Microscope className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground" data-testid="analyse-empty">
            No analyse run yet. Once we have your listing or reviews, the coach will work through it here —
            step by step, nothing invented.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="analyse-run">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Microscope className="h-5 w-5 text-idea-i" />
          Analysing what you gave me
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isRunning
            ? 'Working through it now — each finding is grounded in your evidence.'
            : 'Every finding below comes from your own listing and reviews — nothing invented.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasRun && findingCount > 0 && (
          <div
            className="flex items-start gap-3 rounded-lg border border-gold-light bg-gold-light/40 px-4 py-3"
            data-testid="analyse-recognition"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-warm" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Here's what the analysis found.</p>
              <p className="text-sm text-muted-foreground">
                {findingCount} grounded {findingCount === 1 ? 'finding' : 'findings'} from your evidence — read them below.
              </p>
            </div>
          </div>
        )}

        {/* The live timeline */}
        <ol className="space-y-3" data-testid="analyse-timeline">
          {steps.map((step) => (
            <li key={step.id} className="space-y-1" data-testid={`analyse-step-${step.id}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
                {STATUS_ICON[step.status]}
                <span className="min-w-0 break-words">{step.label}</span>
                <span className="text-xs font-normal text-muted-foreground">· {step.tool}</span>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">{step.rationale}</p>
              {step.status === 'done' && step.finding && (
                <p
                  className="pl-6 text-sm break-words text-foreground"
                  data-testid={`analyse-finding-${step.id}`}
                >
                  → {step.finding}
                </p>
              )}
            </li>
          ))}
        </ol>

        {/* Honest blockers — never a fabricated finding */}
        {needsInput && needsInput.length > 0 && (
          <div
            className="space-y-1 rounded-md border border-gold-light bg-gold-light/30 p-3 text-sm"
            data-testid="analyse-needs-input"
          >
            {needsInput.map((n) => (
              <p key={n.slot} className="break-words text-foreground">
                {n.question}
              </p>
            ))}
          </div>
        )}
        {runError && (
          <div
            className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm break-words text-destructive"
            data-testid="analyse-run-error"
          >
            <p>{runError}</p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isRunning}
                className="gap-2"
                data-testid="analyse-run-retry"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
