import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextAvatarChecklist } from '../ContextAvatarChecklist';
import type { ContextAvatarOption } from '../ContextAvatarChecklist';

// Radix popover relies on pointer-capture + scrollIntoView APIs jsdom omits.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = (): boolean => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = (): void => {};
  }
});

const AVATARS: ContextAvatarOption[] = [
  { id: 'a', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Carol' },
];

describe('ContextAvatarChecklist', () => {
  it('renders a focus-first trigger label with the set count', () => {
    render(
      <ContextAvatarChecklist avatars={AVATARS} selectedIds={['b', 'a']} onToggle={vi.fn()} />,
    );
    const trigger = screen.getByRole('button', { name: /choose coaching avatars/i });
    // Names follow selectedIds order (focus first), count = set size.
    expect(trigger).toHaveTextContent('Coaching: Bob, Alice (2)');
  });

  it('checks the selected members and toggles an unchecked one on click', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextAvatarChecklist avatars={AVATARS} selectedIds={['a']} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole('button', { name: /choose coaching avatars/i }));

    const aliceBox = screen.getByRole('checkbox', { name: 'Alice' });
    const bobBox = screen.getByRole('checkbox', { name: 'Bob' });
    expect(aliceBox).toBeChecked();
    expect(bobBox).not.toBeChecked();

    await user.click(bobBox);
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('disables the last checked member so the set can never empty', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextAvatarChecklist avatars={AVATARS} selectedIds={['a']} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole('button', { name: /choose coaching avatars/i }));

    const aliceBox = screen.getByRole('checkbox', { name: 'Alice' });
    expect(aliceBox).toBeDisabled();
    await user.click(aliceBox);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('allows unchecking a member when more than one is selected', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <ContextAvatarChecklist avatars={AVATARS} selectedIds={['a', 'b']} onToggle={onToggle} />,
    );

    await user.click(screen.getByRole('button', { name: /choose coaching avatars/i }));

    const aliceBox = screen.getByRole('checkbox', { name: 'Alice' });
    expect(aliceBox).toBeEnabled();
    await user.click(aliceBox);
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('shows an empty state when there are no avatars', async () => {
    const user = userEvent.setup();
    render(<ContextAvatarChecklist avatars={[]} selectedIds={[]} onToggle={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /choose coaching avatars/i });
    expect(trigger).toHaveTextContent('Coaching: none');
    await user.click(trigger);
    expect(screen.getByText('No avatars yet')).toBeInTheDocument();
  });

  it('keeps the trigger count badge in sync with the group checkboxes', async () => {
    const user = userEvent.setup();
    render(
      <ContextAvatarChecklist avatars={AVATARS} selectedIds={['a', 'c']} onToggle={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /choose coaching avatars/i }));
    const group = screen.getByRole('group', { name: /coaching avatars/i });
    const checked = within(group)
      .getAllByRole('checkbox')
      .filter((box) => box.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(2);
  });
});
