import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GapDecisionTriggerPanel } from '../GapDecisionTriggerPanel';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { TrustGapView, DecisionTriggerView } from '@/types/v4Analyse';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const TRUST_GAP: TrustGapView = {
  overall: 62,
  pillars: [
    { pillar: 'insight', score: 18, interpretation: 'You know the buyer well.' },
    { pillar: 'distinctive', score: 11, interpretation: 'You look like everyone else.' },
    { pillar: 'empathetic', score: 16, interpretation: 'You speak to the pain.' },
    { pillar: 'authentic', score: 17, interpretation: 'Your proof rings true.' },
  ],
  primaryGap: 'distinctive',
  primaryGapSummary: 'Stand out: nothing in your listing is yours alone yet.',
};

const TRIGGER: DecisionTriggerView = {
  type: 'Identity',
  brandAnchor: 'Like Dove, your customer buys who they become, not the soap.',
  evidencePhrases: ['finally something that feels like me', 'not just another generic brand'],
  placementInstruction: 'Lead your hero image with the customer, not the box.',
  whyThisTrigger: 'Reviewers keep describing themselves, not the features.',
  confidence: 0.78,
};

describe('GapDecisionTriggerPanel', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the Trust Gap score, pillars, trigger and verbatim evidence', () => {
    render(<GapDecisionTriggerPanel trustGap={TRUST_GAP} trigger={TRIGGER} />);
    expect(screen.getByTestId('v4-gap-trigger-trustgap')).toHaveTextContent('62');
    expect(screen.getByTestId('v4-gap-pillar-distinctive')).toBeInTheDocument();
    expect(screen.getByTestId('v4-gap-trigger-decision')).toHaveTextContent('Identity');
    expect(screen.getByTestId('v4-gap-trigger-evidence')).toHaveTextContent(/feels like me/i);
  });

  it('shows an honest "not enough evidence yet" state with no fabricated numbers', () => {
    render(<GapDecisionTriggerPanel />);
    expect(screen.getByTestId('v4-gap-trigger-empty')).toHaveTextContent(/not enough evidence yet/i);
    expect(screen.queryByTestId('v4-gap-trigger-trustgap')).not.toBeInTheDocument();
    expect(screen.queryByTestId('v4-gap-trigger-decision')).not.toBeInTheDocument();
  });

  it('renders the loading state without firing the view event', () => {
    render(<GapDecisionTriggerPanel isLoading />);
    expect(screen.getByTestId('v4-gap-trigger-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders the error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<GapDecisionTriggerPanel error="Service timed out." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-gap-trigger-error')).toHaveTextContent(/timed out/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('emits the PostHog view event once with grounded properties', () => {
    render(<GapDecisionTriggerPanel trustGap={TRUST_GAP} trigger={TRIGGER} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_decision_trigger_viewed', expect.objectContaining({
      has_trust_gap: true,
      has_trigger: true,
      trust_gap_overall: 62,
      trigger_type: 'Identity',
      state: 'data',
    }));
  });

  it('leaks no Tier-C internals across any string it renders', () => {
    const strings = [
      TRUST_GAP.primaryGapSummary,
      ...TRUST_GAP.pillars.map((p) => p.interpretation),
      TRIGGER.type,
      TRIGGER.brandAnchor,
      TRIGGER.placementInstruction,
      TRIGGER.whyThisTrigger,
      ...TRIGGER.evidencePhrases,
    ];
    for (const text of strings) {
      expect(findTierViolations(text)).toEqual([]);
    }
  });
});
