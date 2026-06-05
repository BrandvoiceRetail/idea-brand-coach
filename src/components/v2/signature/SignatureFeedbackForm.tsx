/**
 * SignatureFeedbackForm — the Moment-1 Alpha feedback capture.
 *
 * Rendered inside the SignatureReveal dialog after the tester answers the
 * "did this surprise you?" prompt. Asks the two hypothesis questions (did the
 * Trust Gap score feel right, did the Signature feel right) plus a free-text
 * "what's off", and writes the row to Supabase `feedback_events` via the
 * save-feedback-event edge function.
 *
 * THE JOIN KEY: every submission includes the PostHog distinct_id so the
 * feedback row can be joined to the tester's funnel journey. Non-optional.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquareHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { captureAlphaEvent, getPostHogDistinctId } from '@/lib/posthogClient';

type FeltRightAnswer = 'yes' | 'partial' | 'no';

interface SignatureFeedbackFormProps {
  /** The Signature the tester picked. */
  chosenSignature: string;
  /** All options that were shown (what they chose among). */
  signatureOptions: string[];
  /** Chat session id, when available. */
  sessionId?: string | null;
}

const ANSWER_LABELS: Array<{ value: FeltRightAnswer; label: string }> = [
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partially' },
  { value: 'no', label: 'No' },
];

/** Trust Gap scores at this moment, read from the diagnostic localStorage. */
function readDiagnosticScores(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem('diagnosticData');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scores?: Record<string, number> };
    return parsed.scores ?? null;
  } catch {
    return null;
  }
}

function AnswerRow({
  question,
  value,
  onChange,
}: {
  question: string;
  value: FeltRightAnswer | null;
  onChange: (answer: FeltRightAnswer) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{question}</p>
      <div className="flex gap-2">
        {ANSWER_LABELS.map(({ value: answer, label }) => (
          <Button
            key={answer}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(answer)}
            className={cn(
              'flex-1',
              value === answer && 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-50',
            )}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SignatureFeedbackForm({
  chosenSignature,
  signatureOptions,
  sessionId,
}: SignatureFeedbackFormProps): JSX.Element {
  const { user } = useAuth();
  const { currentAvatar } = useAvatarContext();

  const [q1ScoreFeltRight, setQ1ScoreFeltRight] = useState<FeltRightAnswer | null>(null);
  const [q2SignatureFeltRight, setQ2SignatureFeltRight] = useState<FeltRightAnswer | null>(null);
  const [q3WhatsOff, setQ3WhatsOff] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Funnel: the Moment-1 feedback step is shown
  useEffect(() => {
    captureAlphaEvent('feedback_modal_opened');
  }, []);

  // Funnel: final screen
  useEffect(() => {
    if (isSubmitted) captureAlphaEvent('thank_you_viewed');
  }, [isSubmitted]);

  const canSubmit = q1ScoreFeltRight !== null && q2SignatureFeltRight !== null && !isSubmitting;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke('save-feedback-event', {
        body: {
          moment: 'moment_1',
          userId: user?.id ?? null,
          // THE JOIN KEY — connects this row to the PostHog funnel journey
          posthogDistinctId: getPostHogDistinctId(),
          avatarId: currentAvatar?.id ?? null,
          sessionId: sessionId ?? null,
          chosenSignature,
          signatureOptions,
          scores: readDiagnosticScores(),
          q1ScoreFeltRight,
          q2SignatureFeltRight,
          q3WhatsOff: q3WhatsOff.trim() || null,
        },
      });

      if (invokeError) throw invokeError;

      // Enums only — the free text lives in Supabase, not PostHog
      captureAlphaEvent('feedback_submitted', {
        q1: q1ScoreFeltRight,
        q2: q2SignatureFeltRight,
      });
      setIsSubmitted(true);
    } catch (err) {
      console.error('[SignatureFeedbackForm] submit failed:', err);
      setError('Could not save your feedback right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        Thank you — this is exactly what makes the Alpha useful. Your Signature is
        yours to keep.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareHeart className="h-4 w-4 text-amber-500" />
        Two quick questions before you go
      </div>

      <AnswerRow
        question="Did your Trust Gap score feel right?"
        value={q1ScoreFeltRight}
        onChange={setQ1ScoreFeltRight}
      />

      <AnswerRow
        question="Does this Signature feel right?"
        value={q2SignatureFeltRight}
        onChange={setQ2SignatureFeltRight}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">
          What felt off — or what did you wish came up?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <Textarea
          value={q3WhatsOff}
          onChange={(e) => setQ3WhatsOff(e.target.value)}
          placeholder="Anything that missed, surprised, or should have been said differently..."
          rows={3}
          className="resize-y"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-2">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Send feedback
      </Button>
    </div>
  );
}
