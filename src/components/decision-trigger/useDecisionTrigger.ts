/**
 * useDecisionTrigger
 *
 * Derives the dominant Decision Trigger™ for the current diagnostic session from
 * the `identify-decision-trigger` edge function. Mirrors useTrustGapInterpretation:
 * the result is cached in sessionStorage by a (scores + evidence) signature so
 * returning to the page does not re-bill the model, and a stale-write guard keeps
 * an in-flight call from clobbering a newer one.
 *
 * Requires an authenticated caller and imported evidence — the trigger is GROUNDED
 * in the seller's real reviews, never inferred from scores alone. When `enabled`
 * is false the hook stays idle (no fetch, no error).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  buildTrustGap,
  trustGapSignature,
  type TrustGapDimension,
  type TrustGapInputScores,
} from '@/lib/trustGap';
import type { TrustGapEvidence } from '@/services/interfaces/IProductDataService';
import { DECISION_TRIGGER_TYPES, type DecisionTriggerType } from '@/lib/decisionTrigger';
import type { DecisionTriggerResult } from './types';

interface UseDecisionTriggerResult {
  trigger: DecisionTriggerResult | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

const CACHE_PREFIX = 'decisionTrigger:';
const TRIGGER_TYPES: readonly DecisionTriggerType[] = DECISION_TRIGGER_TYPES;

function buildSignature(scores: TrustGapInputScores, evidenceKey?: string): string {
  const base = trustGapSignature(scores);
  return evidenceKey ? `${base}|evidence:${evidenceKey}` : base;
}

function readCache(signature: string): DecisionTriggerResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + signature);
    return raw ? (JSON.parse(raw) as DecisionTriggerResult) : null;
  } catch {
    return null;
  }
}

function writeCache(signature: string, value: DecisionTriggerResult): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + signature, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

function isValidTrigger(data: unknown): data is DecisionTriggerResult {
  if (!data || typeof data !== 'object') return false;
  const c = data as Partial<DecisionTriggerResult>;
  return (
    typeof c.dominantType === 'string' &&
    TRIGGER_TYPES.includes(c.dominantType as DecisionTriggerType) &&
    typeof c.brandAnchor === 'string' && c.brandAnchor.trim() !== '' &&
    Array.isArray(c.evidencePhrases) &&
    typeof c.placementInstruction === 'string' && c.placementInstruction.trim() !== ''
  );
}

export function useDecisionTrigger(
  scores: TrustGapInputScores | null,
  evidence: TrustGapEvidence | undefined,
  evidenceKey: string | undefined,
  sessionId: string,
  enabled: boolean,
): UseDecisionTriggerResult {
  const [trigger, setTrigger] = useState<DecisionTriggerResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const activeSignatureRef = useRef<string | null>(null);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // The evidence key only participates once the evidence payload is present, so a
  // render where the key arrives before the (async-built) evidence cannot cache a
  // generic result under the evidence signature.
  const effectiveEvidenceKey = evidence ? evidenceKey : undefined;

  useEffect(() => {
    if (!enabled || !scores || !evidence) return;

    const model = buildTrustGap(scores);
    const signature = buildSignature(scores, effectiveEvidenceKey);
    activeSignatureRef.current = signature;

    const cached = readCache(signature);
    if (cached && attempt === 0) {
      setTrigger(cached);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const requestBody = {
      sessionId,
      scores: Object.fromEntries(model.dimensions.map((d) => [d.key, d.score])) as Record<TrustGapDimension, number>,
      evidence,
    };

    supabase.functions
      .invoke('identify-decision-trigger', { body: requestBody })
      .then(({ data, error: invokeError }) => {
        if (cancelled || activeSignatureRef.current !== signature) return;

        if (invokeError || (data && (data as { error?: string }).error)) {
          const message = (data as { error?: string })?.error ?? invokeError?.message ?? 'Unknown error';
          console.error('[useDecisionTrigger] invoke failed:', message);
          setError('We could not reveal your Decision Trigger right now.');
          setTrigger(null);
          return;
        }

        if (!isValidTrigger(data)) {
          console.error('[useDecisionTrigger] unexpected response shape:', data);
          setError('We could not reveal your Decision Trigger right now.');
          setTrigger(null);
          return;
        }

        writeCache(signature, data);
        setTrigger(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled || activeSignatureRef.current !== signature) return;
        console.error('[useDecisionTrigger] unexpected error:', err);
        setError('We could not reveal your Decision Trigger right now.');
        setTrigger(null);
      })
      .finally(() => {
        if (!cancelled && activeSignatureRef.current === signature) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scores ? buildSignature(scores, effectiveEvidenceKey) : null, sessionId, attempt]);

  return { trigger, isLoading, error, retry };
}
