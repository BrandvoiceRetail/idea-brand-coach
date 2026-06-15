/**
 * SignatureReveal Component
 *
 * The recognition moment. A self-contained dialog that:
 *  1. (paste)   lets the founder paste customer reviews and hit "Reveal Signature"
 *  2. (loading) calls the reveal-signature edge function
 *  3. (options) shows 3-4 DISTINCT Signature option cards, ALL equal weight
 *  4. (picked)  promotes the chosen Signature to a dominant gold-accent result
 *               and asks "Did this surprise you?"
 *
 * No option is pre-picked or marked "strongest" — there is no thumb on the scale.
 * When no reviews are pasted, the copy softens and options are labelled inference.
 */

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Info, ArrowLeft, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignatureReveal, type SignatureConversationTurn } from '@/hooks/v2/useSignatureReveal';
import { FeedbackMoment1 } from '@/components/v2/feedback/FeedbackMoment1';

interface SignatureRevealProps {
  /** Chat turns used as discovery context (role + content). */
  messages: Array<{ role: string; content: string }>;
  /** Extracted brand/customer field values. */
  fieldValues: Record<string, string | string[]>;
  /** Optional trigger sizing/styling. */
  triggerClassName?: string;
  /**
   * Reviews imported from the seller's Amazon listings, used to prefill the
   * textarea so the founder does not have to paste them by hand. They can still
   * edit or replace them.
   */
  preloadedReviews?: string;
  /** Number of imported reviews behind {@link preloadedReviews}, for the banner. */
  preloadedReviewCount?: number;
  /** Optional chat session id, forwarded to the Moment 1 feedback event. */
  sessionId?: string | null;
}

export function SignatureReveal({
  messages,
  fieldValues,
  triggerClassName,
  preloadedReviews = '',
  preloadedReviewCount = 0,
  sessionId,
}: SignatureRevealProps): JSX.Element {
  const [open, setOpen] = useState(false);
  // Moment 1 feedback prompt — opened right after the user PICKS a Signature.
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pickedSignature, setPickedSignature] = useState('');
  const {
    stage,
    reviews,
    setReviews,
    options,
    isInference,
    selectedIndex,
    surprise,
    error,
    reveal,
    pickOption,
    answerSurprise,
    backToOptions,
    reset,
  } = useSignatureReveal({ initialReviews: preloadedReviews });

  const hasPreloadedReviews = preloadedReviewCount > 0 && preloadedReviews.trim().length > 0;

  const conversation = useMemo<SignatureConversationTurn[]>(
    () =>
      messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  const hasReviews = reviews.trim().length > 0;

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next) reset();
  };

  const handleReveal = (): void => {
    reveal({ conversation, fields: fieldValues });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'gap-1.5 border-amber-400/60 text-amber-700 hover:bg-amber-50 hover:text-amber-800',
            triggerClassName,
          )}
          title="Reveal your Signature"
        >
          <Sparkles className="h-4 w-4" />
          Reveal Signature
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        {/* ── Stage: paste ────────────────────────────────────────────── */}
        {stage === 'paste' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Reveal your Signature
              </DialogTitle>
              <DialogDescription>
                The one truth of what your customer is really buying. Paste their
                reviews below and Trevor will name what they would recognise instantly
                but have never quite put into words.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {hasPreloadedReviews && (
                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Using your {preloadedReviewCount.toLocaleString()} imported review
                    {preloadedReviewCount === 1 ? '' : 's'}. You can edit or paste over them below.
                  </span>
                </div>
              )}
              <Textarea
                value={reviews}
                onChange={(e) => setReviews(e.target.value)}
                placeholder="Paste customer reviews here — yours and competitors'. The more raw, unprompted language, the sharper the Signature. (Optional, but reviews make it land harder.)"
                rows={8}
                className="resize-y"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {hasReviews
                    ? `${reviews.trim().length.toLocaleString()} characters of review evidence`
                    : 'No reviews yet — Trevor will infer from your conversation instead'}
                </span>
              </div>

              {!hasReviews && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Without pasted reviews these will be INFORMED INFERENCE from your
                    conversation, not grounded in real customer evidence. Pasting reviews
                    makes the Signature far stronger.
                  </span>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button onClick={handleReveal} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                Reveal Signature
              </Button>
            </div>
          </>
        )}

        {/* ── Stage: loading ──────────────────────────────────────────── */}
        {stage === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Trevor is finding the truth beneath the words...
            </p>
          </div>
        )}

        {/* ── Stage: options ──────────────────────────────────────────── */}
        {stage === 'options' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Which one lands hardest?
              </DialogTitle>
              <DialogDescription>
                {isInference
                  ? 'Trevor inferred these from your conversation. Pick the one that feels most true.'
                  : 'These come at the truth from different angles. Pick the one that feels most true.'}
              </DialogDescription>
            </DialogHeader>

            {isInference && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Informed inference — no customer reviews were pasted, so treat these
                  as a starting point rather than evidence-backed truth.
                </span>
              </div>
            )}

            <div className="space-y-3">
              {options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    pickOption(index);
                    // Minimal hook: arm the Moment 1 feedback prompt with the picked Signature.
                    setPickedSignature(option);
                    setFeedbackOpen(true);
                  }}
                  className={cn(
                    'w-full rounded-lg border bg-card p-4 text-left text-sm leading-relaxed transition-all',
                    'hover:border-amber-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" />
                Start over
              </Button>
            </div>
          </>
        )}

        {/* ── Stage: picked ───────────────────────────────────────────── */}
        {stage === 'picked' && selectedIndex !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Your Signature
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100/40 p-6 shadow-sm">
              <p className="text-lg font-medium leading-relaxed text-amber-950">
                {options[selectedIndex]}
              </p>
            </div>

            <div className="space-y-3 pt-1">
              {surprise === null ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Did this surprise you?</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => answerSurprise('yes')}
                      className="flex-1"
                    >
                      Yes, I had never said it that way
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => answerSurprise('no')}
                      className="flex-1"
                    >
                      No, I already knew this
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {surprise === 'yes'
                    ? 'That recognition is the whole point. That is your Signature.'
                    : 'Good — then it is already true to you. Keep it close; it is your Signature.'}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={backToOptions} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  See the other options
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reveal again
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    <FeedbackMoment1
      open={feedbackOpen}
      onClose={() => setFeedbackOpen(false)}
      chosenSignature={pickedSignature}
      sessionId={sessionId}
    />
    </>
  );
}
