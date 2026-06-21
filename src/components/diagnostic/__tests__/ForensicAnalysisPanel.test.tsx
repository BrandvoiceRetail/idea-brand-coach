import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { ForensicAnalysisPanel } from '../ForensicAnalysisPanel';
import { supabase } from '@/integrations/supabase/client';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { toast } from 'sonner';
import type { TrustGapInputScores } from '@/lib/trustGap';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// DecisionTriggerPanel calls useDecisionTrigger on mount; stub the hook so the
// pre-computed `result` path renders without any network.
vi.mock('@/components/decision-trigger/useDecisionTrigger', () => ({
  useDecisionTrigger: () => ({ trigger: null, isLoading: false, error: null, retry: vi.fn() }),
}));

const selfReport: TrustGapInputScores = {
  insight: 60,
  distinctive: 40,
  empathetic: 20,
  authentic: 80,
  overall: 50,
};

function successResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      ok: true,
      asin: 'B0CJBQ7F5C',
      reviews_analyzed: 8,
      thin_corpus: false,
      forensic_scores: { insight: 15, distinctive: 10, empathetic: 6, authentic: 20, overall: 51 },
      primary_gap: 'empathetic',
      interpretation: {
        dimensions: [
          { dimension: 'Empathy', brand_read: 'Customers feel unseen at the moment of choice.', grounding: 'evidence' },
        ],
        primaryGapSummary: 'Your empathy gap is the first thing to close.',
      },
      decision_trigger: {
        dominant_type: 'Recognition',
        brand_anchor: 'like Dove, your customer buys the feeling of being understood',
        evidence_phrases: ['my favorite top loader binder'],
        placement_instruction: 'Open bullet 1 with their own words (Contextual).',
        why_this_trigger: 'Your reviews describe the product in personal collector language.',
        confidence: 0.0,
      },
      listing: { title: 'Card Binder', bullets: ['versatile storage'] },
      ...overrides,
    },
    error: null,
  };
}

function renderPanel(): void {
  render(<ForensicAnalysisPanel selfReportScores={selfReport} defaultAsin="B0CJBQ7F5C" />);
}

describe('ForensicAnalysisPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs the analysis with the asin + self_report_scores payload and renders the grounded report', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(successResponse());
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /run my forensic analysis/i }));

    await waitFor(() => expect(screen.getByText(/your forensic trust gap/i)).toBeInTheDocument());

    // Exact invoke payload (the shared contract).
    expect(supabase.functions.invoke).toHaveBeenCalledWith('run-forensic-analysis', {
      body: { asin: 'B0CJBQ7F5C', self_report_scores: selfReport },
    });

    // Grounded badge with the real review count + the forensic decision trigger.
    expect(screen.getByText(/grounded in your 8 real reviews/i)).toBeInTheDocument();
    expect(screen.getByText('Recognition')).toBeInTheDocument();
    expect(screen.getByText(/customers feel unseen/i)).toBeInTheDocument();

    // Start + completed analytics, no PII.
    expect(captureAlphaEvent).toHaveBeenCalledWith('forensic_analysis_started', { has_asin: true });
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'forensic_analysis_completed',
      expect.objectContaining({ ok: true, reviews_analyzed: 8, thin_corpus: false, primary_gap: 'empathetic' }),
    );
  });

  it('shows the thin-corpus caveat when reviews are sparse', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(
      successResponse({ reviews_analyzed: 3, thin_corpus: true }),
    );
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /run my forensic analysis/i }));

    await waitFor(() => expect(screen.getByText(/a thin sample/i)).toBeInTheDocument());
    expect(screen.getByText(/treat this read as directional/i)).toBeInTheDocument();
  });

  it('surfaces a toast and an error state on a 422 (ok:false) response', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ok: false, error: 'no usable corpus' },
      error: null,
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /run my forensic analysis/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(captureAlphaEvent).toHaveBeenCalledWith('forensic_analysis_completed', { ok: false });
    // Still on the input form (run button present again), report not rendered.
    expect(screen.getByRole('button', { name: /run my forensic analysis/i })).toBeInTheDocument();
    expect(screen.queryByText(/your forensic trust gap/i)).not.toBeInTheDocument();
  });

  it('disables the run button until a valid ASIN is present', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue(successResponse());
    render(<ForensicAnalysisPanel selfReportScores={selfReport} />);
    expect(screen.getByRole('button', { name: /run my forensic analysis/i })).toBeDisabled();
  });
});
