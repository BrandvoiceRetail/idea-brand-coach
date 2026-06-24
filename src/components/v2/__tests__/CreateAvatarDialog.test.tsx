import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAvatarDialog } from '../CreateAvatarDialog';

/**
 * Tests for CreateAvatarDialog
 *
 * Validates:
 * - Submit is disabled until a non-empty, non-duplicate name is entered
 * - Duplicate names (case-insensitive) show an inline error and block submit
 * - A valid name calls onCreate with the trimmed value and closes on success
 * - A failed create keeps the dialog open
 */

function setup(overrides?: { onCreate?: () => Promise<boolean>; existingNames?: string[] }) {
  const onCreate = vi.fn(overrides?.onCreate ?? (() => Promise.resolve(true)));
  const onOpenChange = vi.fn();
  render(
    <CreateAvatarDialog
      open
      onOpenChange={onOpenChange}
      existingNames={overrides?.existingNames ?? []}
      onCreate={onCreate}
    />
  );
  const input = screen.getByLabelText(/avatar name/i);
  const createButton = screen.getByRole('button', { name: /create avatar/i });
  return { onCreate, onOpenChange, input, createButton };
}

describe('CreateAvatarDialog', () => {
  it('disables submit until a name is entered', () => {
    const { createButton, input } = setup();
    expect(createButton).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Budget Parent' } });
    expect(createButton).toBeEnabled();
  });

  it('blocks and warns on a duplicate name (case-insensitive)', () => {
    const { createButton, input } = setup({ existingNames: ['Existing Persona'] });

    fireEvent.change(input, { target: { value: 'existing persona' } });

    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('creates with the trimmed name and closes on success', async () => {
    const { onCreate, onOpenChange, input, createButton } = setup();

    fireEvent.change(input, { target: { value: '  New Persona  ' } });
    fireEvent.click(createButton);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('New Persona'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('keeps the dialog open when creation fails', async () => {
    const { onCreate, onOpenChange, input, createButton } = setup({
      onCreate: () => Promise.resolve(false),
    });

    fireEvent.change(input, { target: { value: 'New Persona' } });
    fireEvent.click(createButton);

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
