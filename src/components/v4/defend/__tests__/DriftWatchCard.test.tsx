import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriftWatchCard } from '../DriftWatchCard';
import type { DriftWatch } from '@/types/v4Defend';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const CLEAR: DriftWatch = { items: [], count: 0 };

const DRIFTED: DriftWatch = {
  count: 2,
  items: [
    {
      assetId: 'a1',
      touchpointId: 'listing_main_image',
      touchpointLabel: 'Main listing image',
      stage: 'consideration',
      builtAgainst: 'sig-1',
      currentSignature: 'sig-2',
    },
    {
      assetId: 'a2',
      touchpointId: 'product_title',
      touchpointLabel: 'Product title',
      stage: 'purchase_decision',
      builtAgainst: 'sig-1',
      currentSignature: 'sig-2',
    },
  ],
};

describe('DriftWatchCard', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the loading state without firing the view event', () => {
    render(<DriftWatchCard isLoading />);
    expect(screen.getByTestId('v4-defend-drift-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders an honest error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<DriftWatchCard error="Could not check for drift." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-defend-drift-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the all-clear reassurance at zero drift', () => {
    render(<DriftWatchCard watch={CLEAR} />);
    expect(screen.getByTestId('v4-defend-drift-clear')).toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_defend_drift_watch_viewed',
      expect.objectContaining({ state: 'clear', count: 0 }),
    );
  });

  it('names the drifted assets and offers a one-tap jump to Fix', () => {
    const onRecheck = vi.fn();
    render(<DriftWatchCard watch={DRIFTED} onRecheck={onRecheck} />);
    expect(screen.getByTestId('v4-defend-drift-list')).toHaveTextContent('2 assets drifted');
    expect(screen.getByTestId('v4-defend-drift-item-a1')).toHaveTextContent('Main listing image');
    fireEvent.click(screen.getByTestId('v4-defend-drift-recheck'));
    expect(onRecheck).toHaveBeenCalledOnce();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_defend_drift_watch_viewed',
      expect.objectContaining({ state: 'drifted', count: 2 }),
    );
  });
});
