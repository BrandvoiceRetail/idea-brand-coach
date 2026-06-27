import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoveBriefClaimGate } from '../MoveBriefClaimGate';
import { MOVE_BRIEF_EVENTS } from '../moveBriefEvents';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { BriefSlots, ClaimGateItem } from '@/types/v4Analyse';

// Stub the PostHog client so the component never reaches the real SDK in tests.
const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const BRIEF: BriefSlots = {
  titleFormula: { brief: 'Lead with the outcome', exampleOutput: 'Sleep Mask for Deep Rest' },
  bullets: [{ element: 'Benefit', brief: 'State the win', exampleOutput: 'Blocks 100% of light' }],
  imageBrief: Array.from({ length: 7 }, (_, i) => ({
    slot: i === 0 ? 'Hero' : `Image ${i + 1}`,
    intent: `Intent ${i + 1}`,
    brief: `Shot brief ${i + 1}`,
  })),
  ppcKeywords: { tierA: ['sleep mask'], tierB: ['eye mask'], tierC: [] },
  claimGate: [],
};

const CLAIMS: ClaimGateItem[] = [
  { claim: 'Blocks 100% of light', status: 'unconfirmed', slot: 1, reason: 'No lab test on file' },
  { claim: 'Made from organic cotton', status: 'confirmed' },
];

const baseProps = {
  brief: BRIEF,
  claims: CLAIMS,
  onConfirmClaim: vi.fn(),
  onExport: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MoveBriefClaimGate — claim gate firewall', () => {
  it('renders the 7-slot image brief', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`v4-brief-slot-${i}`)).toBeInTheDocument();
    }
  });

  it('flags unconfirmed claims as NOT shipped as fact, confirmed ones as cleared', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    expect(screen.getByTestId('v4-claim-0')).toHaveAttribute('data-status', 'unconfirmed');
    expect(screen.getByTestId('v4-claim-status-0')).toHaveTextContent(/not shipped as fact/i);
    expect(screen.getByTestId('v4-claim-1')).toHaveAttribute('data-status', 'confirmed');
    expect(screen.getByTestId('v4-claim-status-1')).toHaveTextContent(/ship as fact/i);
  });

  it('shows a confirm action ONLY for unconfirmed claims', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    expect(screen.getByTestId('v4-claim-confirm-0')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-claim-confirm-1')).not.toBeInTheDocument();
  });

  it('fires onConfirmClaim + analytics when a claim is confirmed', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    fireEvent.click(screen.getByTestId('v4-claim-confirm-0'));
    expect(baseProps.onConfirmClaim).toHaveBeenCalledWith(CLAIMS[0], 0);
    expect(captureAlphaEvent).toHaveBeenCalledWith(MOVE_BRIEF_EVENTS.CLAIM_CONFIRMED, expect.any(Object));
  });

  it('fires onExport + analytics and warns about unconfirmed claims', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    expect(screen.getByTestId('v4-export-warning')).toHaveTextContent(/unconfirmed/i);
    fireEvent.click(screen.getByTestId('v4-brief-export'));
    expect(baseProps.onExport).toHaveBeenCalled();
    expect(captureAlphaEvent).toHaveBeenCalledWith(MOVE_BRIEF_EVENTS.EXPORTED, expect.any(Object));
  });

  it('emits a viewed event once the brief resolves', () => {
    render(<MoveBriefClaimGate {...baseProps} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith(MOVE_BRIEF_EVENTS.VIEWED, expect.any(Object));
  });
});

describe('MoveBriefClaimGate — honest degradation', () => {
  it('renders a loading state and no brief', () => {
    render(<MoveBriefClaimGate {...baseProps} isLoading />);
    expect(screen.getByText(/writing your design brief/i)).toBeInTheDocument();
    expect(screen.queryByTestId('v4-brief-image-slots')).not.toBeInTheDocument();
  });

  it('renders an error banner with a retry, never a fabricated brief', () => {
    const onRetry = vi.fn();
    render(<MoveBriefClaimGate {...baseProps} brief={null} error="Couldn't reach the coach." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-brief-error')).toHaveTextContent(/couldn't reach the coach/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders an honest empty state when there is no brief', () => {
    render(<MoveBriefClaimGate {...baseProps} brief={null} />);
    expect(screen.getByTestId('v4-brief-empty')).toBeInTheDocument();
  });

  it('does not emit a viewed event while loading or erroring', () => {
    render(<MoveBriefClaimGate {...baseProps} isLoading />);
    expect(captureAlphaEvent).not.toHaveBeenCalledWith(MOVE_BRIEF_EVENTS.VIEWED, expect.any(Object));
  });
});

describe('MoveBriefClaimGate — terminology guardrail', () => {
  it('leaks no Tier-C internals in its visible copy', () => {
    const { container } = render(<MoveBriefClaimGate {...baseProps} />);
    expect(findTierViolations(container.textContent ?? '')).toEqual([]);
  });
});
