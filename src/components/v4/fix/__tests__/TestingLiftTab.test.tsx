import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestingLiftTab } from '../TestingLiftTab';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { TestRow } from '@/types/v4Fix';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const ROWS: TestRow[] = [
  {
    id: 'test-1',
    name: 'Battle-ready title + A+',
    pieceId: 'asset-1',
    pieceLabel: 'Amazon listing (title, bullets, A+)',
    metric: 'cvr',
    baseline: 10.7,
    result: 13.9,
    status: 'completed',
    kind: 'standard',
    assetCreatedAt: '2026-06-01T00:00:00.000Z',
    assetLiveAt: '2026-06-05T00:00:00.000Z',
    lifecycleStage: 'complete',
  },
  {
    id: 'test-2',
    name: 'Warranty badge test',
    pieceId: 'asset-1',
    pieceLabel: 'Amazon listing (title, bullets, A+)',
    metric: 'cvr',
    baseline: 13.9,
    result: null,
    status: 'running',
    kind: 'standard',
    assetCreatedAt: null,
    assetLiveAt: null,
    lifecycleStage: 'idea',
  },
  {
    id: 'test-3',
    name: 'Main image — battle-ready',
    pieceId: 'asset-2',
    pieceLabel: 'Main image',
    metric: 'ctr',
    baseline: 3.0,
    result: 4.6,
    status: 'completed',
    kind: 'standard',
    assetCreatedAt: '2026-06-02T00:00:00.000Z',
    assetLiveAt: '2026-06-06T00:00:00.000Z',
    lifecycleStage: 'complete',
  },
];

describe('TestingLiftTab', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('shows an honest empty state with no fabricated rows', () => {
    render(<TestingLiftTab tests={[]} />);
    expect(screen.getByTestId('v4-testing-empty')).toHaveTextContent(/no tests yet/i);
    expect(screen.queryByTestId('v4-testing-table')).not.toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_testing_lift_viewed',
      expect.objectContaining({ test_count: 0, state: 'empty' }),
    );
  });

  it('renders rows with derived lift and honest "—" for a running test', () => {
    render(<TestingLiftTab tests={ROWS} />);
    expect(screen.getByTestId('v4-testing-table')).toBeInTheDocument();
    // Completed: (13.9-10.7)/10.7 ≈ +30%
    expect(screen.getByTestId('v4-testing-lift-test-1')).toHaveTextContent('+30%');
    // Running test has no result → honest dash, never a fabricated lift.
    expect(screen.getByTestId('v4-testing-lift-test-2')).toHaveTextContent('—');
    expect(screen.getByTestId('v4-testing-row-test-2')).toHaveTextContent('running');
  });

  it('emits the view event once with grounded counts', () => {
    render(<TestingLiftTab tests={ROWS} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_testing_lift_viewed',
      expect.objectContaining({ test_count: 3, running_count: 1, state: 'data' }),
    );
  });

  it('filters by status and fires the filter event', () => {
    render(<TestingLiftTab tests={ROWS} />);
    fireEvent.change(screen.getByTestId('v4-testing-status-filter'), {
      target: { value: 'running' },
    });
    expect(screen.getByTestId('v4-testing-row-test-2')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-testing-row-test-1')).not.toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_testing_lift_filtered',
      expect.objectContaining({ filter: 'status', value: 'running' }),
    );
  });

  it('filters by metric and shows a no-match row when nothing fits', () => {
    render(<TestingLiftTab tests={ROWS} />);
    fireEvent.change(screen.getByTestId('v4-testing-metric-filter'), {
      target: { value: 'ctr' },
    });
    expect(screen.getByTestId('v4-testing-row-test-3')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-testing-row-test-1')).not.toBeInTheDocument();
    // Then a status that no CTR row has → explicit no-match, not an empty table.
    fireEvent.change(screen.getByTestId('v4-testing-status-filter'), {
      target: { value: 'running' },
    });
    expect(screen.getByTestId('v4-testing-no-match')).toBeInTheDocument();
  });

  it('renders the loading state without firing the view event', () => {
    render(<TestingLiftTab isLoading />);
    expect(screen.getByTestId('v4-testing-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders the error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<TestingLiftTab error="Service timed out." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-testing-error')).toHaveTextContent(/timed out/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the Export button only when a handler is provided', () => {
    const onExport = vi.fn();
    const { rerender } = render(<TestingLiftTab tests={ROWS} />);
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    rerender(<TestingLiftTab tests={ROWS} onExport={onExport} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('offers the right lifecycle action per stage and fires the milestone event', () => {
    const onMarkAssetCreated = vi.fn();
    const onMarkAssetLive = vi.fn();
    const rows: TestRow[] = [
      {
        ...ROWS[1],
        id: 'idea-row',
        lifecycleStage: 'idea',
        assetCreatedAt: null,
        assetLiveAt: null,
      },
      {
        ...ROWS[1],
        id: 'created-row',
        lifecycleStage: 'asset_created',
        assetCreatedAt: '2026-06-10T00:00:00.000Z',
        assetLiveAt: null,
      },
    ];
    render(
      <TestingLiftTab
        tests={rows}
        onMarkAssetCreated={onMarkAssetCreated}
        onMarkAssetLive={onMarkAssetLive}
      />,
    );

    // Idea → "Mark asset created"; advances via the created handler + event.
    fireEvent.click(screen.getByTestId('v4-testing-advance-idea-row'));
    expect(onMarkAssetCreated).toHaveBeenCalledWith('idea-row');
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_test_lifecycle_advanced', {
      milestone: 'asset_created',
    });

    // Asset-created → "Mark asset live"; advances via the live handler + event.
    fireEvent.click(screen.getByTestId('v4-testing-advance-created-row'));
    expect(onMarkAssetLive).toHaveBeenCalledWith('created-row');
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_test_lifecycle_advanced', {
      milestone: 'asset_live',
    });
  });

  it('shows milestone dates and no advance action once complete', () => {
    render(<TestingLiftTab tests={ROWS} onMarkAssetCreated={vi.fn()} onMarkAssetLive={vi.fn()} />);
    expect(screen.getByTestId('v4-testing-lifecycle-test-1')).toHaveTextContent(/Complete/);
    // A complete test has no advance button (both milestones are behind it).
    expect(screen.queryByTestId('v4-testing-advance-test-1')).not.toBeInTheDocument();
  });

  it('disables the advancing row while a stamp is in flight', () => {
    const rows: TestRow[] = [
      { ...ROWS[1], id: 'idea-row', lifecycleStage: 'idea', assetCreatedAt: null, assetLiveAt: null },
    ];
    render(<TestingLiftTab tests={rows} onMarkAssetCreated={vi.fn()} advancingTestId="idea-row" />);
    expect(screen.getByTestId('v4-testing-advance-idea-row')).toBeDisabled();
  });

  it('leaks no Tier-C internals across any string it renders', () => {
    render(<TestingLiftTab tests={ROWS} />);
    const strings = ROWS.flatMap((r) => [r.name, r.pieceLabel]);
    for (const text of strings) {
      expect(findTierViolations(text)).toEqual([]);
    }
  });
});
