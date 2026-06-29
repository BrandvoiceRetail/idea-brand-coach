import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Avatar } from '@/types/avatar';

// Hoisted spies + a mutable context object the mocks read each render.
const { navigateMock, toastSuccess, toastError, createAvatarMock, ctx } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  createAvatarMock: vi.fn(),
  ctx: {
    avatars: [] as Avatar[],
    contextAvatarIds: [] as string[],
    selectedAvatarId: null as string | null,
    setContextAvatars: vi.fn(),
    toggleAvatarInContext: vi.fn(),
    renameAvatar: vi.fn(),
    duplicateAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
    setPrimaryAvatar: vi.fn(),
    isLoadingAvatars: false,
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/contexts/AvatarContext', () => ({ useAvatarContext: () => ctx }));
vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => ({ createAvatar: createAvatarMock }) }));

import { CustomerAvatarChip } from '../CustomerAvatarChip';
import { CustomerAvatarEcho } from '../CustomerAvatarEcho';
import { avatarInitials, summarizeAvatarSet } from '../CustomerAvatarMenu';

const mk = (id: string, name: string, extra: Partial<Avatar> = {}): Avatar =>
  ({
    id,
    name,
    is_template: false,
    is_primary: false,
    completion_percentage: 0,
    user_id: 'u1',
    created_at: '',
    updated_at: '',
    ...extra,
  } as Avatar);

// Radix menus rely on pointer-capture + scrollIntoView APIs jsdom omits.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = (): boolean => false;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  navigateMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  createAvatarMock.mockReset();
  ctx.avatars = [];
  ctx.contextAvatarIds = [];
  ctx.selectedAvatarId = null;
  ctx.isLoadingAvatars = false;
  ctx.setContextAvatars.mockReset();
  ctx.toggleAvatarInContext.mockReset();
  ctx.renameAvatar.mockReset();
  ctx.duplicateAvatar.mockReset();
  ctx.deleteAvatar.mockReset();
  ctx.setPrimaryAvatar.mockReset();
});

const renderEl = (el: JSX.Element) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('avatarInitials', () => {
  it('derives 1–2 uppercase initials, never fabricates', () => {
    expect(avatarInitials('Maya Chen')).toBe('MC');
    expect(avatarInitials('Maya')).toBe('MA');
    expect(avatarInitials('  rico  ')).toBe('RI');
    expect(avatarInitials('')).toBe('?');
    expect(avatarInitials(null)).toBe('?');
  });
});

describe('summarizeAvatarSet', () => {
  const maya = mk('maya', 'Maya');
  const rico = mk('rico', 'Rico');
  it('summarises empty / single / multi sets', () => {
    expect(summarizeAvatarSet([maya, rico], [])).toMatchObject({ count: 0, label: 'Select a customer' });
    expect(summarizeAvatarSet([maya, rico], ['maya'])).toMatchObject({ count: 1, label: 'Maya', focusName: 'Maya' });
    expect(summarizeAvatarSet([maya, rico], ['maya', 'rico'])).toMatchObject({ count: 2, label: 'Maya +1' });
  });
  it('ignores ids not present in the avatars list (no fabrication)', () => {
    expect(summarizeAvatarSet([maya], ['ghost'])).toMatchObject({ count: 0 });
  });
});

describe('CustomerAvatarChip — trigger', () => {
  it('full: shows focus initials + label + screen-reader label', () => {
    ctx.avatars = [mk('maya', 'Maya'), mk('rico', 'Rico')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarChip variant="full" />);
    const trigger = screen.getByTestId('customer-avatar-chip');
    expect(trigger).toHaveTextContent('MA');
    expect(trigger).toHaveTextContent('Maya');
    expect(trigger).toHaveAttribute('aria-label', 'Switch customer — currently Maya');
  });

  it('full: multi-select shows "+N" label + count in the aria-label', () => {
    ctx.avatars = [mk('maya', 'Maya'), mk('rico', 'Rico')];
    ctx.contextAvatarIds = ['maya', 'rico'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarChip variant="full" />);
    const trigger = screen.getByTestId('customer-avatar-chip');
    expect(trigger).toHaveTextContent('Maya +1');
    expect(trigger.getAttribute('aria-label')).toContain('2 customers');
  });

  it('compact: initials only, no label text', () => {
    ctx.avatars = [mk('maya', 'Maya')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarChip variant="compact" />);
    const trigger = screen.getByTestId('customer-avatar-chip');
    expect(trigger).toHaveTextContent('MA');
    expect(trigger).not.toHaveTextContent('Working as');
  });
});

describe('CustomerAvatarEcho', () => {
  it('renders nothing when no customer is active', () => {
    ctx.avatars = [mk('maya', 'Maya')];
    ctx.contextAvatarIds = [];
    const { container } = renderEl(<CustomerAvatarEcho />);
    expect(container.querySelector('[data-testid="customer-avatar-echo"]')).toBeNull();
  });

  it('shows the active customer label when a set is active', () => {
    ctx.avatars = [mk('maya', 'Maya')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarEcho />);
    expect(screen.getByTestId('customer-avatar-echo')).toHaveTextContent('Maya');
  });
});

describe('CustomerAvatarMenu — multi-select + create', () => {
  it('adds a customer to the funnel-analysis set via its checkbox (not a switch)', async () => {
    const user = userEvent.setup();
    ctx.avatars = [mk('maya', 'Maya'), mk('rico', 'Rico')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarChip variant="full" />);

    await user.click(screen.getByTestId('customer-avatar-chip'));
    // Maya (in set) is checked; Rico (not in set) is not.
    const mayaBox = await screen.findByRole('checkbox', { name: /Remove Maya/ });
    const ricoBox = screen.getByRole('checkbox', { name: /Add Rico/ });
    expect(mayaBox).toHaveAttribute('aria-checked', 'true');
    expect(ricoBox).toHaveAttribute('aria-checked', 'false');

    await user.click(ricoBox);
    expect(ctx.toggleAvatarInContext).toHaveBeenCalledWith('rico');
    // Ticking the checkbox adds to the set — it does NOT switch the focus.
    expect(ctx.setContextAvatars).not.toHaveBeenCalled();
  });

  it('clicking a customer name switches to only that customer', async () => {
    const user = userEvent.setup();
    ctx.avatars = [mk('maya', 'Maya'), mk('rico', 'Rico')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    renderEl(<CustomerAvatarChip variant="full" />);

    await user.click(screen.getByTestId('customer-avatar-chip'));
    await user.click(await screen.findByRole('menuitem', { name: 'Rico' }));
    expect(ctx.setContextAvatars).toHaveBeenCalledWith(['rico']);
  });

  it('creates a new customer inline and routes to Analyse', async () => {
    const user = userEvent.setup();
    ctx.avatars = [mk('maya', 'Maya')];
    ctx.contextAvatarIds = ['maya'];
    ctx.selectedAvatarId = 'maya';
    createAvatarMock.mockResolvedValue(mk('nomad', 'Nomad'));
    ctx.setContextAvatars.mockResolvedValue(undefined);
    renderEl(<CustomerAvatarChip variant="full" />);

    await user.click(screen.getByTestId('customer-avatar-chip'));
    await user.click(await screen.findByText('New customer'));
    const input = await screen.findByLabelText('New customer name');
    await user.type(input, 'Nomad{Enter}');

    expect(createAvatarMock).toHaveBeenCalledWith({ name: 'Nomad' });
  });
});
