/**
 * V4Onboarding (Loop 1, S-03..S-06) — the /v4 entry.
 *
 * Flow: the user pastes a megaprompt → "Read it back to me" runs the coach
 * BUILD-THEATRE (OnboardingReflectionRun): a live, read-only agentic timeline
 * that shows each step + a REAL finding grounded in the paste (never fabricated;
 * a step that can't ground itself surfaces an honest needs_input/error instead).
 * The extracted facts land as `filled-inferred` context; "Sounds right ✓"
 * promotes them to stated, "Not quite ✏️" drops into the Context Card to edit.
 * The Context Card ("I won't ask twice" + completeness ring) then carries the
 * confirmed context through the rest of the spine.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ContextCard } from '@/components/v4/ContextCard';
import { OnboardingReflectionRun } from '@/components/v4/onboarding/OnboardingReflectionRun';
import { useOnboardingReflectionRun } from '@/hooks/useOnboardingReflectionRun';
import { useV4Context } from '@/contexts/V4ContextStore';
import { V4_ROUTES } from '@/config/v4';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';

/**
 * Page-level Loop-1 funnel events. Cast to the shared union at this single seam
 * (keeps the canonical posthogClient registry untouched) — IDs/booleans only,
 * never user-facing copy. Mirrors the per-screen captureV4 pattern.
 */
type V4OnboardingPageEvent =
  | 'v4_onboarding_stage_viewed'
  | 'v4_onboarding_read_back_started'
  | 'v4_onboarding_gap_answered'
  | 'v4_onboarding_findings_confirmed'
  | 'v4_onboarding_findings_edited'
  | 'v4_onboarding_advanced_to_diagnose';

function emitPage(name: V4OnboardingPageEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export default function V4Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const { allFilled, fillMap } = useV4Context();
  const {
    steps,
    isRunning,
    hasRun,
    needsInput,
    runError,
    portrait,
    runReflection,
    answerNeedsInput,
    confirmFindings,
  } = useOnboardingReflectionRun();

  // Only GENUINELY-EMPTY slots become inline gap-fill fields. A slot the coach
  // already lifted from the paste (filled-inferred, shown in the restatement +
  // avatar card) is NOT a gap — it's confirmed via "Sounds right", never re-asked
  // as a blank field. Showing those as empty inputs contradicts the read-back.
  const answerableSlots = fillMap
    .filter((s) => !s.value)
    .map((s) => ({ key: s.key, question: s.askQuestion }));

  const [megaprompt, setMegaprompt] = useState('');
  const [started, setStarted] = useState(false);
  // Seed from the persisted store so a returning user with complete context sees
  // their Context Card + Continue CTA on refresh, not just the empty textarea.
  const [showContext, setShowContext] = useState<boolean>(allFilled);
  const contextRef = useRef<HTMLDivElement>(null);

  // Announce the Loop-1 entry once on mount.
  useEffect(() => {
    emitPage('v4_onboarding_stage_viewed', {});
  }, []);

  // The store hydrates from localStorage asynchronously (per-user bucket); when it
  // resolves to a complete context and the user hasn't started a fresh read-back,
  // reveal the Context Card so returning users aren't stranded on an empty form.
  useEffect(() => {
    if (allFilled && !started) setShowContext(true);
  }, [allFilled, started]);

  const handleReadItBack = (): void => {
    if (!megaprompt.trim()) return;
    emitPage('v4_onboarding_read_back_started', { paste_length: megaprompt.trim().length });
    setStarted(true);
    setShowContext(false);
    void runReflection(megaprompt);
  };

  const revealContext = (): void => {
    setShowContext(true);
    // Defer scroll until the card has mounted.
    requestAnimationFrame(() => contextRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const handleAnswer = (key: string, value: string): void => {
    emitPage('v4_onboarding_gap_answered', { slot: key });
    void answerNeedsInput(key, value);
  };

  const handleConfirm = (): void => {
    emitPage('v4_onboarding_findings_confirmed', {});
    confirmFindings();
    revealContext();
  };

  const handleEdit = (): void => {
    emitPage('v4_onboarding_findings_edited', {});
    revealContext();
  };

  const handleAdvance = (): void => {
    emitPage('v4_onboarding_advanced_to_diagnose', {});
    navigate(V4_ROUTES.DIAGNOSE);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-light px-3 py-1 text-xs font-semibold text-gold-warm">
          <Sparkles className="h-3.5 w-3.5" />
          Let's get started
        </span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tell me about your brand
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Paste everything you've got — a product page, your reviews, a URL, or
          just a paragraph. I'll read it back so you know I've understood, then
          we'll find your Trust Gap together.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your brand, in your words</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={megaprompt}
            onChange={(e) => setMegaprompt(e.target.value)}
            placeholder="e.g. We're called RestWell. We sell a natural sleep supplement for busy parents who can't switch off at night. We mainly sell on Amazon and want to grow repeat orders."
            className="min-h-[160px] resize-y"
            disabled={isRunning}
            data-testid="megaprompt-input"
          />
          <Button
            type="button"
            variant="brand"
            onClick={handleReadItBack}
            disabled={!megaprompt.trim() || isRunning}
            className="gap-2"
            data-testid="read-it-back-button"
          >
            {isRunning ? 'Reading…' : 'Read it back to me'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {started && (
        <OnboardingReflectionRun
          steps={steps}
          isRunning={isRunning}
          hasRun={hasRun}
          needsInput={needsInput}
          runError={runError}
          portrait={portrait}
          answerableSlots={answerableSlots}
          onAnswer={handleAnswer}
          onConfirm={handleConfirm}
          onEdit={handleEdit}
          onRetry={handleReadItBack}
        />
      )}

      {showContext && (
        <div ref={contextRef} className="space-y-4">
          <ContextCard />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="brand"
              onClick={handleAdvance}
              disabled={!allFilled}
              className="gap-2"
              data-testid="continue-to-diagnose"
            >
              Continue to Diagnose
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
