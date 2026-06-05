/**
 * useSignatureReveal Hook
 *
 * Drives the Signature reveal flow (the recognition moment): collects pasted
 * customer reviews, calls the reveal-signature edge function with the
 * conversation + extracted fields + reviews, and walks through a small state
 * machine: paste -> loading -> options -> picked.
 *
 * The edge function returns 3-4 DISTINCT Signature options in Trevor's voice.
 * All options are equal weight — there is deliberately NO pre-picked "primary".
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { captureAlphaEvent } from '@/lib/posthogClient';

/** Stage of the reveal flow. */
export type SignatureStage = 'paste' | 'loading' | 'options' | 'picked';

/** A single chat turn passed to the edge function. */
export interface SignatureConversationTurn {
  role: string;
  content: string;
}

/** Whether the user answered the "did this surprise you?" prompt. */
export type SurpriseAnswer = 'yes' | 'no' | null;

interface RevealArgs {
  conversation: SignatureConversationTurn[];
  fields: Record<string, string | string[]>;
}

interface UseSignatureRevealReturn {
  stage: SignatureStage;
  reviews: string;
  setReviews: (value: string) => void;
  options: string[];
  /** True when the reveal was inference-only (no reviews pasted). */
  isInference: boolean;
  selectedIndex: number | null;
  surprise: SurpriseAnswer;
  error: string | null;
  reveal: (args: RevealArgs) => Promise<void>;
  pickOption: (index: number) => void;
  answerSurprise: (answer: SurpriseAnswer) => void;
  /** Return from a picked Signature back to the option list. */
  backToOptions: () => void;
  /** Reset the whole flow (e.g. when the dialog closes). */
  reset: () => void;
}

interface RevealResponse {
  options?: unknown;
  usedReviews?: boolean;
  inference?: boolean;
  error?: string;
}

export function useSignatureReveal(): UseSignatureRevealReturn {
  const [stage, setStage] = useState<SignatureStage>('paste');
  const [reviews, setReviews] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [isInference, setIsInference] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [surprise, setSurprise] = useState<SurpriseAnswer>(null);
  const [error, setError] = useState<string | null>(null);

  const reveal = useCallback(async ({ conversation, fields }: RevealArgs): Promise<void> => {
    setStage('loading');
    setError(null);
    setSelectedIndex(null);
    setSurprise(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<RevealResponse>(
        'reveal-signature',
        { body: { conversation, fields, reviews } },
      );

      if (invokeError) throw invokeError;

      const returnedOptions = Array.isArray(data?.options)
        ? (data!.options as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        : [];

      if (returnedOptions.length === 0) {
        throw new Error(data?.error || 'No Signature options were returned.');
      }

      const shownOptions = returnedOptions.slice(0, 4);
      setOptions(shownOptions);
      setIsInference(Boolean(data?.inference));
      setStage('options');

      // Funnel: 3-4 options rendered
      captureAlphaEvent('signature_options_shown', {
        option_count: shownOptions.length,
        used_reviews: Boolean(data?.usedReviews),
        inference: Boolean(data?.inference),
      });
    } catch (err) {
      console.error('[useSignatureReveal] reveal failed:', err);
      captureAlphaEvent('llm_call_failed', { which_call: 'signature', error_type: 'invoke_error' });
      setError('Trevor could not reveal your Signature right now. Please try again.');
      setStage('paste');
    }
  }, [reviews]);

  const pickOption = useCallback((index: number): void => {
    setSelectedIndex(index);
    setSurprise(null);
    setStage('picked');

    // Funnel: tester selected a Signature (index only — content goes to
    // Supabase feedback_events at submission time)
    captureAlphaEvent('signature_picked', { chosen_index: index });
  }, []);

  const answerSurprise = useCallback((answer: SurpriseAnswer): void => {
    setSurprise(answer);
  }, []);

  const backToOptions = useCallback((): void => {
    setSelectedIndex(null);
    setSurprise(null);
    setStage('options');
  }, []);

  const reset = useCallback((): void => {
    setStage('paste');
    setReviews('');
    setOptions([]);
    setIsInference(false);
    setSelectedIndex(null);
    setSurprise(null);
    setError(null);
  }, []);

  return {
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
  };
}
