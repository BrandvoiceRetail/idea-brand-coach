import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DecisionTriggerPanel } from '../DecisionTriggerPanel';
import { useDecisionTrigger } from '../useDecisionTrigger';
import type { TrustGapInputScores } from '@/lib/trustGap';
import type { TrustGapEvidence } from '@/services/interfaces/IProductDataService';

vi.mock('../useDecisionTrigger', () => ({ useDecisionTrigger: vi.fn() }));
const mockHook = vi.mocked(useDecisionTrigger);

const scores: TrustGapInputScores = { insight: 15, distinctive: 10, empathetic: 5, authentic: 20, overall: 50 };
const evidence: TrustGapEvidence = {
  listings: [{ asin: 'B0CJBQ7F5C', title: 'Card Binder', bullets: ['versatile storage solution'] }],
  topReviews: ['my favorite top loader binder'],
};

function renderPanel(overrides: Partial<Parameters<typeof DecisionTriggerPanel>[0]> = {}) {
  return render(
    <DecisionTriggerPanel
      scores={scores}
      evidence={evidence}
      evidenceKey="prod-1"
      sessionId="sess-1"
      isAuthenticated={true}
      {...overrides}
    />,
  );
}

describe('DecisionTriggerPanel', () => {
  beforeEach(() => mockHook.mockReset());

  it('shows the locked teaser when there is no evidence (and never calls the deriver enabled)', () => {
    mockHook.mockReturnValue({ trigger: null, isLoading: false, error: null, retry: vi.fn() });
    renderPanel({ evidence: undefined });
    expect(screen.getByText(/import your amazon listing/i)).toBeInTheDocument();
    // enabled flag (5th arg) must be false without evidence
    expect(mockHook.mock.calls[0][4]).toBe(false);
  });

  it('renders the three components and the brand anchor on a result', () => {
    mockHook.mockReturnValue({
      trigger: {
        id: 'dt-1',
        dominantType: 'Recognition',
        brandAnchor: 'like Dove, your customer buys the feeling of being understood',
        evidencePhrases: ['my favorite top loader binder', 'as the collection grows'],
        placementInstruction: 'Open bullet 1 with their own words (Contextual).',
        whyThisTrigger: 'Your reviews describe the product in personal collector language.',
      },
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
    renderPanel();
    expect(screen.getByText('Recognition')).toBeInTheDocument();
    expect(screen.getByText(/like Dove/i)).toBeInTheDocument();
    expect(screen.getByText(/my favorite top loader binder/i)).toBeInTheDocument();
    expect(screen.getByText(/Open bullet 1/i)).toBeInTheDocument();
  });

  it('NEVER surfaces a confidence score or percentage (feels like a finding, not a calculation)', () => {
    mockHook.mockReturnValue({
      trigger: {
        id: 'dt-1',
        dominantType: 'Recognition',
        brandAnchor: 'like Dove, ...',
        evidencePhrases: ['my favorite top loader binder'],
        placementInstruction: 'Lead with Contextual.',
        whyThisTrigger: 'Plain language reason.',
      },
      isLoading: false,
      error: null,
      retry: vi.fn(),
    });
    const { container } = renderPanel();
    // No percentage and no 0.x style confidence anywhere in the rendered panel.
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\b0\.\d/);
    expect(container.textContent).not.toMatch(/confidence/i);
  });

  it('shows an error with a retry affordance', () => {
    const retry = vi.fn();
    mockHook.mockReturnValue({ trigger: null, isLoading: false, error: 'We could not reveal your Decision Trigger right now.', retry });
    renderPanel();
    expect(screen.getByText(/could not reveal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
