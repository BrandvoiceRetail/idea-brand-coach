/**
 * AvatarContext — the single switch path + startup priority (set model).
 *
 * Covers the behavior-dense, race-prone code introduced by the multi-avatar
 * switch-core (design §2.2 / §4.1, set model):
 *   - setContextAvatars: idempotency (order-insensitive), optimistic → RPC →
 *     ensureSession → invalidate happy path, rollback on RPC failure,
 *     race-safety (a stale switch must not clobber a newer target).
 *   - setCurrentAvatar: thin single-id shim = setContextAvatars([id]).
 *   - toggleAvatarInContext: add/remove a member; never empties the set.
 *   - startup priority: profile-default SET wins; falls back to the
 *     current_avatar_id seed; auto-select fires when nothing resolves AFTER the
 *     avatars list has already loaded (the ref-vs-state bug the review flagged).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AvatarProvider, useAvatarContext, type EnsureSessionForContext } from '../AvatarContext';
import { useAvatars } from '@/hooks/useAvatars';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/services/ServiceProvider';
import type { Avatar } from '@/types/avatar';

vi.mock('@/hooks/useAvatars');
vi.mock('@/hooks/useAuth');
vi.mock('@/services/ServiceProvider');

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

const STORAGE_KEY = 'idea-context-avatar-ids';

function makeAvatar(id: string, isTemplate = false, isPrimary = false): Avatar {
  return {
    id,
    user_id: 'user-1',
    name: `Avatar ${id}`,
    is_template: isTemplate,
    is_primary: isPrimary,
    completion_percentage: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Avatar;
}

let queryClient: QueryClient;
let setContextAvatarsRPC: ReturnType<typeof vi.fn>;
let getContextAvatarIds: ReturnType<typeof vi.fn>;
let getCurrentAvatarId: ReturnType<typeof vi.fn>;
let ensureSessionForContext: ReturnType<typeof vi.fn>;

function setup(opts: {
  avatars?: Avatar[];
  profileSet?: string[];
  seedPointer?: string | null;
} = {}) {
  vi.mocked(useAvatars).mockReturnValue({
    avatars: opts.avatars ?? [],
    isLoading: false,
  } as unknown as ReturnType<typeof useAvatars>);

  vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as unknown as ReturnType<typeof useAuth>);

  setContextAvatarsRPC = vi.fn().mockResolvedValue(undefined);
  getContextAvatarIds = vi.fn().mockResolvedValue(opts.profileSet ?? []);
  getCurrentAvatarId = vi.fn().mockResolvedValue(opts.seedPointer ?? null);
  ensureSessionForContext = vi.fn().mockResolvedValue(undefined);

  vi.mocked(useServices).mockReturnValue({
    userProfileService: { setContextAvatarsRPC, getContextAvatarIds, getCurrentAvatarId },
    chatService: { ensureSessionForAvatar: vi.fn().mockResolvedValue(undefined) },
  } as unknown as ReturnType<typeof useServices>);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AvatarProvider ensureSessionForContext={ensureSessionForContext as unknown as EnsureSessionForContext}>{children}</AvatarProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useAvatarContext(), { wrapper });
}

describe('AvatarContext switch path (set model)', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('idempotent: switching to the already-active set (any order) is a no-op', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1', 'a2'] });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a1', 'a2']));
    setContextAvatarsRPC.mockClear();

    await act(async () => {
      // Same members, reversed order → still a no-op.
      await result.result.current.setContextAvatars(['a2', 'a1']);
    });
    expect(setContextAvatarsRPC).not.toHaveBeenCalled();
  });

  it('happy path: optimistic set → RPC → ensureSession → invalidate', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1'] });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.result.current.setContextAvatars(['a2', 'a1']);
    });

    expect(result.result.current.contextAvatarIds).toEqual(['a2', 'a1']);
    expect(result.result.current.selectedAvatarId).toBe('a2'); // focus = [0]
    expect(setContextAvatarsRPC).toHaveBeenCalledWith(['a2', 'a1']);
    expect(ensureSessionForContext).toHaveBeenCalledWith(['a2', 'a1']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual(['a2', 'a1']);
    expect(invalidate).toHaveBeenCalled();
  });

  it('setCurrentAvatar is a single-id shim = setContextAvatars([id])', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1'] });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));

    await act(async () => {
      await result.result.current.setCurrentAvatar('a2');
    });

    expect(result.result.current.contextAvatarIds).toEqual(['a2']);
    expect(setContextAvatarsRPC).toHaveBeenCalledWith(['a2']);
  });

  it('toggleAvatarInContext adds then removes a member, never emptying the set', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1'] });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a1']));

    await act(async () => {
      await result.result.current.toggleAvatarInContext('a2'); // add
    });
    expect(result.result.current.contextAvatarIds).toEqual(['a1', 'a2']);

    await act(async () => {
      await result.result.current.toggleAvatarInContext('a2'); // remove
    });
    expect(result.result.current.contextAvatarIds).toEqual(['a1']);

    setContextAvatarsRPC.mockClear();
    await act(async () => {
      await result.result.current.toggleAvatarInContext('a1'); // would empty → no-op
    });
    expect(result.result.current.contextAvatarIds).toEqual(['a1']);
    expect(setContextAvatarsRPC).not.toHaveBeenCalled();
  });

  it('rollback: RPC failure reverts local state + localStorage and toasts', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1'] });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));
    setContextAvatarsRPC.mockRejectedValueOnce(new Error('avatar_not_owned'));

    await act(async () => {
      await result.result.current.setContextAvatars(['a2']);
    });

    expect(result.result.current.contextAvatarIds).toEqual(['a1']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual(['a1']);
    expect(toastError).toHaveBeenCalled();
  });

  it('race-safety: a stale (superseded) switch does not clobber the newer target', async () => {
    const result = setup({
      avatars: [makeAvatar('a1'), makeAvatar('a2'), makeAvatar('a3')],
      profileSet: ['a1'],
    });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));

    // Make the FIRST RPC (to a2) hang until we resolve it, the SECOND (a3) fast.
    let resolveFirst!: () => void;
    setContextAvatarsRPC
      .mockImplementationOnce(() => new Promise<void>((res) => { resolveFirst = res; }))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      const p1 = result.result.current.setContextAvatars(['a2']); // hangs
      const p2 = result.result.current.setContextAvatars(['a3']); // resolves
      await p2;
      resolveFirst();
      await p1;
    });

    expect(result.result.current.contextAvatarIds).toEqual(['a3']);
  });
});

describe('AvatarContext startup priority (set model)', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('profile-default SET wins on startup', async () => {
    const result = setup({
      avatars: [makeAvatar('a1'), makeAvatar('a2'), makeAvatar('a3')],
      profileSet: ['a2', 'a3'],
    });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a2', 'a3']));
    expect(result.result.current.selectedAvatarId).toBe('a2');
  });

  it('falls back to the current_avatar_id seed when no profile set or stored set', async () => {
    const result = setup({
      avatars: [makeAvatar('a1'), makeAvatar('a2')],
      profileSet: [],
      seedPointer: 'a2',
    });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a2']));
  });

  it('honors a stored localStorage set when no profile-default set resolves', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['a1', 'a2']));
    const result = setup({
      avatars: [makeAvatar('a1'), makeAvatar('a2')],
      profileSet: [],
      seedPointer: null,
    });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a1', 'a2']));
  });

  it('auto-selects first non-template when avatars are already loaded and nothing else resolves', async () => {
    const result = setup({
      avatars: [makeAvatar('tpl', true), makeAvatar('real')],
      profileSet: [],
      seedPointer: null,
    });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('real'));
  });

  it('delete-member reconciliation: drops a removed member; empties → falls back to primary', async () => {
    // Set starts as [a1, a2]; the avatars list later loses a2 → set becomes [a1].
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], profileSet: ['a1', 'a2'] });
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a1', 'a2']));

    // a2 deleted from the list (a1 remains).
    vi.mocked(useAvatars).mockReturnValue({
      avatars: [makeAvatar('a1')],
      isLoading: false,
    } as unknown as ReturnType<typeof useAvatars>);
    result.rerender();
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['a1']));

    // Now a1 deleted too, but a primary 'p' exists → fall back to [p].
    vi.mocked(useAvatars).mockReturnValue({
      avatars: [makeAvatar('p', false, true)],
      isLoading: false,
    } as unknown as ReturnType<typeof useAvatars>);
    result.rerender();
    await waitFor(() => expect(result.result.current.contextAvatarIds).toEqual(['p']));
  });
});
