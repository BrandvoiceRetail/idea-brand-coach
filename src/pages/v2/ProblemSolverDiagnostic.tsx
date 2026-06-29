/**
 * ProblemSolverDiagnostic — the /v2/diagnostic 8-screen "fix the Trust Gap" flow.
 *
 * The React port of _bmad-output/mockups/idea-brandcoach-DEMO-v2-trevor-spec.html.
 * A thin wiring shell (per src/pages/AGENTS.md): it owns the screen state machine,
 * the shared flow state (self-report scores, ASIN, forensic report), the top
 * stepper, and the auth gate; all screen UI + engine calls live in the focused
 * sub-components under src/components/v2/problem-solver/.
 *
 * Screen → engine wiring:
 *   S1 Diagnose      LIVE  — FreeDiagnostic's 4 questions + scoring math (self-report).
 *   S2 Unlock        GATE  — founding-member framing; auth gate (billing stubbed).
 *   S3 Upload        LIVE  — ASIN/URL via parseAsinInput (screenshot = future).
 *   S4 Analyse       LIVE  — run-forensic-analysis edge fn + 6-step progress.
 *   S5 Customer      LIVE  — forensic_scores + customer_profile (the new field).
 *   S6 Your fix      LIVE  — decision_trigger (DecisionTriggerPanel) + brief framing.
 *   S7 Stay ahead    STATIC — Beta Brand-Defense showcase (illustrative).
 *   S8 In Claude     STATIC — Claude Connector showcase (illustrative).
 *
 * Auth gate: the forensic run (S4) is signed-in only, so S2's CTA gates the jump
 * to S3 — signed-in users continue; signed-out users go to /auth?redirect=/v2/diagnostic.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/services/ServiceProvider';
import { ROUTES } from '@/config/routes';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { TrustGapInputScores } from '@/lib/trustGap';
import { Stepper } from '@/components/v2/problem-solver/Stepper';
import { BrandBar } from '@/components/v2/problem-solver/primitives';
import { PS_COLORS, PS_STEP_NAME, type ProblemSolverStep } from '@/components/v2/problem-solver/theme';
import type { ForensicResponse, ProblemSolverFlowState } from '@/components/v2/problem-solver/types';
import { RecognitionScreen } from '@/components/v2/problem-solver/RecognitionScreen';
import { DiagnoseScreen } from '@/components/v2/problem-solver/DiagnoseScreen';
import { UnlockScreen } from '@/components/v2/problem-solver/UnlockScreen';
import { UploadScreen } from '@/components/v2/problem-solver/UploadScreen';
import { AnalyseScreen } from '@/components/v2/problem-solver/AnalyseScreen';
import { CustomerScreen } from '@/components/v2/problem-solver/CustomerScreen';
import { FixScreen } from '@/components/v2/problem-solver/FixScreen';
import { StayAheadScreen } from '@/components/v2/problem-solver/StayAheadScreen';
import { InClaudeScreen } from '@/components/v2/problem-solver/InClaudeScreen';

const NAV_NOTE: Record<ProblemSolverStep, string> = {
  1: 'Free Trust Gap Diagnostic',
  2: 'Your fix — founding offer',
  3: 'Upload · context remembered',
  4: 'Analysing…',
  5: 'Your customer profile',
  6: 'Your Decision Trigger',
  7: 'Brand Defense · Beta',
  8: 'Inside Claude · Connector',
};

const AUTH_REDIRECT = '/auth?redirect=/v2/diagnostic';

interface ProblemSolverDiagnosticProps {
  /**
   * Prepend Movement 1 (Recognition) — the entry-experience screen from
   * IDEA-APP-ENTRY-001 v1.1 — before the 8-step flow. Off by default so the
   * canonical /v2/diagnostic is unchanged; the /v3/diagnostic review route opts in
   * while Trevor signs off on Movement 1 (his gate: review M1 before M2).
   */
  showRecognition?: boolean;
  /**
   * Render without the full-page (`min-h-screen` + background) frame so the flow
   * runs INSIDE a host shell that already provides page chrome — the dark /v4
   * surface (V4Layout). Off by default: standalone /v2·/v3 keep their full-page frame.
   */
  embedded?: boolean;
}

export default function ProblemSolverDiagnostic({
  showRecognition = false,
  embedded = false,
}: ProblemSolverDiagnosticProps = {}): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { productDataService } = useServices();
  const [step, setStep] = useState<ProblemSolverStep>(1);
  // When Recognition is shown, the flow proper begins only after the user enters
  // it; otherwise (canonical /v2) we start already inside the flow. Movements 2/3
  // will later slot in before `entered` flips.
  const [entered, setEntered] = useState(!showRecognition);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flow, setFlow] = useState<ProblemSolverFlowState>({ selfReport: null, asin: null, report: null });

  // Entry-experience funnel: Movement 1 (Recognition) viewed once on arrival —
  // only on the route that actually shows it.
  useEffect(() => {
    if (!showRecognition) return;
    captureAlphaEvent('entry_movement_viewed', { movement: 1, movement_name: 'recognition' });
  }, [showRecognition]);

  // Resurface a previously imported listing. The user's ASIN is stored durably in
  // user_products, so a returning user must NOT face a blank upload screen — the screen's
  // own copy promises "upload once; every future session builds on it". Prefill flow.asin
  // from their most-recent import on mount; the functional update never clobbers an ASIN
  // the user has already entered this session, and a load failure degrades silently.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const products = await productDataService.getProducts();
        if (cancelled || products.length === 0) return;
        setFlow((f) => (f.asin ? f : { ...f, asin: products[0].asin }));
      } catch {
        /* best-effort resurface — leave the screen as-is on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, productDataService]);

  // Step-advance funnel event (step index + name + overall self-report only — no PII).
  // Deferred until the user has entered the flow, so Recognition does not emit a
  // spurious "diagnose viewed" before the diagnostic has actually begun.
  useEffect(() => {
    if (!entered) return;
    captureAlphaEvent('problem_solver_step_viewed', {
      step,
      step_name: PS_STEP_NAME[step],
      overall_score: flow.selfReport?.overall ?? null,
    });
    window.scrollTo(0, 0);
    // selfReport intentionally excluded — we report the score at the time of the step view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, entered]);

  const goTo = useCallback((next: ProblemSolverStep): void => setStep(next), []);

  // Movement 1 → enter the diagnostic flow. (Later: → Movement 2, Diagnosis.)
  const handleEnterFlow = useCallback((): void => {
    captureAlphaEvent('entry_movement_advanced', { movement: 1, movement_name: 'recognition' });
    setEntered(true);
  }, []);

  /**
   * Guard step jumps from the stepper: never let the user skip past the auth gate
   * (S3+) when signed out, and never jump to a screen whose data isn't ready yet
   * (Upload needs a self-report; Analyse+ needs an ASIN; Customer/Fix need a report).
   */
  const handleJump = useCallback(
    (target: ProblemSolverStep): void => {
      if (target >= 3 && !user) {
        captureAlphaEvent('problem_solver_unlock_gated', { step: target });
        navigate(AUTH_REDIRECT);
        return;
      }
      if (target >= 2 && !flow.selfReport) return; // must diagnose first
      if (target >= 4 && !flow.asin) return; // must supply an ASIN first
      if ((target === 5 || target === 6) && !flow.report) return; // need a completed run
      setStep(target);
    },
    [user, flow.selfReport, flow.asin, flow.report, navigate],
  );

  const handleReveal = useCallback((scores: TrustGapInputScores): void => {
    setFlow((f) => ({ ...f, selfReport: scores }));
  }, []);

  // S2 CTA: auth gate. Signed-in → S3; signed-out → /auth?redirect=/v2/diagnostic.
  const handleUnlock = useCallback((): void => {
    if (!user) {
      captureAlphaEvent('problem_solver_unlock_gated', { step: 2 });
      navigate(AUTH_REDIRECT);
      return;
    }
    setStep(3);
  }, [user, navigate]);

  const handleAnalyse = useCallback((asin: string): void => {
    setFlow((f) => ({ ...f, asin, report: null }));
    setStep(4);
  }, []);

  const handleReportComplete = useCallback((report: ForensicResponse): void => {
    setFlow((f) => ({ ...f, report }));
  }, []);

  const handleRestart = useCallback((): void => {
    setAnswers({});
    setFlow({ selfReport: null, asin: null, report: null });
    setStep(1);
    setEntered(!showRecognition); // back to Recognition when it's the opener
  }, [showRecognition]);

  // Terminal-screen exits. The flow is shared by /v2, /v3, and the /v4 spine, so
  // rather than hard-code a v4 route here the caller passes its forward target via
  // query params (the /v4 Diagnose stage links with ?next=/v4/analyse&nextLabel=Analyse).
  // `next` is sanitised to an internal path to avoid an open-redirect. Home always
  // falls back to APP_ROOT, which VersionGate resolves to the user's surface — so
  // the diagnostic is never a dead-end regardless of how it was entered.
  const rawNext = searchParams.get('next');
  const nextRoute =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const nextLabel = searchParams.get('nextLabel');

  const handleExitHome = useCallback((): void => {
    navigate(ROUTES.APP_ROOT);
  }, [navigate]);

  const handleExitContinue = useCallback((): void => {
    if (nextRoute) navigate(nextRoute);
  }, [navigate, nextRoute]);

  // Movement 1 (Recognition) — full-screen, no Stepper/BrandBar chrome: the brief
  // requires no product or framework vocabulary here (AC #1). It precedes the flow.
  if (!entered) {
    return <RecognitionScreen onContinue={handleEnterFlow} embedded={embedded} />;
  }

  return (
    <div className={embedded ? undefined : 'min-h-screen'} style={embedded ? undefined : { background: PS_COLORS.g100 }}>
      <div className="mx-auto max-w-[880px] px-2 py-4 sm:px-4 sm:py-6">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: PS_COLORS.warm, borderColor: PS_COLORS.line, boxShadow: '0 4px 10px rgba(16,24,40,.10)' }}
        >
          {!embedded && (
            <>
              <Stepper current={step} onJump={handleJump} />
              <BrandBar note={NAV_NOTE[step]} />
            </>
          )}

          <div className="px-4 py-6 sm:px-6 sm:py-7">
            {step === 1 && (
              <DiagnoseScreen
                answers={answers}
                onAnswer={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
                onReveal={handleReveal}
                onContinue={() => goTo(2)}
                embedded={embedded}
              />
            )}
            {step === 2 && (
              <UnlockScreen isAuthenticated={!!user} onUnlock={handleUnlock} onBack={() => goTo(1)} />
            )}
            {step === 3 && (
              <UploadScreen defaultValue={flow.asin ?? undefined} onAnalyse={handleAnalyse} onBack={() => goTo(2)} />
            )}
            {step === 4 && flow.asin && flow.selfReport && (
              <AnalyseScreen
                asin={flow.asin}
                selfReport={flow.selfReport}
                existingReport={flow.report}
                onComplete={handleReportComplete}
                onContinue={() => goTo(5)}
              />
            )}
            {step === 5 && flow.report && (
              <CustomerScreen report={flow.report} onBack={() => goTo(4)} onContinue={() => goTo(6)} />
            )}
            {step === 6 && flow.report && (
              <FixScreen report={flow.report} onBack={() => goTo(5)} onContinue={() => goTo(7)} />
            )}
            {step === 7 && <StayAheadScreen onBack={() => goTo(6)} onContinue={() => goTo(8)} />}
            {step === 8 && (
              <InClaudeScreen
                onBack={() => goTo(7)}
                onRestart={handleRestart}
                onContinue={nextRoute ? handleExitContinue : undefined}
                continueLabel={nextLabel ? `Continue to ${nextLabel}` : 'Continue'}
                onHome={handleExitHome}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
