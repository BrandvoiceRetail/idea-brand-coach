/**
 * useTrustGapInterpretation
 *
 * Fetches the Trevor-voice coaching interpretation for a Trust Gap™ scorecard
 * from the `diagnostic-interpretation` edge function. The scores are sent in the
 * request body (no DB read), so this works for guests and authenticated users
 * alike. The result is cached in sessionStorage by a score signature so returning
 * to the results page does not re-bill the model for identical scores.
 *
 * On failure it surfaces an error and a retry — it deliberately does NOT invent a
 * templated fallback interpretation (Trevor Decision 5: the fallback is not
 * pre-decided), so the UI can show an honest "couldn't generate" state instead.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildTrustGap,
  trustGapSignature,
  TRUST_GAP_DIMENSIONS,
  type TrustGapDimension,
  type TrustGapInputScores,
} from '@/lib/trustGap';
import type { TrustGapEvidence } from '@/services/interfaces/IProductDataService';

export type TrustGapInterpretations = Record<TrustGapDimension, string>;

export interface TrustGapInterpretation {
  interpretations: TrustGapInterpretations;
  primaryGap: TrustGapDimension;
  primaryGapSummary: string;
  /** True when the interpretation was grounded in imported listing evidence. */
  evidencePresent: boolean;
}

interface UseTrustGapInterpretationResult {
  interpretation: TrustGapInterpretation | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

const CACHE_PREFIX = 'trustGapInterpretation:';

/**
 * Build the cache / fetch signature. The optional `evidenceKey` is folded in so an
 * import (new evidence) yields a distinct signature and triggers exactly one fresh
 * call, while the no-evidence signature stays stable and keeps serving its cache.
 */
function buildSignature(scores: TrustGapInputScores, evidenceKey?: string): string {
  const base = trustGapSignature(scores);
  return evidenceKey ? `${base}|evidence:${evidenceKey}` : base;
}

function readCache(signature: string): TrustGapInterpretation | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + signature);
    return raw ? (JSON.parse(raw) as TrustGapInterpretation) : null;
  } catch {
    return null;
  }
}

function writeCache(signature: string, value: TrustGapInterpretation): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + signature, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

function isValidInterpretation(data: unknown): data is TrustGapInterpretation {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<TrustGapInterpretation>;
  if (typeof candidate.primaryGapSummary !== 'string' || candidate.primaryGapSummary.trim() === '') return false;
  const map = candidate.interpretations;
  if (!map || typeof map !== 'object') return false;
  return TRUST_GAP_DIMENSIONS.every((dim) => typeof map[dim] === 'string' && map[dim].trim() !== '');
}

export function useTrustGapInterpretation(
  scores: TrustGapInputScores | null,
  evidence?: TrustGapEvidence,
  evidenceKey?: string,
): UseTrustGapInterpretationResult {
  const [interpretation, setInterpretation] = useState<TrustGapInterpretation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeSignatureRef = useRef<string | null>(null);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Guard against the key/payload race: the evidence key only participates in the
  // signature when the evidence payload itself is present, so a render where the
  // key arrives before the (async-built) evidence cannot cache a generic result
  // under the evidence signature.
  const effectiveEvidenceKey = evidence ? evidenceKey : undefined;

  useEffect(() => {
    if (!scores) return;

    const model = buildTrustGap(scores);
    const signature = buildSignature(scores, effectiveEvidenceKey);
    activeSignatureRef.current = signature;

    const cached = readCache(signature);
    if (cached && attempt === 0) {
      setInterpretation(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const requestBody = {
      scores: Object.fromEntries(model.dimensions.map((d) => [d.key, d.score])) as Record<TrustGapDimension, number>,
      overall: model.overall,
      primaryGap: model.primaryGap,
      ...(evidence ? { evidence } : {}),
    };

    supabase.functions
      .invoke('diagnostic-interpretation', { body: requestBody })
      .then(({ data, error: invokeError }) => {
        if (cancelled || activeSignatureRef.current !== signature) return;

        if (invokeError || (data && (data as { error?: string }).error)) {
          const message = (data as { error?: string })?.error ?? invokeError?.message ?? 'Unknown error';
          console.error('[useTrustGapInterpretation] invoke failed:', message);
          setError('We could not generate your personalised read right now.');
          setInterpretation(null);
          return;
        }

        if (!isValidInterpretation(data)) {
          console.error('[useTrustGapInterpretation] unexpected response shape:', data);
          setError('We could not generate your personalised read right now.');
          setInterpretation(null);
          return;
        }

        const normalised: TrustGapInterpretation = {
          ...data,
          evidencePresent: (data as { evidencePresent?: boolean }).evidencePresent === true,
        };
        writeCache(signature, normalised);
        setInterpretation(normalised);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || activeSignatureRef.current !== signature) return;
        console.error('[useTrustGapInterpretation] unexpected error:', err);
        setError('We could not generate your personalised read right now.');
        setInterpretation(null);
      })
      .finally(() => {
        if (!cancelled && activeSignatureRef.current === signature) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `attempt` re-triggers a fetch on retry; the effective evidence key folds into
    // the signature so an import refetches once; the signature guards stale writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores ? buildSignature(scores, effectiveEvidenceKey) : null, attempt]);

  return { interpretation, isLoading, error, retry };
}
