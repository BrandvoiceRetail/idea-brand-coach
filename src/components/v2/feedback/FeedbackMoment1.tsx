/**
 * FeedbackMoment1
 *
 * The Moment 1 feedback prompt — shown after a user picks their Signature. A self-contained
 * dialog with three v3-framed prompts; on submit it writes a `feedback_events` row tagged
 * `moment_1` with payload {chosen_signature, scores, free_text}. Dismissing logs a `skipped`
 * event. A thank-you state confirms the submit.
 *
 * Non-blocking: a failed write never blocks the flow (see useFeedbackEvent / errors.md).
 * Self-contained: the trigger only flips `open`; this component owns everything else.
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MessageSquareHeart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedbackEvent } from '@/hooks/v2/useFeedbackEvent';

type FeltRight = 'yes' | 'no' | 'unsure';

interface FeedbackMoment1Props {
  open: boolean;
  /** Called after the user submits or dismisses. The parent should set open=false. */
  onClose: () => void;
  /** The Signature the user just picked. */
  chosenSignature: string;
  /** Optional chat session id (null/undefined when unavailable). */
  sessionId?: string | null;
}

const FELT_OPTIONS: Array<{ value: FeltRight; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

function FeltRightGroup({
  question,
  value,
  onChange,
}: {
  question: string;
  value: FeltRight | null;
  onChange: (v: FeltRight) => void;
}): JSX.Element {
  return (
    <div role="group" aria-label={question} className="space-y-2">
      <p className="text-sm font-medium">{question}</p>
      <div className="flex gap-2">
        {FELT_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn('flex-1', value === opt.value && 'border-amber-400 bg-amber-50 text-amber-800')}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function FeedbackMoment1({
  open,
  onClose,
  chosenSignature,
  sessionId,
}: FeedbackMoment1Props): JSX.Element {
  const { isSubmitting, recordEvent } = useFeedbackEvent();
  const [scoreFeltRight, setScoreFeltRight] = useState<FeltRight | null>(null);
  const [signatureFeltRight, setSignatureFeltRight] = useState<FeltRight | null>(null);
  const [freeText, setFreeText] = useState('');
  const [thanked, setThanked] = useState(false);
  // True once the user has either submitted or skipped, so closing never double-writes.
  const settledRef = useRef(false);

  const handleSubmit = async (): Promise<void> => {
    if (settledRef.current) return;
    settledRef.current = true;
    await recordEvent({
      moment: 'moment_1',
      sessionId,
      payload: {
        chosen_signature: chosenSignature,
        scores: {
          score_felt_right: scoreFeltRight ?? 'unsure',
          signature_felt_right: signatureFeltRight ?? 'unsure',
        },
        free_text: freeText.trim(),
      },
    });
    setThanked(true); // non-blocking: thank regardless of write outcome
  };

  const recordSkip = (): void => {
    if (settledRef.current) return;
    settledRef.current = true;
    // fire-and-forget; never block dismissal on the write
    void recordEvent({
      moment: 'moment_1',
      sessionId,
      payload: { skipped: true, chosen_signature: chosenSignature },
    });
  };

  const handleSkip = (): void => {
    recordSkip();
    onClose();
  };

  // Radix-initiated closes (X / Esc / outside click) count as a dismissal.
  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      if (!thanked) recordSkip();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!thanked ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareHeart className="h-5 w-5 text-amber-500" />
                Quick gut check
              </DialogTitle>
              <DialogDescription>
                Two taps and a line — it helps us learn whether this landed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <FeltRightGroup
                question="Did the score feel right?"
                value={scoreFeltRight}
                onChange={setScoreFeltRight}
              />
              <FeltRightGroup
                question="Did the positioning feel right?"
                value={signatureFeltRight}
                onChange={setSignatureFeltRight}
              />
              <div className="space-y-2">
                <label htmlFor="feedback-free-text" className="text-sm font-medium">
                  What&apos;s off?
                </label>
                <Textarea
                  id="feedback-free-text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Anything that felt wrong, surprising, or missing. (Optional.)"
                  rows={3}
                  maxLength={2000}
                  className="resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareHeart className="h-5 w-5 text-amber-500" />
                Thank you
              </DialogTitle>
              <DialogDescription>
                That&apos;s exactly the signal we need. Thanks for the gut check.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-2">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
