/**
 * OnboardingReflectionRun — the Loop-1 coach read-it-back (§4 of
 * docs/COACH_TRANSPARENCY.md), reworked so the RESTATEMENT is the hero:
 *
 *  - LEFT (the thing the user reads + confirms): the read-back finding rendered
 *    as a prominent panel ("Here's what I heard: …"), the "Sounds right / Not
 *    quite" buttons attached directly TO that statement, plus inline gap-fill
 *    fields for any still-missing context slot (a question is answered, never
 *    "confirmed").
 *  - RIGHT (supporting): the agentic build-theatre timeline — each step's status
 *    + everyday tool name + the "why", and ONLY for a `done` step the one real
 *    finding.
 *
 * Desktop uses a two-column grid (md:grid-cols-2); mobile stacks restatement-first.
 *
 * No-fabrication invariants (proven in __tests__):
 *  - a step with status !== 'done' renders NO finding (finding is null upstream);
 *  - the restatement hero shows ONLY the real read-back finding (never invented);
 *  - confirm/reject attach to a STATEMENT — never to an unanswered question;
 *  - needs_input / failed steps surface the honest banner, never a finding.
 *
 * Presentational only — the parent (V4Onboarding) owns the run + confirm wiring.
 */
import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarPortraitCard } from './AvatarPortraitCard';
import type {
  AvatarPortrait,
  NeedsInputItem,
  ReflectionStep,
  ReflectionStepStatus,
} from '@/types/onboardingReflection';

const STATUS_ICON: Record<ReflectionStepStatus, JSX.Element> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-gold-warm" />,
  done: <CheckCircle2 className="h-4 w-4 text-idea-d" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  needs_input: <AlertCircle className="h-4 w-4 text-gold-warm" />,
};

/** A still-missing context slot the user can answer inline. */
export interface AnswerableSlot {
  /** V4 context slot key (e.g. 'customer'). */
  key: string;
  /** The everyday question to render above the input. */
  question: string;
}

export interface OnboardingReflectionRunProps {
  steps: ReflectionStep[];
  /** True while the chain is in flight (drives the spinner + disables actions). */
  isRunning: boolean;
  /** True once every step is terminal (gates the confirm/edit row). */
  hasRun: boolean;
  /** Run-level honest note shown only when no slot is inline-answerable (e.g. Trust-Gap needs evidence). */
  needsInput?: NeedsInputItem[] | null;
  /** Surfaced when a step failed. */
  runError?: string | null;
  /** The portrait restated from the paste (rendered when derivable). */
  portrait: AvatarPortrait | null;
  /** Missing context slots the user can fill inline (drives the gap-fill fields). */
  answerableSlots: AnswerableSlot[];
  /** Persist one inline answer + re-run the read-back. */
  onAnswer: (key: string, value: string) => void;
  /** "Sounds right ✓" — promote findings to confirmed context. */
  onConfirm: () => void;
  /** "Not quite ✏️" — drop into the Context Card to correct. */
  onEdit: () => void;
  /** Re-run the read-it-back chain after a hard error (omit to hide the button). */
  onRetry?: () => void;
}

/** One inline gap-fill row: a missing-slot question + text field + Add. */
function AnswerGapRow({
  slot,
  disabled,
  onAnswer,
}: {
  slot: AnswerableSlot;
  disabled: boolean;
  onAnswer: (key: string, value: string) => void;
}): JSX.Element {
  const [value, setValue] = useState('');
  const submit = (): void => {
    const v = value.trim();
    if (!v) return;
    onAnswer(slot.key, v);
    setValue('');
  };
  return (
    <div className="space-y-1.5" data-testid={`answer-gap-${slot.key}`}>
      <label htmlFor={`answer-gap-input-${slot.key}`} className="block min-w-0 break-words text-sm text-foreground">
        {slot.question}
      </label>
      <div className="flex gap-2">
        <Input
          id={`answer-gap-input-${slot.key}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Type your answer…"
          disabled={disabled}
          className="min-w-0"
        />
        <Button
          type="button"
          variant="outline"
          onClick={submit}
          disabled={disabled || !value.trim()}
          data-testid={`answer-gap-add-${slot.key}`}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

export function OnboardingReflectionRun({
  steps,
  isRunning,
  hasRun,
  needsInput,
  runError,
  portrait,
  answerableSlots,
  onAnswer,
  onConfirm,
  onEdit,
  onRetry,
}: OnboardingReflectionRunProps): JSX.Element {
  const findingCount = steps.filter((s) => s.status === 'done' && s.finding).length;
  // The restatement IS the read-back finding (real result only — never synthesised).
  const readBack = steps.find((s) => s.id === 'read_back');
  const restatement = readBack?.status === 'done' ? readBack.finding : null;

  return (
    <Card data-testid="reflection-run">
      <CardHeader>
        <CardTitle className="text-lg">Reading it back to you</CardTitle>
        <p className="text-sm text-muted-foreground">
          Everything below is grounded in what you gave me — nothing invented.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* LEFT — the restatement hero + confirm + gap-fill (stacks first on mobile) */}
          <div className="min-w-0 space-y-4">
            {restatement ? (
              <div
                className="rounded-lg border border-gold-light bg-gold-light/30 p-4"
                data-testid="reflection-restatement"
              >
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-warm">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Here's what I heard
                </p>
                <p className="mt-2 break-words text-lg font-medium leading-snug text-foreground">
                  {restatement}
                </p>
              </div>
            ) : (
              hasRun && (
                <div
                  className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
                  data-testid="reflection-restatement-empty"
                >
                  I couldn't pick out enough to read back yet. Add a couple of details below and I'll
                  try again.
                </div>
              )
            )}

            {/* Confirm / edit — attached to a STATEMENT, never a question */}
            {restatement && (
              <div className="flex flex-col gap-2 sm:flex-row" data-testid="reflection-confirm-gate">
                <Button
                  type="button"
                  variant="brand"
                  onClick={onConfirm}
                  disabled={isRunning}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Sounds right
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onEdit}
                  disabled={isRunning}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Not quite
                </Button>
              </div>
            )}

            {/* Inline gap-fill — answer a missing slot, no dead-ends */}
            {answerableSlots.length > 0 && (
              <div
                className="space-y-3 rounded-md border border-gold-light bg-gold-light/20 p-3"
                data-testid="reflection-answer-gaps"
              >
                <p className="text-sm font-semibold text-foreground">A couple of gaps to fill</p>
                {answerableSlots.map((slot) => (
                  <AnswerGapRow key={slot.key} slot={slot} disabled={isRunning} onAnswer={onAnswer} />
                ))}
              </div>
            )}

            {/* Honest run-level note — only when nothing is inline-answerable (never a finding) */}
            {answerableSlots.length === 0 && needsInput && needsInput.length > 0 && (
              <div
                className="space-y-1 rounded-md border border-gold-light bg-gold-light/30 p-3 text-sm"
                data-testid="reflection-needs-input"
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
                className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                data-testid="reflection-run-error"
              >
                <p className="break-words">{runError}</p>
                {onRetry && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRetry}
                    disabled={isRunning}
                    className="gap-2"
                    data-testid="reflection-run-retry"
                  >
                    <Loader2 className={isRunning ? 'h-4 w-4 animate-spin' : 'hidden'} />
                    Try again
                  </Button>
                )}
              </div>
            )}

          </div>

          {/* RIGHT — supporting build-theatre timeline */}
          <div className="min-w-0 space-y-3" data-testid="reflection-timeline-rail">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How I worked it out
            </p>
            <ol className="space-y-3" data-testid="reflection-timeline">
              {steps.map((step) => (
                <li key={step.id} className="min-w-0 space-y-1" data-testid={`reflection-step-${step.id}`}>
                  <div className="flex items-start gap-2 text-sm font-medium text-foreground">
                    <span className="mt-0.5 shrink-0">{STATUS_ICON[step.status]}</span>
                    <span className="min-w-0 break-words">{step.label}</span>
                    <span className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                      · {step.tool}
                    </span>
                  </div>
                  <p className="break-words pl-6 text-xs text-muted-foreground">{step.rationale}</p>
                  {step.status === 'done' && step.finding && (
                    <p
                      className="break-words pl-6 text-sm text-foreground"
                      data-testid={`reflection-finding-${step.id}`}
                    >
                      → {step.finding}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Portrait — full-width beneath both columns so the left rail doesn't
            tower over the timeline on desktop (2-up fields read better wide). */}
        {findingCount > 0 && (
          <div className="mt-6">
            <AvatarPortraitCard portrait={portrait} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
