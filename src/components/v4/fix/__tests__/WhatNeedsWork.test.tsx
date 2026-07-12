import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WhatNeedsWork } from '../WhatNeedsWork';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { WorkItem } from '@/types/v4Fix';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const METRICS_ITEMS: WorkItem[] = [
  {
    touchpointId: 'amazon_main_image',
    label: 'Amazon main image',
    stage: 'awareness',
    status: 'misaligned',
    assetId: 'asset-1',
    rank: 1,
    reason: 'Your hero image leads with the box, not the buyer.',
    estimatedLift: 12,
    liftBasis: 'metrics',
    p0: true,
  },
  {
    touchpointId: 'amazon_listing_copy',
    label: 'Amazon listing (title, bullets, A+)',
    stage: 'consideration',
    status: 'stale',
    assetId: 'asset-2',
    rank: 2,
    reason: 'Copy still echoes last season; nothing here is yours alone.',
    estimatedLift: 5,
    liftBasis: 'metrics',
    p0: false,
  },
];

const COVERAGE_ITEMS: WorkItem[] = [
  {
    touchpointId: 'shopify_pdp',
    label: 'Shopify product page (PDP)',
    stage: 'consideration',
    status: 'missing',
    assetId: null,
    rank: 1,
    reason: 'You have no product page on brand yet.',
    estimatedLift: null,
    liftBasis: 'coverage',
    p0: true,
  },
];

describe('WhatNeedsWork', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders rows ranked by impact with real lift when metrics back them', () => {
    render(<WhatNeedsWork workItems={METRICS_ITEMS} />);
    expect(screen.getByTestId('v4-work-list')).toBeInTheDocument();
    expect(screen.getByTestId('v4-work-row-amazon_main_image')).toHaveTextContent('Amazon main image');
    expect(screen.getByTestId('v4-work-lift-amazon_main_image')).toHaveTextContent('+12%');
    expect(screen.queryByTestId('v4-work-no-metrics-note')).not.toBeInTheDocument();
  });

  it('sorts by rank regardless of input order', () => {
    const reversed = [...METRICS_ITEMS].reverse();
    render(<WhatNeedsWork workItems={reversed} />);
    const rows = screen.getAllByTestId(/^v4-work-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'v4-work-row-amazon_main_image');
  });

  it('shows the honest no-metrics note and NO lift number when ranked by coverage', () => {
    render(<WhatNeedsWork workItems={COVERAGE_ITEMS} />);
    expect(screen.getByTestId('v4-work-no-metrics-note')).toBeInTheDocument();
    expect(screen.queryByTestId('v4-work-lift-shopify_pdp')).not.toBeInTheDocument();
  });

  it('opens the Asset detail and fires the event when a row with an asset is clicked', () => {
    const onSelectAsset = vi.fn();
    render(<WhatNeedsWork workItems={METRICS_ITEMS} onSelectAsset={onSelectAsset} />);
    fireEvent.click(screen.getByTestId('v4-work-row-amazon_main_image'));
    expect(onSelectAsset).toHaveBeenCalledWith('asset-1');
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_funnel_asset_opened',
      expect.objectContaining({ asset_id: 'asset-1', rank: 1, has_lift: true }),
    );
  });

  it('does not make a missing-asset row clickable', () => {
    const onSelectAsset = vi.fn();
    render(<WhatNeedsWork workItems={COVERAGE_ITEMS} onSelectAsset={onSelectAsset} />);
    fireEvent.click(screen.getByTestId('v4-work-row-shopify_pdp'));
    expect(onSelectAsset).not.toHaveBeenCalled();
  });

  it('shows an honest empty state with no fabricated rows', () => {
    render(<WhatNeedsWork workItems={[]} />);
    expect(screen.getByTestId('v4-work-empty')).toHaveTextContent(/nothing to rank yet/i);
    expect(screen.queryByTestId('v4-work-list')).not.toBeInTheDocument();
  });

  it('renders the loading state without firing the view event', () => {
    render(<WhatNeedsWork isLoading />);
    expect(screen.getByTestId('v4-work-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders the error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<WhatNeedsWork error="Service timed out." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-work-error')).toHaveTextContent(/timed out/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('emits the view event once with grounded properties', () => {
    render(<WhatNeedsWork workItems={METRICS_ITEMS} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_what_needs_work_viewed',
      expect.objectContaining({ item_count: 2, lift_basis: 'metrics', state: 'data' }),
    );
  });

  it('leaks no Tier-C internals across any string it renders', () => {
    render(<WhatNeedsWork workItems={[...METRICS_ITEMS, ...COVERAGE_ITEMS]} />);
    const strings = [...METRICS_ITEMS, ...COVERAGE_ITEMS].flatMap((i) => [i.label, i.reason]);
    for (const text of strings) {
      expect(findTierViolations(text)).toEqual([]);
    }
  });
});
