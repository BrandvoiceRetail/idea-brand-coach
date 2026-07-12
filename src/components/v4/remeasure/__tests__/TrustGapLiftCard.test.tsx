import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrustGapLiftCard } from '../TrustGapLiftCard';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { TrustGapLift } from '@/types/v4Remeasure';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const LIFT: TrustGapLift = {
  overallBefore: 44,
  overallAfter: 53,
  overallDelta: 9,
  pillarBefore: { insight: 10, distinctive: 8, empathetic: 14, authentic: 12 },
  pillarAfter: { insight: 15, distinctive: 9, empathetic: 16, authentic: 13 },
  pillarDeltas: { insight: 5, distinctive: 1, empathetic: 2, authentic: 1 },
  biggestMover: { pillar: 'insight', delta: 5 },
  weakestNow: { pillar: 'distinctive', score: 9 },
  direction: 'improved',
  summary:
    'Trust Gap 44 → 53 (+9). The gap closed. Insight moved most (+5). Your weakest pillar now is distinctive (9/25) — that\'s the next single lever.',
  measuredAt: '2026-06-20',
};

describe('TrustGapLiftCard', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the deterministic before/after and per-pillar deltas', () => {
    render(<TrustGapLiftCard lift={LIFT} />);
    expect(screen.getByTestId('v4-lift-overall')).toHaveTextContent('44');
    expect(screen.getByTestId('v4-lift-overall')).toHaveTextContent('53');
    expect(screen.getByTestId('v4-lift-overall-delta')).toHaveTextContent('+9');
    expect(screen.getByTestId('v4-lift-pillar-insight')).toHaveTextContent('+5');
    expect(screen.getByTestId('v4-lift-summary')).toBeInTheDocument();
  });

  it('shows the honest needs-run state (no fabricated before/after) with only one run', () => {
    const onRunDiagnostic = vi.fn();
    render(<TrustGapLiftCard needsRun message="Re-run the diagnostic." onRunDiagnostic={onRunDiagnostic} />);
    expect(screen.getByTestId('v4-lift-needs-run')).toHaveTextContent(/re-run/i);
    expect(screen.queryByTestId('v4-lift-overall')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /re-run the diagnostic/i }));
    expect(onRunDiagnostic).toHaveBeenCalledOnce();
  });

  it('renders the loading state without firing the view event', () => {
    render(<TrustGapLiftCard isLoading />);
    expect(screen.getByTestId('v4-lift-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders an error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<TrustGapLiftCard message="History read failed." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-lift-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('emits the view event once with grounded properties', () => {
    render(<TrustGapLiftCard lift={LIFT} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_trust_gap_lift_viewed',
      expect.objectContaining({ state: 'data', direction: 'improved', overall_delta: 9 }),
    );
  });

  it('leaks no Tier-C internals in the rendered summary', () => {
    render(<TrustGapLiftCard lift={LIFT} />);
    expect(findTierViolations(LIFT.summary)).toEqual([]);
  });

  it('renders the per-customer side-by-side strip for a multi-avatar set', () => {
    render(
      <TrustGapLiftCard
        lift={{
          ...LIFT,
          perAvatar: [
            { avatarId: 'av-1', avatarName: 'Maya', overallDelta: 9, direction: 'improved' },
            { avatarId: 'av-2', avatarName: 'Rico', overallDelta: null, direction: null },
          ],
        }}
      />,
    );
    const strip = screen.getByTestId('v4-lift-per-avatar');
    expect(strip).toHaveTextContent('Maya');
    expect(strip).toHaveTextContent('+9');
    expect(strip).toHaveTextContent('Rico');
    expect(strip).toHaveTextContent(/no run yet/i);
  });

  it('hides the per-customer strip for a single-avatar lift', () => {
    render(<TrustGapLiftCard lift={LIFT} />);
    expect(screen.queryByTestId('v4-lift-per-avatar')).not.toBeInTheDocument();
  });
});
