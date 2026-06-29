/**
 * V4Diagnose — the Diagnose stage of the /v4 spine, running the Problem-Solver
 * diagnostic INLINE inside the dark V4Layout shell (sidebar + spine stepper stay
 * visible) instead of deep-linking out to /v3/diagnostic. Reuses the existing
 * ProblemSolverDiagnostic(showRecognition) flow — now on the v23 black/gold palette
 * — with `embedded` so it drops its own full-page frame and flows in the shell's
 * <main>. /v4 is RequireAuth-gated, so the diagnostic's internal sign-in gates
 * (steps 3+) never fire here — the caller is always authenticated.
 */
import { useEffect } from 'react';
import ProblemSolverDiagnostic from '@/pages/v2/ProblemSolverDiagnostic';
import { captureAlphaEvent } from '@/lib/posthogClient';

export default function V4Diagnose(): JSX.Element {
  useEffect(() => {
    captureAlphaEvent('v4_diagnose_stage_viewed', { placeholder: false });
  }, []);

  return <ProblemSolverDiagnostic showRecognition embedded />;
}
