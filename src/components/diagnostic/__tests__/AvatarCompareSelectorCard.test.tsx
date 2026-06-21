import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarCompareSelectorCard } from '../AvatarCompareSelectorCard';
import type { Avatar } from '@/types/avatar';

function makeAvatar(id: string, name: string, overrides: Partial<Avatar> = {}): Avatar {
  return {
    id,
    user_id: 'user-1',
    name,
    is_template: false,
    completion_percentage: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

const AVATARS: Avatar[] = [
  makeAvatar('a', 'Alice', { is_primary: true }),
  makeAvatar('b', 'Bob'),
  makeAvatar('c', 'Carol'),
];

describe('AvatarCompareSelectorCard', () => {
  it('renders one checkbox per avatar and marks the selected ones checked', () => {
    render(<AvatarCompareSelectorCard avatars={AVATARS} selectedIds={['a', 'c']} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Compare Alice' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Compare Bob' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Compare Carol' })).toBeChecked();
  });

  it('flags the primary avatar with a badge', () => {
    render(<AvatarCompareSelectorCard avatars={AVATARS} selectedIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('adds an unchecked avatar to the set in avatars-list order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AvatarCompareSelectorCard avatars={AVATARS} selectedIds={['c']} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Compare Alice' }));
    // Emits the full next set, ordered by the avatars list (a before c).
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('removes a checked avatar from the set', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AvatarCompareSelectorCard avatars={AVATARS} selectedIds={['a', 'b']} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Compare Bob' }));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('renders nothing when there are no avatars', () => {
    const { container } = render(
      <AvatarCompareSelectorCard avatars={[]} selectedIds={[]} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
