/**
 * usePositioningStatementReveal Hook
 *
 * Drives the Positioning Statement reveal flow (the recognition moment): collects pasted
 * customer reviews, calls the reveal-positioning-statement edge function with the
 * conversation + extracted fields + reviews, and walks through a small state
 * machine: paste -> loading -> options -> picked.
 *
 * The edge function returns 3-4 DISTINCT Positioning Statement options in Trevor's voice.
 * All options are equal weight — there is deliberately NO pre-picked "primary".
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServices } from '@/services/ServiceProvider';
import { SavedPositioningStatement } from '@/services/interfaces/IPositioningStatementService';
import { captureAlphaEvent } from '@/lib/posthogClient';

/** Stage of the reveal flow. */
export type PositioningStatementStage = 'paste' | 'loading' | 'options' | 'picked';

/** A single chat turn passed to the edge function. */
export interface PositioningStatementConversationTurn {
  role: string;
  content: string;
}

/** Whether the user answered the "did this surprise you?" prompt. */
export type SurpriseAnswer = 'yes' | 'no' | null;

interface RevealArgs {
  conversation: PositioningStatementConversationTurn[];
  fields: Record<string, string | string[]>;
}

/** Optional configuration for the reveal flow. */
interface UsePositioningStatementRevealConfig {
  /**
   * Reviews to seed the textarea with on mount and on reset (e.g. the seller's
   * imported Amazon reviews). The user can still edit or replace them.
   */
  initialReviews?: string;
  /**
   * Called after a picked Positioning Statement has been persisted, so the page can show
   * the saved pick outside the dialog without refetching.
   */
  onPositioningStatementSaved?: (saved: SavedPositioningStatement) => void;
}

interface UsePositioningStatementRevealReturn {
  stage: PositioningStatementStage;
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
  /** Return from a picked Positioning Statement back to the option list. */
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

export function usePositioningStatementReveal(
  { initialReviews = '', onPositioningStatementSaved }: UsePositioningStatementRevealConfig = {},
): UsePositioningStatementRevealReturn {
  const { positioningStatementService } = useServices();
  const [stage, setStage] = useState<PositioningStatementStage>('paste');
  const [reviews, setReviews] = useState(initialReviews);
  const [options, setOptions] = useState<string[]>([]);
  const [isInference, setIsInference] = useState(false);
  const [usedReviews, setUsedReviews] = useState(false);
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
        'reveal-positioning-statement',
        { body: { conversation, fields, reviews } },
      );

      if (invokeError) throw invokeError;

      const returnedOptions = Array.isArray(data?.options)
        ? (data!.options as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        : [];

      if (returnedOptions.length === 0) {
        throw new Error(data?.error || 'No positioning options were returned.');
      }

      const shownOptions = returnedOptions.slice(0, 4);
      setOptions(shownOptions);
      setIsInference(Boolean(data?.inference));
      setUsedReviews(Boolean(data?.usedReviews));
      setStage('options');

      // Funnel: 3-4 options rendered
      captureAlphaEvent('positioning_statement_options_shown', {
        option_count: shownOptions.length,
        used_reviews: Boolean(data?.usedReviews),
        inference: Boolean(data?.inference),
      });
    } catch (err) {
      console.error('[usePositioningStatementReveal] reveal failed:', err);
      captureAlphaEvent('llm_call_failed', { which_call: 'positioning_statement', error_type: 'invoke_error' });
      setError('Trevor could not reveal your positioning right now. Please try again.');
      setStage('paste');
    }
  }, [reviews]);

  const pickOption = useCallback((index: number): void => {
    setSelectedIndex(index);
    setSurprise(null);
    setStage('picked');

    // Funnel: tester selected a Positioning Statement (index only — content goes to
    // Supabase feedback_events at submission time)
    captureAlphaEvent('positioning_statement_picked', { chosen_index: index });

    // Persist the pick so it survives reloads and feeds downstream use.
    // Fire-and-forget: a save failure must never break the reveal moment.
    const positioningStatementText = options[index];
    if (positioningStatementText) {
      positioningStatementService
        .savePositioningStatement({
          positioningStatementText,
          allOptions: options,
          chosenIndex: index,
          usedReviews,
          inference: isInference,
        })
        .then((saved) => onPositioningStatementSaved?.(saved))
        .catch((saveError) => {
          console.warn('[usePositioningStatementReveal] Failed to persist Positioning Statement pick:', saveError);
        });
    }
  }, [options, usedReviews, isInference, positioningStatementService, onPositioningStatementSaved]);

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
