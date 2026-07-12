import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Hoisted spies so the module mocks below can reference them.
const { navigateMock, signOutMock, toastSuccess, toastError } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'maya.chen@example.com' }, signOut: signOutMock }),
}));

import { ProfileMenu, initialsFromEmail } from '../ProfileMenu';

// Radix menus rely on pointer-capture + scrollIntoView APIs jsdom omits.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = (): boolean => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = (): void => {};
  }
});

beforeEach(() => {
  navigateMock.mockReset();
  signOutMock.mockReset().mockResolvedValue(undefined);
  toastSuccess.mockReset();
  toastError.mockReset();
});

const renderMenu = (props: { variant?: 'full' | 'compact' } = {}) =>
  render(
    <MemoryRouter>
      <ProfileMenu {...props} />
    </MemoryRouter>,
  );

describe('initialsFromEmail', () => {
  it('derives 1–2 uppercase initials from the email local-part', () => {
    expect(initialsFromEmail('maya.chen@example.com')).toBe('MC');
    expect(initialsFromEmail('james@example.com')).toBe('JA');
    expect(initialsFromEmail('a@b.com')).toBe('A');
  });

  it('never throws on a missing email (no fabrication)', () => {
    expect(initialsFromEmail(null)).toBe('?');
    expect(initialsFromEmail(undefined)).toBe('?');
    expect(initialsFromEmail('')).toBe('?');
  });
});

describe('ProfileMenu — trigger', () => {
  it('labels the trigger for screen readers and shows owner identity (full)', () => {
    renderMenu({ variant: 'full' });
    const trigger = screen.getByTestId('profile-menu-trigger');
    expect(trigger).toHaveAttribute('aria-label', 'Account menu for maya.chen@example.com');
    expect(trigger).toHaveTextContent('MC');
    expect(trigger).toHaveTextContent('maya.chen@example.com');
  });

  it('compact variant shows initials only — no inline email', () => {
    renderMenu({ variant: 'compact' });
    const trigger = screen.getByTestId('profile-menu-trigger');
    expect(trigger).toHaveTextContent('MC');
    expect(trigger).not.toHaveTextContent('maya.chen@example.com');
  });
});

describe('ProfileMenu — actions', () => {
  it('opens to "Signed in as" + Settings + Sign out', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('profile-menu-trigger'));
    expect(await screen.findByText('Signed in as')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('Settings navigates to /settings', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('profile-menu-trigger'));
    await user.click(await screen.findByText('Settings'));
    expect(navigateMock).toHaveBeenCalledWith('/settings');
  });

  it('Sign out calls signOut, toasts success, and redirects to /auth', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('profile-menu-trigger'));
    await user.click(await screen.findByTestId('profile-menu-signout'));
    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/auth'));
    expect(toastSuccess).toHaveBeenCalledWith('Signed out');
  });

  it('on sign-out failure, toasts an error and does NOT redirect', async () => {
    signOutMock.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByTestId('profile-menu-trigger'));
    await user.click(await screen.findByTestId('profile-menu-signout'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(navigateMock).not.toHaveBeenCalledWith('/auth');
  });
});
