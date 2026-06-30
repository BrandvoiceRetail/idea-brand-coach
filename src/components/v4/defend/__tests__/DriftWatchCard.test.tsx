import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriftWatchCard } from '../DriftWatchCard';
import type { DefendAvatarStatus, DriftWatch } from '@/types/v4Defend';

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

  it('shows an honest neutral state (not a false all-clear) when there is no baseline', () => {
    render(<DriftWatchCard watch={CLEAR} hasBaseline={false} />);
    expect(screen.getByTestId('v4-defend-drift-none')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-defend-drift-clear')).not.toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_defend_drift_watch_viewed',
      expect.objectContaining({ state: 'none', count: 0 }),
    );
  });

  it('renders the per-customer breakdown strip beside the weakest-link headline (multi-avatar)', () => {
    const perAvatar: DefendAvatarStatus[] = [
      { avatarId: 'av1', avatarName: 'Maya', driftCount: 0, hasBaseline: true, liftConfirmed: true, verdict: 'holding' },
      { avatarId: 'av2', avatarName: 'Rico', driftCount: 2, hasBaseline: true, liftConfirmed: false, verdict: 'drifted' },
    ];
    render(<DriftWatchCard watch={DRIFTED} perAvatar={perAvatar} />);
    expect(screen.getByTestId('v4-defend-drift-list')).toHaveTextContent('2 assets drifted');
    expect(screen.getByTestId('v4-defend-per-avatar-av1')).toHaveTextContent('holding steady');
    expect(screen.getByTestId('v4-defend-per-avatar-av2')).toHaveTextContent('2 drifted');
  });

  it('omits the per-customer strip for a single customer (single-avatar parity)', () => {
    render(<DriftWatchCard watch={CLEAR} />);
    expect(screen.queryByTestId('v4-defend-per-avatar')).not.toBeInTheDocument();
  });
});
