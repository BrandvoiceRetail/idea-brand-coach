import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DefendChecklist } from '../DefendChecklist';
import { buildChecklist } from '@/services/v4/defendService';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { DefendAvatarStatus } from '@/types/v4Defend';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

describe('DefendChecklist', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the loading skeleton without firing the view event', () => {
    render(<DefendChecklist isLoading />);
    expect(screen.getByTestId('v4-defend-checklist-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('shows an honest empty state instead of a bare card when there are no items', () => {
    render(<DefendChecklist items={[]} />);
    expect(screen.getByTestId('v4-defend-checklist-empty')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('shows an honest error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<DefendChecklist error="Could not build the checklist." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-defend-checklist-error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders every derived row, fires the view event, and leaks no Tier-C internals', () => {
    const items = buildChecklist(1, false);
    render(<DefendChecklist items={items} />);
    expect(screen.getByTestId('v4-defend-checklist-item-drift')).toHaveAttribute(
      'data-state',
      'attention',
    );
    expect(screen.getByTestId('v4-defend-checklist-item-competitor')).toHaveAttribute(
      'data-state',
      'coming',
    );
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_defend_checklist_viewed',
      expect.objectContaining({ attention: expect.any(Number) }),
    );
    for (const item of items) {
      expect(findTierViolations(`${item.label} ${item.detail}`)).toEqual([]);
    }
  });

  it('renders a per-customer breakdown strip under the rolled-up checklist (multi-avatar)', () => {
    const perAvatar: DefendAvatarStatus[] = [
      { avatarId: 'av1', avatarName: 'Maya', driftCount: 0, hasBaseline: true, liftConfirmed: true, verdict: 'holding' },
      { avatarId: 'av2', avatarName: 'Rico', driftCount: 1, hasBaseline: false, liftConfirmed: false, verdict: 'drifted' },
    ];
    render(<DefendChecklist items={buildChecklist(1, false)} perAvatar={perAvatar} />);
    const strip = screen.getByTestId('v4-defend-per-avatar');
    expect(strip).toHaveTextContent('Where each avatar stands');
    expect(screen.getByTestId('v4-defend-per-avatar-av2')).toHaveTextContent('1 drifted');
    expect(findTierViolations(strip.textContent ?? '')).toEqual([]);
  });

  it('omits the per-customer strip for a single customer (single-avatar parity)', () => {
    render(<DefendChecklist items={buildChecklist(0, true)} />);
    expect(screen.queryByTestId('v4-defend-per-avatar')).not.toBeInTheDocument();
  });
});
