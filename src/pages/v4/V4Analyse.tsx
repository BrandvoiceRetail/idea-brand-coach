/**
 * V4Analyse — the Analyse stage (Loop 2, S-07..S-11).
 *
 * WHAT: The thin wiring shell that orchestrates the Loop-2 flow inside the /v4
 * shell (sidebar + spine stepper + bottom-nav): build-theatre run → editable
 * Avatar → Trust Gap + Decision Trigger → Decision Board (scored positioning
 * moves) → Move brief + claim gate. ALL data-fetching is owned by
 * `useAnalyseRun` (the analyseService seam + the confirmed V4ContextStore); this
 * page only passes data + handlers to the presentational screens, owns the
 * primary CTA that advances the spine (Analyse → Fix), and emits the page-level
 * funnel events for the stage transitions.
 *
 * WHY: Pages on /v4 are thin shells (src/pages/AGENTS.md). Keeping the
 * orchestration in the hook lets this file stay a readable map of the Analyse leg
 * of the Diagnose → Analyse → Fix spine.
 *
 * NO FABRICATION: the run auto-starts only when the confirmed context has the
 * minimum (a customer + a problem); otherwise an honest "let's gather your
 * context first" gate is shown with a link back to onboarding. Every screen
 * renders its own loading / empty / error state — nothing here is invented.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Microscope, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnalyseRun } from '@/components/v4/analyse/AnalyseRun';
import { AvatarProfile } from '@/components/v4/analyse/AvatarProfile';
import { GapDecisionTriggerPanel } from '@/components/v4/analyse/GapDecisionTriggerPanel';
import { DecisionBoard } from '@/components/v4/analyse/DecisionBoard';
import { MoveBriefClaimGate } from '@/components/v4/analyse/MoveBriefClaimGate';
import { useAnalyseRun } from '@/hooks/useAnalyseRun';
import { V4_ROUTES } from '@/config/v4';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { AvatarPortrait } from '@/types/v4Analyse';

/**
 * Page-level Loop-2 funnel events. Cast to the shared union at this single seam
 * (keeps the canonical posthogClient registry untouched) — IDs/booleans only,
 * never user-facing copy. Mirrors the per-screen captureV4 pattern.
 */
type V4AnalysePageEvent =
  | 'v4_analyse_stage_viewed'
  | 'v4_analyse_gate_blocked'
  | 'v4_analyse_advanced_to_fix';

function emitPage(name: V4AnalysePageEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export default function V4Analyse(): JSX.Element {
  const navigate = useNavigate();
  const {
    steps,
    needsInput,
    runError,
    hasContext,
    avatar,
    avatarConfirmed,
    trustGap,
    decisionTrigger,
    moves,
    movesLoading,
    movesError,
    selectedMoveId,
    brief,
    claims,
    briefLoading,
    briefError,
    runAnalyse,
    editAvatar,
    confirmAvatar,
    generateMoves,
    chooseMove,
    confirmClaim,
  } = useAnalyseRun();

  const startedRef = useRef(false);
  const [exported, setExported] = useState(false);

  // Auto-run once on entry when the confirmed context is sufficient. The
  // never-ask-twice store already carries the customer + problem from onboarding.
  useEffect(() => {
    emitPage('v4_analyse_stage_viewed', { has_context: hasContext });
    if (hasContext && !startedRef.current) {
      startedRef.current = true;
      void runAnalyse();
    } else if (!hasContext) {
      emitPage('v4_analyse_gate_blocked', {});
    }
  }, [hasContext, runAnalyse]);

  const handleConfirmAvatar = (portrait: AvatarPortrait): void => {
    confirmAvatar(portrait);
    // Confirming the avatar is the cue to draft positioning moves to test.
    void generateMoves();
  };

  const handleExport = (): void => {
    setExported(true);
  };

  const handleAdvance = (): void => {
    emitPage('v4_analyse_advanced_to_fix', {
      has_avatar: Boolean(avatar),
      has_move: Boolean(selectedMoveId),
      has_brief: Boolean(brief),
    });
    navigate(V4_ROUTES.FIX);
  };

  // Per-step in-flight / failure flags for the avatar + gap panels. The run hook
  // exposes the live timeline; derive each screen's loading / error from its step
  // so the build-in-flight and backend-error states actually render.
  const avatarStep = steps.find((s) => s.id === 'avatar');
  const gapStep = steps.find((s) => s.id === 'gap_trigger');
  const avatarLoading = avatarStep?.status === 'running';
  const gapLoading = gapStep?.status === 'running';
  const gapError = gapStep?.status === 'failed' ? runError : null;

  // The move engine is net-new and may be undeployed → it honestly returns no
  // moves (movesError set, list empty). Don't trap every tester at Analyse: once
  // the avatar is confirmed and the board resolves with no moves available, let
  // the spine advance as a pass-through. When moves DO exist, a choice is still
  // required.
  const moveEngineUnavailable =
    avatarConfirmed && !movesLoading && moves.length === 0 && Boolean(movesError);

  // The CTA unlocks once a move is chosen (the loop's real output), or as the
  // pass-through above when the move engine isn't available yet (no dead-end).
  const canAdvance = Boolean(selectedMoveId) || moveEngineUnavailable;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Microscope className="h-7 w-7 text-gold-warm" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analyse</h1>
          <p className="text-muted-foreground">
            Avatar + Decision Trigger → your positioning move
          </p>
        </div>
      </header>

      {/* Honest gate: no usable context yet → send the user back to onboarding. */}
      {!hasContext ? (
        <Card data-testid="v4-analyse-context-gate">
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-gold-warm" />
              Let&apos;s gather your brand first
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              I analyse from your own words — your customer and the problem you
              solve for them. Tell me about your brand and I&apos;ll bring you
              straight back here. Nothing is invented along the way.
            </p>
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              onClick={() => navigate(V4_ROUTES.ROOT)}
              data-testid="v4-analyse-go-onboarding"
            >
              Tell me about your brand
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <AnalyseRun
            steps={steps}
            needsInput={needsInput}
            runError={runError}
            onRetry={() => void runAnalyse()}
          />

          <AvatarProfile
            portrait={avatar}
            isLoading={avatarLoading}
            onEdit={editAvatar}
            onConfirm={handleConfirmAvatar}
            onRetry={() => void runAnalyse()}
          />

          <GapDecisionTriggerPanel
            trustGap={trustGap}
            trigger={decisionTrigger}
            isLoading={gapLoading}
            error={gapError}
            onRetry={() => void runAnalyse()}
          />

          {/* Decision Board + brief only after the avatar is confirmed. */}
          {avatarConfirmed && (
            <>
              <DecisionBoard
                moves={moves}
                onChooseMove={(move) => void chooseMove(move)}
                isLoading={movesLoading}
                error={movesError}
                onRetry={() => void generateMoves()}
                selectedMoveId={selectedMoveId}
              />

              <MoveBriefClaimGate
                brief={brief}
                claims={claims}
                onConfirmClaim={confirmClaim}
                onExport={handleExport}
                isLoading={briefLoading}
                error={briefError}
                onRetry={() => {
                  const selected = moves.find((m) => m.id === selectedMoveId);
                  if (selected) void chooseMove(selected);
                }}
              />
            </>
          )}

          {/* Primary CTA — advances the spine to Fix once a move is chosen. */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedMoveId
                ? exported
                  ? 'Brief exported. Take it into Fix to put it across your funnel.'
                  : 'Move chosen. Continue to Fix to apply it across your funnel.'
                : moveEngineUnavailable
                  ? "I'll draft positioning moves once that engine's connected — continue to apply your avatar across the funnel."
                  : 'Choose a positioning move above to continue.'}
            </p>
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              onClick={handleAdvance}
              disabled={!canAdvance}
              data-testid="v4-analyse-continue-to-fix"
            >
              Continue to Fix
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
