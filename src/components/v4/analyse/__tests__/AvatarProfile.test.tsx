import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AvatarProfile } from '../AvatarProfile';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { AvatarPortrait } from '@/types/v4Analyse';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

const PORTRAIT: AvatarPortrait = {
  who: 'busy parents',
  problem: 'poor sleep',
  desire: 'rest',
  channel: 'Amazon',
};

const baseProps = {
  portrait: PORTRAIT,
  onEdit: vi.fn(),
  onConfirm: vi.fn(),
};

describe('AvatarProfile — edge states', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the loading state and no editable fields while building', () => {
    render(<AvatarProfile {...baseProps} portrait={null} isLoading />);
    expect(screen.getByTestId('v4-avatar-profile-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-field-who')).not.toBeInTheDocument();
  });

  it('shows an honest error with a retry button (never a fabricated portrait)', () => {
    const onRetry = vi.fn();
    render(
      <AvatarProfile {...baseProps} portrait={null} error="Couldn't reach the coach." onRetry={onRetry} />,
    );
    expect(screen.getByTestId('v4-avatar-profile-error')).toHaveTextContent(/couldn't reach the coach/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the honest empty state when no portrait could be derived', () => {
    render(<AvatarProfile {...baseProps} portrait={null} />);
    expect(screen.getByTestId('v4-avatar-profile-empty')).toBeInTheDocument();
  });
});

describe('AvatarProfile — restate, edit, confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restates the four fields from the user\'s own words', () => {
    render(<AvatarProfile {...baseProps} />);
    expect(screen.getByTestId('avatar-portrait-card')).toBeInTheDocument();
    expect((screen.getByTestId('avatar-field-who') as HTMLTextAreaElement).value).toBe('busy parents');
    expect((screen.getByTestId('avatar-field-channel') as HTMLTextAreaElement).value).toBe('Amazon');
  });

  it('fires onEdit + a PostHog event on field edit', () => {
    const onEdit = vi.fn();
    render(<AvatarProfile {...baseProps} onEdit={onEdit} />);
    fireEvent.change(screen.getByTestId('avatar-field-problem'), { target: { value: 'restless nights' } });
    expect(onEdit).toHaveBeenCalledWith('problem', 'restless nights');
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_avatar_profile_field_edited', { field: 'problem' });
  });

  it('confirms the edited portrait and emits the confirm event', () => {
    const onConfirm = vi.fn();
    render(<AvatarProfile {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId('avatar-field-who'), { target: { value: 'new parents' } });
    fireEvent.click(screen.getByTestId('avatar-confirm'));
    expect(onConfirm).toHaveBeenCalledWith({ ...PORTRAIT, who: 'new parents' });
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_avatar_profile_confirmed', {});
  });

  it('blocks confirm (no invented field) when any field is blanked', () => {
    const onConfirm = vi.fn();
    render(<AvatarProfile {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByTestId('avatar-field-desire'), { target: { value: '  ' } });
    expect(screen.getByTestId('avatar-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('avatar-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('avatar-incomplete-hint')).toBeInTheDocument();
  });
});

describe('AvatarProfile — multi-avatar set context', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a set-context header naming the focus customer when >1 customer is in the set', () => {
    render(<AvatarProfile {...baseProps} focusAvatarName="Maya" avatarCount={3} />);
    const header = screen.getByTestId('v4-avatar-set-context');
    expect(header).toHaveTextContent('Maya');
    expect(header).toHaveTextContent(/3 avatars in analysis/i);
  });

  it('hides the set-context header for a single-avatar set (byte-identical render)', () => {
    render(<AvatarProfile {...baseProps} focusAvatarName="Maya" avatarCount={1} />);
    expect(screen.queryByTestId('v4-avatar-set-context')).not.toBeInTheDocument();
  });
});
