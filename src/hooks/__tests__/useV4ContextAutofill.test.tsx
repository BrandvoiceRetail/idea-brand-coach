import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useV4ContextAutofill } from '../useV4ContextAutofill';

/**
 * Guards the autofill bridge — especially the timing fix: on a fresh browser the
 * active avatar resolves a render AFTER the avatar list, so the one-shot must wait
 * for currentAvatar before deriving (else it writes nothing and Analyse stays gated).
 */

const provideContext = vi.fn();
let v4: { fillMap: { key: string; value: string | null }[]; isLoading: boolean };
let avatarCtx: { currentAvatar: unknown; avatars: unknown[] | undefined };
let brandCtx: { brandData: unknown };

vi.mock('@/contexts/V4ContextStore', () => ({
  useV4Context: () => ({ ...v4, provideContext }),
}));
vi.mock('@/contexts/AvatarContext', () => ({
  useAvatarContext: () => avatarCtx,
}));
vi.mock('@/contexts/BrandContext', () => ({
  useBrand: () => brandCtx,
}));

const EMPTY_SLOTS = ['brand_name', 'product', 'customer', 'problem', 'channel', 'goal'].map((key) => ({ key, value: null }));
const onboardedAvatar = {
  id: 'a1', name: 'Maya', is_template: false,
  description: 'Busy parents who can’t switch off',
  psychographics: { fears: ['poor sleep'] },
};

beforeEach(() => {
  provideContext.mockClear();
  v4 = { fillMap: EMPTY_SLOTS, isLoading: false };
  avatarCtx = { currentAvatar: null, avatars: undefined };
  brandCtx = { brandData: null };
});

describe('useV4ContextAutofill', () => {
  it('does nothing while the v4 store is still loading', () => {
    v4 = { fillMap: EMPTY_SLOTS, isLoading: true };
    avatarCtx = { currentAvatar: onboardedAvatar, avatars: [onboardedAvatar] };
    renderHook(() => useV4ContextAutofill());
    expect(provideContext).not.toHaveBeenCalled();
  });

  it('WAITS when the avatar list is loaded but the active avatar has not resolved (the timing fix)', () => {
    // avatars present, currentAvatar still null → must NOT fire/derive-nothing.
    avatarCtx = { currentAvatar: null, avatars: [onboardedAvatar] };
    renderHook(() => useV4ContextAutofill());
    expect(provideContext).not.toHaveBeenCalled();
  });

  it('autofills once the active avatar resolves, writing customer + problem', async () => {
    avatarCtx = { currentAvatar: onboardedAvatar, avatars: [onboardedAvatar] };
    renderHook(() => useV4ContextAutofill());
    await waitFor(() => expect(provideContext).toHaveBeenCalledTimes(1));
    const answers = provideContext.mock.calls[0][0] as { key: string; confirm?: boolean }[];
    const keys = answers.map((a) => a.key);
    expect(keys).toContain('customer');
    expect(keys).toContain('problem');
    expect(answers.every((a) => a.confirm === true)).toBe(true); // stated → satisfies the gate
  });

  it('no-ops when customer + problem are already present', () => {
    v4 = {
      fillMap: [{ key: 'customer', value: 'X' }, { key: 'problem', value: 'Y' }],
      isLoading: false,
    };
    avatarCtx = { currentAvatar: onboardedAvatar, avatars: [onboardedAvatar] };
    renderHook(() => useV4ContextAutofill());
    expect(provideContext).not.toHaveBeenCalled();
  });

  it('does not write for a brand-new user with no avatars and no brand data', () => {
    avatarCtx = { currentAvatar: null, avatars: [] }; // genuinely empty (not loading)
    renderHook(() => useV4ContextAutofill());
    expect(provideContext).not.toHaveBeenCalled();
  });
});
