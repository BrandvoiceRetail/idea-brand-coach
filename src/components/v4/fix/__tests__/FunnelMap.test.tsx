import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FunnelMap } from '../FunnelMap';
import type { FunnelPiece, JobVerdict, PieceMetrics } from '@/types/v4Fix';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));
import { captureAlphaEvent } from '@/lib/posthogClient';

/** Build a funnel piece. `touchpointId` drives the stage's job + label. */
const piece = (
  id: string,
  status: JobVerdict,
  touchpointId: string,
  overrides: Partial<FunnelPiece> = {},
): FunnelPiece => ({
  id,
  touchpointId,
  // awareness touchpoint by default; consideration when the id says so.
  stage: touchpointId === 'amazon_listing_copy' ? 'consideration' : 'awareness',
  channel: 'amazon',
  status,
  job: 'Earn the click.',
  storedContent: { title: null, bullets: [], price: null, rating: null, reviewCount: null, updatedAt: null },
  ...overrides,
});

const metrics = (pieceId: string, values: Partial<Record<string, number | null>>): PieceMetrics => ({
  pieceId,
  range: '30d',
  metrics: Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k,
      { key: k, value: v, source: v === null ? null : 'amazon_ads', derived: false },
    ]),
  ) as PieceMetrics['metrics'],
  noData: [],
});

describe('FunnelMap — Funnel-by-Job map', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a loading skeleton when pieces is null', () => {
    render(<FunnelMap pieces={null} onSelectPiece={vi.fn()} />);
    expect(screen.getAllByTestId('funnel-map-loading').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('funnel-map-empty')).not.toBeInTheDocument();
  });

  it('renders an explicit empty state (never a faked map) with no pieces', () => {
    render(<FunnelMap pieces={[]} onSelectPiece={vi.fn()} />);
    expect(screen.getByTestId('funnel-map-empty')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalledWith('v4_funnel_map_viewed', expect.anything());
  });

  it('renders an error + retry instead of inventing data', () => {
    const onRetry = vi.fn();
    render(
      <FunnelMap
        pieces={null}
        error="Couldn't reach the coach — try again."
        onRetry={onRetry}
        onSelectPiece={vi.fn()}
      />,
    );
    expect(screen.getByTestId('funnel-map-error')).toHaveTextContent(/couldn't reach the coach/i);
    fireEvent.click(screen.getByTestId('funnel-map-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_funnel_map_retry', {});
  });

  it('leads each card with its job + verdict, shows job metrics, and fires the view event once', () => {
    const pieces = [
      piece('p1', 'doing_job', 'amazon_main_image'),
      piece('p2', 'leaking', 'amazon_listing_copy'),
    ];
    const metricsByPiece = {
      // awareness job metrics: impressions, ctr
      p1: metrics('p1', { impressions: 312000, ctr: 0.051 }),
      // consideration job metrics: cvr, aov
      p2: metrics('p2', { cvr: 0.107, aov: 25.02 }),
    };
    render(
      <FunnelMap pieces={pieces} metricsByPiece={metricsByPiece} coveragePct={50} onSelectPiece={vi.fn()} />,
    );

    // Job line (Tier-A) + verdict.
    expect(screen.getByTestId('funnel-piece-p1')).toHaveTextContent('JOB');
    expect(screen.getByTestId('funnel-piece-verdict-p1')).toHaveTextContent(/doing its job/i);
    expect(screen.getByTestId('funnel-piece-status-p2')).toHaveTextContent(/Leaking/i);

    // Formatted job metrics: 312K traffic, 5.1% CTR, 10.7% CVR, $25.02 AOV.
    expect(screen.getByTestId('funnel-piece-p1')).toHaveTextContent('312K');
    expect(screen.getByTestId('funnel-piece-p1')).toHaveTextContent('5.1%');
    expect(screen.getByTestId('funnel-piece-p2')).toHaveTextContent('10.7%');
    expect(screen.getByTestId('funnel-piece-p2')).toHaveTextContent('$25.02');

    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_funnel_map_viewed',
      expect.objectContaining({ piece_count: 2, doing_job: 1, leaking: 1 }),
    );
  });

  it('shows an honest "—" for a job metric with no backing value', () => {
    const pieces = [piece('p1', 'leaking', 'amazon_listing_copy')];
    // No metricsByPiece at all → both consideration job metrics are unknown.
    render(<FunnelMap pieces={pieces} onSelectPiece={vi.fn()} />);
    expect(screen.getByTestId('funnel-piece-p1')).toHaveTextContent('—');
    expect(screen.getByTestId('funnel-piece-p1')).not.toHaveTextContent('%');
  });

  it('derives the coverage meter + 4-stat strip from the pieces (never fabricated)', () => {
    const pieces = [
      piece('a', 'doing_job', 'amazon_main_image'),
      piece('b', 'doing_job', 'organic_social_profile'),
      piece('c', 'leaking', 'amazon_listing_copy'),
      piece('d', 'off_brand', 'amazon_main_image'),
      piece('e', 'missing', 'amazon_main_image'),
    ];
    render(<FunnelMap pieces={pieces} onSelectPiece={vi.fn()} />);
    // doing_job(2) ÷ total(5) = 40%
    expect(screen.getByTestId('funnel-coverage-value')).toHaveTextContent('40%');
    expect(screen.getByTestId('funnel-stat-doing-job')).toHaveTextContent('2');
    expect(screen.getByTestId('funnel-stat-leaking')).toHaveTextContent('1');
    expect(screen.getByTestId('funnel-stat-off-brand')).toHaveTextContent('1');
    expect(screen.getByTestId('funnel-stat-missing')).toHaveTextContent('1');
  });

  it('prefers the supplied coverage % over the derived ratio', () => {
    const pieces = [piece('a', 'doing_job', 'amazon_main_image'), piece('b', 'missing', 'amazon_main_image')];
    render(<FunnelMap pieces={pieces} coveragePct={62} onSelectPiece={vi.fn()} />);
    expect(screen.getByTestId('funnel-coverage-value')).toHaveTextContent('62%');
  });

  it('opens a real piece with its brand_asset id and emits the open event', () => {
    const onSelectPiece = vi.fn();
    render(<FunnelMap pieces={[piece('asset-9', 'doing_job', 'amazon_main_image')]} onSelectPiece={onSelectPiece} />);
    fireEvent.click(screen.getByTestId('funnel-piece-asset-9'));
    expect(onSelectPiece).toHaveBeenCalledWith('asset-9');
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_funnel_asset_opened',
      expect.objectContaining({ piece_id: 'asset-9', status: 'doing_job' }),
    );
  });

  it('routes a missing slot to Add a piece instead of opening an empty detail', () => {
    const onSelectPiece = vi.fn();
    const onAddPiece = vi.fn();
    render(
      <FunnelMap
        pieces={[piece('m1', 'missing', 'amazon_main_image')]}
        onSelectPiece={onSelectPiece}
        onAddPiece={onAddPiece}
      />,
    );
    fireEvent.click(screen.getByTestId('funnel-piece-m1'));
    expect(onSelectPiece).not.toHaveBeenCalled();
    expect(onAddPiece).toHaveBeenCalledTimes(1);
  });

  it('wires the Add piece toolbar action with its event (no Windsor pull action)', () => {
    const onAddPiece = vi.fn();
    render(
      <FunnelMap
        pieces={[piece('a', 'doing_job', 'amazon_main_image')]}
        onSelectPiece={vi.fn()}
        onAddPiece={onAddPiece}
      />,
    );
    fireEvent.click(screen.getByTestId('funnel-add-piece'));
    expect(onAddPiece).toHaveBeenCalledTimes(1);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_funnel_add_piece_clicked', { from: 'toolbar' });

    // The "Pull metrics (Windsor)" connect/pull action no longer exists on the map.
    expect(screen.queryByTestId('funnel-pull-metrics')).not.toBeInTheDocument();
  });

  it('filters pieces by the channel chips and emits the filter event', () => {
    const pieces = [
      piece('amz', 'doing_job', 'amazon_main_image', { channel: 'amazon' }),
      piece('eml', 'doing_job', 'welcome_series', { channel: 'email', stage: 'retention' }),
    ];
    render(<FunnelMap pieces={pieces} onSelectPiece={vi.fn()} />);
    // Both visible by default.
    expect(screen.getByTestId('funnel-piece-amz')).toBeInTheDocument();
    expect(screen.getByTestId('funnel-piece-eml')).toBeInTheDocument();

    // Toggle Amazon off → the amazon piece disappears, email stays.
    fireEvent.click(screen.getByTestId('funnel-channel-amazon'));
    expect(screen.queryByTestId('funnel-piece-amz')).not.toBeInTheDocument();
    expect(screen.getByTestId('funnel-piece-eml')).toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_funnel_channel_filtered', {
      channel: 'amazon',
      enabled: false,
    });
  });
});
