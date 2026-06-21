import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TrustGapScorecard, type AvatarOverlay } from '../TrustGapScorecard';
import type { TrustGapInputScores } from '@/lib/trustGap';

// The interpretation hook fires a real edge-fn invoke on render; stub it (it has
// its own dedicated tests) so the grid render is deterministic and offline.
vi.mock('@/hooks/useTrustGapInterpretation', () => ({
  useTrustGapInterpretation: () => ({
    interpretation: null,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

const baseline: TrustGapInputScores = {
  overall: 50, insight: 50, distinctive: 50, empathetic: 50, authentic: 50,
};

describe('TrustGapScorecard multi-avatar compare grid', () => {
  it('renders the comparison grid with a column per overlay when 2+ overlays are supplied', () => {
    const overlays: AvatarOverlay[] = [
      { avatarId: 'a', avatarName: 'Busy Parent', scores: { overall: 73, insight: 75, distinctive: 60, empathetic: 85, authentic: 70 } },
      { avatarId: 'b', avatarName: 'Bargain Hunter', scores: { overall: 40, insight: 30, distinctive: 45, empathetic: 40, authentic: 45 } },
    ];

    render(
      <TrustGapScorecard scores={overlays[0].scores} baselineScores={baseline} overlays={overlays} />,
      { wrapper },
    );

    // Grid present; single-scorecard hero is NOT (early return swaps the view).
    expect(screen.getByTestId('trustgap-compare-grid')).toBeInTheDocument();
    expect(screen.queryByText('Your Trust Gap™ Score')).not.toBeInTheDocument();
    // Both avatar columns render.
    expect(screen.getByText('Busy Parent')).toBeInTheDocument();
    expect(screen.getByText('Bargain Hunter')).toBeInTheDocument();
    expect(screen.getByText('Baseline')).toBeInTheDocument();
  });

  it('keeps the single-avatar delta view when fewer than 2 overlays are supplied', () => {
    render(
      <TrustGapScorecard
        scores={{ overall: 73, insight: 75, distinctive: 60, empathetic: 85, authentic: 70 }}
        baselineScores={baseline}
        avatarName="Busy Parent"
        overlays={[{ avatarId: 'a', avatarName: 'Busy Parent', scores: baseline }]}
      />,
      { wrapper },
    );

    expect(screen.queryByTestId('trustgap-compare-grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('trustgap-compare-banner')).toBeInTheDocument();
  });
});
