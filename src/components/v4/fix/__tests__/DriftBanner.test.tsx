import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DriftBanner } from '../DriftBanner';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { DriftItem } from '@/types/v4Fix';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

const ITEMS: DriftItem[] = [
  {
    assetId: 'asset-1',
    touchpointId: 'tp-1',
    touchpointLabel: 'Product page',
    stage: 'consideration',
    builtAgainst: 'v1',
    currentPositioningStatement: 'v2',
  },
  {
    assetId: 'asset-2',
    touchpointId: 'tp-2',
    touchpointLabel: 'Email welcome',
    stage: 'awareness',
    builtAgainst: 'v1',
    currentPositioningStatement: 'v2',
  },
];

describe('DriftBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('self-hides and emits nothing when there is no drift', () => {
    const { container } = render(<DriftBanner driftItems={[]} onRecheck={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('v4-drift-banner')).not.toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('shows the banner with the real count and emits shown once', () => {
    render(<DriftBanner driftItems={ITEMS} onRecheck={vi.fn()} />);
    expect(screen.getByTestId('v4-drift-banner')).toBeInTheDocument();
    expect(screen.getByTestId('v4-drift-banner-recheck')).toHaveTextContent('Re-check 2 assets');
    expect(captureAlphaEvent).toHaveBeenCalledTimes(1);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_fix_drift_banner_shown', { count: 2 });
  });

  it('calls onRecheck when the re-check button is clicked', () => {
    const onRecheck = vi.fn();
    render(<DriftBanner driftItems={ITEMS} onRecheck={onRecheck} />);
    fireEvent.click(screen.getByTestId('v4-drift-banner-recheck'));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });
});
