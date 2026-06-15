/**
 * Tests for useTrustGapInterpretation — focused on the evidence-aware cache key.
 *
 * The contract: folding `evidenceKey` into the cache/fetch signature means an
 * import (new evidence) triggers exactly ONE fresh interpretation call, while the
 * no-evidence signature keeps serving its sessionStorage cache. We also verify the
 * evidence is forwarded in the request body and `evidencePresent` is surfaced.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTrustGapInterpretation } from '../useTrustGapInterpretation';
import { supabase } from '@/integrations/supabase/client';
import type { TrustGapInputScores } from '@/lib/trustGap';
import type { TrustGapEvidence } from '@/services/interfaces/IProductDataService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const invokeMock = vi.mocked(supabase.functions.invoke);

const SCORES: TrustGapInputScores = {
  insight: 18,
  distinctive: 12,
  empathetic: 20,
  authentic: 15,
};

const EVIDENCE: TrustGapEvidence = {
  listings: [{ asin: 'B0CJBQ7F5C', title: 'Test Binder', bullets: ['Premium', 'Side-loading'] }],
  topReviews: ['★5 — Built like a tank.'],
};

function makeResponse(evidencePresent: boolean): { data: unknown; error: null } {
  return {
    data: {
      interpretations: {
        insight: 'Insight read.',
        distinctive: 'Distinctive read.',
        empathetic: 'Empathetic read.',
        authentic: 'Authentic read.',
      },
      primaryGap: 'distinctive',
      primaryGapSummary: 'Your distinctiveness is the gap.',
      evidencePresent,
    },
    error: null,
  };
}

describe('useTrustGapInterpretation cache key', () => {
  beforeEach(() => {
    sessionStorage.clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(makeResponse(false));
  });

  it('serves cache (no second call) for identical scores with no evidence', async () => {
    const first = renderHook(() => useTrustGapInterpretation(SCORES));
    await waitFor(() => expect(first.result.current.interpretation).not.toBeNull());
    expect(invokeMock).toHaveBeenCalledTimes(1);

    // Second mount, identical scores + no evidence → cache hit, no new invoke.
    const second = renderHook(() => useTrustGapInterpretation(SCORES));
    await waitFor(() => expect(second.result.current.interpretation).not.toBeNull());
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('refetches once when an evidenceKey is introduced for the same scores', async () => {
    invokeMock.mockResolvedValueOnce(makeResponse(false));
    const noEvidence = renderHook(() => useTrustGapInterpretation(SCORES));
    await waitFor(() => expect(noEvidence.result.current.interpretation).not.toBeNull());
    expect(invokeMock).toHaveBeenCalledTimes(1);

    // Same scores, but now grounded with evidence → distinct signature → one refetch.
    invokeMock.mockResolvedValueOnce(makeResponse(true));
    const withEvidence = renderHook(() =>
      useTrustGapInterpretation(SCORES, EVIDENCE, 'prod-1'),
    );
    await waitFor(() => expect(withEvidence.result.current.interpretation).not.toBeNull());
    expect(invokeMock).toHaveBeenCalledTimes(2);

    // The no-evidence signature still serves its cache (no extra call).
    const noEvidenceAgain = renderHook(() => useTrustGapInterpretation(SCORES));
    await waitFor(() => expect(noEvidenceAgain.result.current.interpretation).not.toBeNull());
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('sends evidence in the request body and exposes evidencePresent', async () => {
    invokeMock.mockResolvedValue(makeResponse(true));
    const { result } = renderHook(() =>
      useTrustGapInterpretation(SCORES, EVIDENCE, 'prod-1'),
    );

    await waitFor(() => expect(result.current.interpretation).not.toBeNull());

    expect(invokeMock).toHaveBeenCalledWith(
      'diagnostic-interpretation',
      expect.objectContaining({ body: expect.objectContaining({ evidence: EVIDENCE }) }),
    );
    expect(result.current.interpretation?.evidencePresent).toBe(true);
  });

  it('reports evidencePresent false when no evidence is supplied', async () => {
    const { result } = renderHook(() => useTrustGapInterpretation(SCORES));
    await waitFor(() => expect(result.current.interpretation).not.toBeNull());

    const body = invokeMock.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('evidence');
    expect(result.current.interpretation?.evidencePresent).toBe(false);
  });
});
