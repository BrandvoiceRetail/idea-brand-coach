/**
 * useFeedbackEvent Hook
 *
 * Client write path for moment-tagged product-signal events (Gen 3 alpha).
 * Wraps the `save-feedback-event` edge function (which derives user_id from the
 * verified JWT and inserts into public.feedback_events with the service role).
 *
 * Non-blocking by design: a failed write NEVER throws into the UI — recordEvent
 * resolves `{ ok: false }` and sets `error`, so a feedback prompt can never break
 * the Signature flow. See .feature-factory/feedback-loop/errors.md.
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecordEventArgs {
  /** Event moment tag, e.g. 'moment_1'. */
  moment: string;
  /** Arbitrary JSON payload (e.g. {chosen_signature, scores, free_text} or {skipped:true}). */
  payload: Record<string, unknown>;
  /** Optional chat session id; null when unavailable. */
  sessionId?: string | null;
}

export interface RecordEventResult {
  ok: boolean;
  id?: string;
}

interface UseFeedbackEventReturn {
  isSubmitting: boolean;
  error: string | null;
  recordEvent: (args: RecordEventArgs) => Promise<RecordEventResult>;
}

interface SaveFeedbackEventResponse {
  id?: string;
  error?: string;
}

export function useFeedbackEvent(): UseFeedbackEventReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordEvent = useCallback(
    async ({ moment, payload, sessionId }: RecordEventArgs): Promise<RecordEventResult> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { data, error: invokeError } = await supabase.functions.invoke<SaveFeedbackEventResponse>(
          'save-feedback-event',
          { body: { moment, session_id: sessionId ?? null, payload } },
        );

        if (invokeError || data?.error) {
          throw new Error(invokeError?.message ?? data?.error ?? 'Unknown error');
        }

        return { ok: true, id: data?.id };
      } catch (err) {
        console.error('[useFeedbackEvent] write failed:', err);
        setError('We could not record your feedback. It is safe to continue.');
        return { ok: false };
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return { isSubmitting, error, recordEvent };
}
