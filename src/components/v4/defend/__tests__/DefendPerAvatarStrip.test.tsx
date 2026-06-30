import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefendPerAvatarStrip } from '../DefendPerAvatarStrip';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { DefendAvatarStatus } from '@/types/v4Defend';

const holding: DefendAvatarStatus = {
  avatarId: 'av1',
  avatarName: 'Maya',
  driftCount: 0,
  hasBaseline: true,
  liftConfirmed: true,
  verdict: 'holding',
};
const drifted: DefendAvatarStatus = {
  avatarId: 'av2',
  avatarName: 'Rico',
  driftCount: 2,
  hasBaseline: true,
  liftConfirmed: false,
  verdict: 'drifted',
};
const none: DefendAvatarStatus = {
  avatarId: 'av3',
  avatarName: 'Sam',
  driftCount: 0,
  hasBaseline: false,
  liftConfirmed: false,
  verdict: 'none',
};

describe('DefendPerAvatarStrip', () => {
  it('self-hides for a single customer (single-avatar parity)', () => {
    const { container } = render(<DefendPerAvatarStrip perAvatar={[holding]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one badge per customer with an honest per-customer label', () => {
    render(<DefendPerAvatarStrip perAvatar={[holding, drifted, none]} />);
    expect(screen.getByTestId('v4-defend-per-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('v4-defend-per-avatar-av1')).toHaveTextContent('holding steady');
    expect(screen.getByTestId('v4-defend-per-avatar-av2')).toHaveTextContent('2 drifted');
    expect(screen.getByTestId('v4-defend-per-avatar-av3')).toHaveTextContent('nothing to defend yet');
  });

  it('honours a custom caption and leaks no Tier-C vocabulary', () => {
    render(
      <DefendPerAvatarStrip perAvatar={[holding, drifted]} caption="Where each customer stands" />,
    );
    const strip = screen.getByTestId('v4-defend-per-avatar');
    expect(strip).toHaveTextContent('Where each customer stands');
    expect(findTierViolations(strip.textContent ?? '')).toEqual([]);
  });
});
