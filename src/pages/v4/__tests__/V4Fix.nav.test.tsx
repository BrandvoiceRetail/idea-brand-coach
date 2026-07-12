import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * V4Fix Fix-stage sub-navigation (per ux-design-fix-navigation.md). The heavy
 * funnel children are stubbed to the callbacks under test; FixBreadcrumb is kept
 * REAL so we exercise the actual drill-down trail. Asserts the three spec flows:
 * drill map→detail→fix→crumb-up, tab-switch reset, and Testing→piece return.
 */

const selectPieceSpy = vi.fn();
const clearSelectionSpy = vi.fn();
const openTestSpy = vi.fn(async () => true);

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

vi.mock('@/contexts/AvatarContext', () => ({
  useAvatarContext: () => ({ avatars: [], setCurrentAvatar: vi.fn() }),
}));

// Stage/metric/taxonomy config reduced to safe defaults so the test doesn't
// couple to taxonomy internals.
vi.mock('@/config/v4Funnel', () => ({
  FUNNEL_JOBS: new Proxy({}, { get: () => ({ primaryMetrics: ['cvr'] }) }),
  METRIC_META: new Proxy({}, { get: () => ({ label: 'CVR' }) }),
}));
vi.mock('@/config/touchpointTaxonomy', () => ({
  getTouchpoint: () => ({ label: 'Amazon listing' }),
  getStages: () => [{ id: 'awareness', label: 'Awareness' }],
}));

// Stateful useFixRun: selectPiece/clearSelection drive selectedPiece + re-render.
vi.mock('@/hooks/useFixRun', async () => {
  const React = await import('react');
  return {
    useFixRun: () => {
      const [selectedPiece, setSel] = React.useState<unknown>(null);
      return {
        hasAvatar: true,
        avatarId: 'a1',
        avatarName: 'Maya',
        pieces: [],
        piecesLoading: false,
        piecesError: null,
        drift: [],
        tests: [],
        testsLoading: false,
        testsError: null,
        advancingTestId: null,
        selectedPiece,
        pieceMetrics: null,
        pieceMetricsLoading: false,
        brief: null,
        briefLoading: false,
        briefError: null,
        openTestSubmitting: false,
        openTestError: null,
        load: vi.fn(),
        selectPiece: (id: string) => {
          selectPieceSpy(id);
          setSel({ id, touchpointId: 't1', stage: 'awareness', status: 'leaking', storedContent: { title: 'x' } });
        },
        clearSelection: () => {
          clearSelectionSpy();
          setSel(null);
        },
        retryPieceMetrics: vi.fn(),
        onPieceAdded: vi.fn(),
        generateRewrite: vi.fn(),
        confirmClaim: vi.fn(),
        openTest: openTestSpy,
        markAssetCreated: vi.fn(),
        markAssetLive: vi.fn(),
        recheckDrift: vi.fn(),
      };
    },
  };
});

// Lightweight child stubs — expose only the callbacks the nav flows fire.
vi.mock('@/components/v4/fix/DriftBanner', () => ({ DriftBanner: () => null }));
vi.mock('@/components/v4/fix/AddPieceDialog', () => ({ AddPieceDialog: () => null }));
vi.mock('@/components/v4/fix/FunnelMap', () => ({
  FunnelMap: ({ onSelectPiece }: { onSelectPiece: (id: string) => void }) => (
    <button data-testid="stub-select-piece" onClick={() => onSelectPiece('piece-1')}>select</button>
  ),
}));
vi.mock('@/components/v4/fix/FunnelPieceDetail', () => ({
  FunnelPieceDetail: ({ onGetBrief }: { onGetBrief: () => void }) => (
    <button data-testid="stub-get-brief" onClick={onGetBrief}>get brief</button>
  ),
}));
vi.mock('@/components/v4/fix/FixTestPanel', () => ({
  FixTestPanel: ({ onOpenTest }: { onOpenTest: () => void }) => (
    <button data-testid="stub-open-test" onClick={onOpenTest}>open test</button>
  ),
}));
vi.mock('@/components/v4/fix/TestingLiftTab', () => ({
  TestingLiftTab: () => <div data-testid="stub-testing">testing</div>,
}));

import V4Fix from '../V4Fix';

function renderFix(): void {
  render(
    <MemoryRouter>
      <V4Fix />
    </MemoryRouter>,
  );
}

const breadcrumb = (): HTMLElement => screen.getByTestId('v4-fix-breadcrumb');

describe('V4Fix — Fix-stage sub-navigation', () => {
  beforeEach(() => {
    selectPieceSpy.mockClear();
    clearSelectionSpy.mockClear();
    openTestSpy.mockClear();
  });

  it('drills map → detail → fix and the breadcrumb jumps back up to map', () => {
    renderFix();
    // map: no breadcrumb yet
    expect(screen.queryByTestId('v4-fix-breadcrumb')).not.toBeInTheDocument();

    // → detail
    fireEvent.click(screen.getByTestId('stub-select-piece'));
    expect(selectPieceSpy).toHaveBeenCalledWith('piece-1');
    expect(within(breadcrumb()).getByText('Amazon listing')).toHaveAttribute('aria-current', 'page');

    // → fix
    fireEvent.click(screen.getByTestId('stub-get-brief'));
    expect(within(breadcrumb()).getByText('Fix')).toHaveAttribute('aria-current', 'page');

    // breadcrumb "Funnel" crumb → clears selection + returns to map
    fireEvent.click(within(breadcrumb()).getByRole('button', { name: /funnel/i }));
    expect(clearSelectionSpy).toHaveBeenCalled();
    expect(screen.getByTestId('stub-select-piece')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-fix-breadcrumb')).not.toBeInTheDocument();
  });

  it('resets the Funnel drill-down when the top Funnel tab is tapped', () => {
    renderFix();
    fireEvent.click(screen.getByTestId('stub-select-piece')); // into detail
    clearSelectionSpy.mockClear();
    fireEvent.click(screen.getByTestId('v4-fix-tab-testing')); // lateral switch
    fireEvent.click(screen.getByTestId('v4-fix-tab-funnel')); // back to Funnel
    expect(clearSelectionSpy).toHaveBeenCalled();
    expect(screen.getByTestId('stub-select-piece')).toBeInTheDocument(); // map, not stale detail
  });

  it('offers a route back to the worked piece from Testing & Lift (no dead-end)', async () => {
    renderFix();
    fireEvent.click(screen.getByTestId('stub-select-piece')); // detail
    fireEvent.click(screen.getByTestId('stub-get-brief')); // fix
    fireEvent.click(screen.getByTestId('stub-open-test')); // open test → Testing & Lift

    const back = await screen.findByTestId('v4-fix-testing-back-to-piece');
    expect(back).toHaveTextContent(/back to amazon listing/i);

    selectPieceSpy.mockClear();
    fireEvent.click(back);
    expect(selectPieceSpy).toHaveBeenCalledWith('piece-1');
    await waitFor(() => expect(screen.getByTestId('v4-fix-breadcrumb')).toBeInTheDocument());
  });
});
