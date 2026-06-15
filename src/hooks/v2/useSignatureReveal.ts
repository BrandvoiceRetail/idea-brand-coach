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

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

/** Optional configuration for the reveal flow. */
interface UseSignatureRevealConfig {
  /**
   * Reviews to seed the textarea with on mount and on reset (e.g. the seller's
   * imported Amazon reviews). The user can still edit or replace them.
   */
  initialReviews?: string;
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

export function useSignatureReveal(
  { initialReviews = '' }: UseSignatureRevealConfig = {},
): UseSignatureRevealReturn {
  const [stage, setStage] = useState<SignatureStage>('paste');
  const [reviews, setReviews] = useState(initialReviews);
  const [options, setOptions] = useState<string[]>([]);
  const [isInference, setIsInference] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [surprise, setSurprise] = useState<SurpriseAnswer>(null);
  const [error, setError] = useState<string | null>(null);

  // Imported reviews load asynchronously, so they usually arrive AFTER the first
  // render seeded the state with ''. Re-seed when they land, but never clobber
  // text the user has already typed and never touch a reveal in progress.
  useEffect(() => {
    if (initialReviews && stage === 'paste') {
      setReviews((current) => (current.trim().length === 0 ? initialReviews : current));
    }
    // Only the arrival of initialReviews should trigger a re-seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReviews]);

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

      setOptions(returnedOptions.slice(0, 4));
      setIsInference(Boolean(data?.inference));
      setStage('options');
    } catch (err) {
      console.error('[useSignatureReveal] reveal failed:', err);
      setError('Trevor could not reveal your Signature right now. Please try again.');
      setStage('paste');
    }
  }, [reviews]);

  const pickOption = useCallback((index: number): void => {
    setSelectedIndex(index);
    setSurprise(null);
    setStage('picked');
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
    setReviews(initialReviews);
    setOptions([]);
    setIsInference(false);
    setSelectedIndex(null);
    setSurprise(null);
    setError(null);
  }, [initialReviews]);

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
