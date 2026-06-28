/**
 * FunnelPieceDetail tests — proves the "did this piece do its job?" surface:
 *  - renders the stored text-only copy and the journey-stage + job header,
 *  - degrades honestly across the metric seam (loading / no_data / data) and
 *    NEVER fabricates a metric (missing → "—"),
 *  - emits a PostHog view event on mount and an event per metric→fix action.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FunnelPieceDetail } from '../FunnelPieceDetail';
import { FUNNEL_PIECE_EVENTS } from '../funnelPieceDetailEvents';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { DataResult, FunnelPiece, PieceMetrics } from '@/types/v4Fix';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

const capture = vi.mocked(captureAlphaEvent);

function makePiece(overrides: Partial<FunnelPiece> = {}): FunnelPiece {
  return {
    id: 'piece-1',
    touchpointId: 'amazon_listing_copy',
    stage: 'consideration',
    channel: 'amazon',
    status: 'leaking',
    job: 'Deliver the promise the ad made and convert the visit into an order.',
    storedContent: {
      title: '216-Card Toploader Binder, Vintage Leather',
      bullets: ['BUILT FOR THE LONG HAUL', 'HOLDS 216 TOPLOADERS'],
      price: '$24.99',
      rating: 4.3,
      reviewCount: 1003,
      updatedAt: '2026-06-12T00:00:00.000Z',
    },
    ...overrides,
  };
}

const METRICS_OK: DataResult<PieceMetrics> = {
  status: 'ok',
  data: {
    pieceId: 'piece-1',
    range: '30d',
    metrics: {
      cvr: { key: 'cvr', value: 10.7, source: 'derived', derived: true },
      aov: { key: 'aov', value: 25.02, source: 'derived', derived: true },
      clicks: { key: 'clicks', value: 9360, source: 'amazon_ads', derived: false },
      orders: { key: 'orders', value: 1003, source: 'amazon_sp', derived: false },
    },
    noData: [],
  },
};

beforeEach(() => capture.mockClear());

describe('FunnelPieceDetail', () => {
  it('renders stored text copy, the stage pill, and the job — and emits a view event', () => {
    render(
      <FunnelPieceDetail piece={makePiece()} pieceLabel="Amazon Listing — TLB216" metrics={METRICS_OK} />,
    );

    expect(screen.getByText('Amazon Listing — TLB216')).toBeInTheDocument();
    expect(screen.getByTestId('funnel-piece-stage')).toHaveTextContent('Consideration');
    expect(screen.getByTestId('funnel-piece-job')).toHaveTextContent(/convert the visit/i);
    expect(screen.getByTestId('funnel-piece-stored-title')).toHaveTextContent('Vintage Leather');

    expect(capture).toHaveBeenCalledWith(FUNNEL_PIECE_EVENTS.VIEWED, {
      piece_id: 'piece-1',
      stage: 'consideration',
      status: 'leaking',
    });
  });

  it('shows the metrics skeleton while loading and no metric values', () => {
    render(
      <FunnelPieceDetail
        piece={makePiece()}
        pieceLabel="Amazon Listing — TLB216"
        metrics={METRICS_OK}
        metricsLoading
      />,
    );
    expect(screen.getByTestId('funnel-piece-metrics-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('funnel-piece-primary')).not.toBeInTheDocument();
  });

  it('shows an honest no-data message (never a fabricated number)', () => {
    const noData: DataResult<PieceMetrics> = {
      status: 'no_data',
      reason: 'Windsor is not connected for this channel yet.',
    };
    render(
      <FunnelPieceDetail piece={makePiece()} pieceLabel="Amazon Listing — TLB216" metrics={noData} />,
    );
    expect(screen.getByTestId('funnel-piece-metrics-empty')).toHaveTextContent(/not connected/i);
    expect(screen.queryByTestId('funnel-piece-primary')).not.toBeInTheDocument();
  });

  it('renders the primary job metrics big, secondary pills, and a sources line on data', () => {
    render(
      <FunnelPieceDetail piece={makePiece()} pieceLabel="Amazon Listing — TLB216" metrics={METRICS_OK} />,
    );
    // consideration → primary metrics are cvr + aov
    expect(screen.getByTestId('funnel-piece-metric-cvr')).toHaveTextContent('10.7%');
    expect(screen.getByTestId('funnel-piece-metric-aov')).toHaveTextContent('$25.02');
    // secondary pills carry the rest
    expect(screen.getByTestId('funnel-piece-pill-clicks')).toHaveTextContent('9,360');
    // sources line names real sources + flags derived, never fakes
    const sources = screen.getByTestId('funnel-piece-sources');
    expect(sources).toHaveTextContent('Amazon Ads');
    expect(sources).toHaveTextContent('Seller Central');
    expect(sources).toHaveTextContent(/derived/i);
  });

  it('renders an honest "—" for a missing primary metric', () => {
    const partial: DataResult<PieceMetrics> = {
      status: 'ok',
      data: { pieceId: 'piece-1', range: '30d', metrics: {}, noData: ['cvr', 'aov'] },
    };
    render(
      <FunnelPieceDetail piece={makePiece()} pieceLabel="Amazon Listing — TLB216" metrics={partial} />,
    );
    expect(screen.getByTestId('funnel-piece-metric-cvr')).toHaveTextContent('—');
  });

  it('emits action events for brief / test / check', () => {
    const onGetBrief = vi.fn();
    const onOpenTest = vi.fn();
    const onCheckAsset = vi.fn();
    render(
      <FunnelPieceDetail
        piece={makePiece()}
        pieceLabel="Amazon Listing — TLB216"
        metrics={METRICS_OK}
        onGetBrief={onGetBrief}
        onOpenTest={onOpenTest}
        onCheckAsset={onCheckAsset}
      />,
    );

    fireEvent.click(screen.getByTestId('funnel-piece-brief'));
    fireEvent.click(screen.getByTestId('funnel-piece-test'));
    fireEvent.click(screen.getByTestId('funnel-piece-check'));

    expect(onGetBrief).toHaveBeenCalledOnce();
    expect(onOpenTest).toHaveBeenCalledOnce();
    expect(onCheckAsset).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith(FUNNEL_PIECE_EVENTS.BRIEF, { piece_id: 'piece-1' });
    expect(capture).toHaveBeenCalledWith(FUNNEL_PIECE_EVENTS.TEST, { piece_id: 'piece-1' });
    expect(capture).toHaveBeenCalledWith(FUNNEL_PIECE_EVENTS.CHECK, { piece_id: 'piece-1' });
  });
});
