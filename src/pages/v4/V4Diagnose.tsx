/**
 * V4Diagnose — the Diagnose stage of the /v4 spine, running the Problem-Solver
 * diagnostic INLINE inside the dark V4Layout shell (sidebar + spine stepper stay
 * visible) instead of deep-linking out to /v3/diagnostic. Reuses the existing
 * ProblemSolverDiagnostic(showRecognition) flow — now on the v23 black/gold palette
 * — with `embedded` so it drops its own full-page frame and flows in the shell's
 * <main>. /v4 is RequireAuth-gated, so the diagnostic's internal sign-in gates
 * (steps 3+) never fire here — the caller is always authenticated.
 *
 * RETURNING / MCP-ONBOARDED USERS: if the user has already been through the
 * diagnostic — or onboarded via the Brand Coach connector, which writes a Trust
 * Gap to `diagnostic_submissions` — we don't make them restart. We read the latest
 * persisted diagnostic (scoped to the active avatar, or any scope before one
 * resolves) and, when a score exists, render a short recap that routes straight to
 * Fix. A "re-run the diagnostic" escape always remains. This is the store-and-
 * resurface principle: resurface what's known, advance, don't re-ask.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, RotateCcw, Stethoscope } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProblemSolverDiagnostic from '@/pages/v2/ProblemSolverDiagnostic';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useServices } from '@/services/ServiceProvider';
import { V4_ROUTES } from '@/config/v4';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { DiagnosticScores } from '@/types/diagnostic';

/** Human labels for the four IDEA pillars (Tier-A — safe to show). */
const PILLAR_LABEL: Record<'insight' | 'distinctive' | 'empathetic' | 'authentic', string> = {
  insight: 'Insight',
  distinctive: 'Distinctive',
  empathetic: 'Empathetic',
  authentic: 'Authentic',
};

/** The weakest of the four pillars — the gap to address first. */
function weakestPillar(scores: DiagnosticScores): string {
  const pillars = ['insight', 'distinctive', 'empathetic', 'authentic'] as const;
  const lowest = pillars.reduce((a, b) => (scores[b] < scores[a] ? b : a));
  return PILLAR_LABEL[lowest];
}

export default function V4Diagnose(): JSX.Element {
  const navigate = useNavigate();
  const { selectedAvatarId, isLoadingAvatars } = useAvatarContext();
  const { diagnosticService } = useServices();

  // "Re-run" drops the user straight into the diagnostic for this visit, past the recap.
  const [forceRun, setForceRun] = useState(false);

  // Latest persisted diagnostic scoped to the active avatar (overlay), or the
  // brand baseline before an avatar resolves (`undefined` = any scope).
  const { data: avatarLatest, isLoading: isLoadingAvatarDiagnostic } = useQuery({
    queryKey: ['v4-diagnose-existing', selectedAvatarId ?? 'any'],
    queryFn: () => diagnosticService.getLatestDiagnostic(selectedAvatarId ?? undefined),
    retry: 1,
  });

  // Scope-agnostic read: the latest Trust Gap of ANY scope (brand baseline or any
  // avatar). This is what lets an MCP-onboarded user — whose Trust Gap may sit on
  // the brand baseline or a different avatar — count as "already diagnosed" even
  // when the active avatar has no diagnostic of its own.
  const { data: anyLatest, isLoading: isLoadingAnyDiagnostic } = useQuery({
    queryKey: ['v4-diagnose-existing', 'any-scope'],
    queryFn: () => diagnosticService.getLatestDiagnostic(undefined),
    retry: 1,
  });

  // Prefer the avatar-scoped result for the displayed score / weakest pillar;
  // fall back to the any-scope result when the active avatar has none of its own.
  const latest =
    typeof avatarLatest?.scores?.overall === 'number' ? avatarLatest : anyLatest;

  // Decide only once avatar hydration AND BOTH diagnostic reads have settled —
  // never flash the questionnaire and then yank the user to the recap (the async
  // race we hit with context autofill).
  const resolving = isLoadingAvatars || isLoadingAvatarDiagnostic || isLoadingAnyDiagnostic;
  const alreadyDiagnosed = !resolving && typeof latest?.scores?.overall === 'number';

  useEffect(() => {
    if (resolving) return;
    captureAlphaEvent('v4_diagnose_stage_viewed', { placeholder: false });
    if (alreadyDiagnosed && !forceRun) {
      captureAlphaEvent('v4_diagnose_already_done', {});
    }
  }, [resolving, alreadyDiagnosed, forceRun]);

  // Hold a calm placeholder while resolving rather than flashing either surface.
  if (resolving) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground"
        data-testid="v4-diagnose-resolving"
      >
        Checking your Trust Gap…
      </div>
    );
  }

  // Returning / MCP-onboarded user with a saved Trust Gap → recap + skip to Fix.
  if (alreadyDiagnosed && !forceRun && latest?.scores) {
    const scores = latest.scores;
    const overall = Math.round(scores.overall);
    const gap = weakestPillar(scores);

    const goFix = (): void => {
      captureAlphaEvent('v4_diagnose_skip_to_fix', {});
      navigate(V4_ROUTES.FIX);
    };
    const rerun = (): void => {
      captureAlphaEvent('v4_diagnose_rerun', {});
      setForceRun(true);
    };

    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <Stethoscope className="h-7 w-7 text-gold-warm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Diagnose</h1>
            <p className="text-muted-foreground">You&apos;ve already found your Trust Gap</p>
          </div>
        </header>

        <Card data-testid="v4-diagnose-recap">
          <CardContent className="flex flex-col items-start gap-4 py-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-gold-warm" />
                Trust Gap scored — {overall}/100
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-gold-warm" />
                Widest gap: {gap}
              </div>
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              No need to start over. Pick up where the diagnosis left off and turn it into the one
              change that closes the gap.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="brand"
                className="min-h-[40px] gap-2"
                onClick={goFix}
                data-testid="v4-diagnose-continue-to-fix"
              >
                Continue to Fix
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[40px] gap-2"
                onClick={rerun}
                data-testid="v4-diagnose-rerun"
              >
                <RotateCcw className="h-4 w-4" />
                Re-run the diagnostic
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // First-time / re-running user → the Recognition-first diagnostic.
  return <ProblemSolverDiagnostic showRecognition embedded />;
}
