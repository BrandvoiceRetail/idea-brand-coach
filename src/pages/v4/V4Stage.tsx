/**
 * V4Stage — scaffold for the spine stages beyond onboarding (Diagnose, Analyse,
 * Fix, Re-measure, Defend). Resolves the active stage from the route and renders
 * a framed placeholder so the shell, spine stepper, and navigation are fully
 * wired today; each stage's real build (Loops 1–3) drops into `children`.
 *
 * Diagnose reuses the existing ProblemSolverDiagnostic(showRecognition) flow —
 * surfaced here as a deep link until it is reskinned to the v23 tokens inline.
 */
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { activeStageFor, V4_ROUTES } from '@/config/v4';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';

/**
 * Stage-scaffold funnel events. Cast to the shared union at this single seam
 * (keeps the canonical posthogClient registry untouched) — IDs/booleans only,
 * never user-facing copy. Mirrors the per-screen captureV4 pattern.
 */
function emitPage(name: string, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export default function V4Stage(): JSX.Element {
  const { pathname } = useLocation();
  const stage = activeStageFor(pathname);
  const stageKey = stage?.key ?? null;

  // Announce the placeholder stage entry once per stage.
  useEffect(() => {
    if (stageKey) emitPage(`v4_${stageKey}_stage_viewed`, { placeholder: true });
  }, [stageKey]);

  if (!stage) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Stage not found.
        </CardContent>
      </Card>
    );
  }

  const Icon = stage.icon;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Icon className="h-7 w-7 text-gold-warm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{stage.label}</h1>
          <p className="text-muted-foreground">{stage.blurb}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming together</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This is the <strong className="text-foreground">{stage.label}</strong>{' '}
            stage of your brand journey. The full experience is being built in this
            loop — the shell, navigation, and your saved context are already live.
          </p>
          {stage.key === 'diagnose' && (
            <Button asChild variant="brand" className="gap-2">
              <Link
                to={`/v3/diagnostic?next=${encodeURIComponent(V4_ROUTES.ANALYSE)}&nextLabel=Analyse`}
                onClick={() => emitPage('v4_diagnose_run_diagnostic_clicked', {})}
              >
                Run the diagnostic
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
