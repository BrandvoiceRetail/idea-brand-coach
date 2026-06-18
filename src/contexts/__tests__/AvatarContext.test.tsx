/**
 * AvatarContext — the single switch path + startup priority.
 *
 * Covers the behavior-dense, race-prone code introduced by the multi-avatar
 * switch-core (design §2.2 / §4.1):
 *   - setCurrentAvatar: idempotency, optimistic → RPC → ensureSession →
 *     invalidate happy path, rollback on RPC failure, race-safety (a stale
 *     switch must not clobber a newer target).
 *   - startup priority: server pointer wins; auto-select fires when the pointer
 *     resolves AFTER the avatars list has already loaded (the ref-vs-state bug
 *     the correctness review flagged).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AvatarProvider, useAvatarContext } from '../AvatarContext';
import { useAvatars } from '@/hooks/useAvatars';
import { useAuth } from '@/hooks/useAuth';
import { useServices } from '@/services/ServiceProvider';
import type { Avatar } from '@/types/avatar';

vi.mock('@/hooks/useAvatars');
vi.mock('@/hooks/useAuth');
vi.mock('@/services/ServiceProvider');

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

function makeAvatar(id: string, isTemplate = false): Avatar {
  return {
    id,
    user_id: 'user-1',
    name: `Avatar ${id}`,
    is_template: isTemplate,
    completion_percentage: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Avatar;
}

let queryClient: QueryClient;
let setCurrentAvatarRPC: ReturnType<typeof vi.fn>;
let getCurrentAvatarId: ReturnType<typeof vi.fn>;
let ensureSessionForAvatar: ReturnType<typeof vi.fn>;

function setup(opts: {
  avatars?: Avatar[];
  serverPointer?: string | null;
} = {}) {
  vi.mocked(useAvatars).mockReturnValue({
    avatars: opts.avatars ?? [],
    isLoading: false,
  } as unknown as ReturnType<typeof useAvatars>);

  vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as unknown as ReturnType<typeof useAuth>);

  setCurrentAvatarRPC = vi.fn().mockResolvedValue(undefined);
  getCurrentAvatarId = vi.fn().mockResolvedValue(opts.serverPointer ?? null);
  ensureSessionForAvatar = vi.fn().mockResolvedValue(undefined);

  vi.mocked(useServices).mockReturnValue({
    userProfileService: { setCurrentAvatarRPC, getCurrentAvatarId },
    chatService: { ensureSessionForAvatar },
  } as unknown as ReturnType<typeof useServices>);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AvatarProvider>{children}</AvatarProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useAvatarContext(), { wrapper });
}

describe('AvatarContext switch path', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('idempotent: switching to the already-selected avatar is a no-op', async () => {
    const result = setup({ avatars: [makeAvatar('a1')], serverPointer: 'a1' });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));
    setCurrentAvatarRPC.mockClear();

    await act(async () => {
      await result.result.current.setCurrentAvatar('a1');
    });
    expect(setCurrentAvatarRPC).not.toHaveBeenCalled();
  });

  it('happy path: optimistic set → RPC → ensureSession → invalidate', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], serverPointer: 'a1' });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.result.current.setCurrentAvatar('a2');
    });

    expect(result.result.current.selectedAvatarId).toBe('a2');
    expect(setCurrentAvatarRPC).toHaveBeenCalledWith('a2');
    expect(ensureSessionForAvatar).toHaveBeenCalledWith('a2');
    expect(localStorage.getItem('idea-selected-avatar-id')).toBe('a2');
    // Switch invalidates the avatar-namespace caches.
    expect(invalidate).toHaveBeenCalled();
  });

  it('rollback: RPC failure reverts local state + localStorage and toasts', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], serverPointer: 'a1' });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));
    setCurrentAvatarRPC.mockRejectedValueOnce(new Error('avatar_not_owned'));

    await act(async () => {
      await result.result.current.setCurrentAvatar('a2');
    });

    expect(result.result.current.selectedAvatarId).toBe('a1');
    expect(localStorage.getItem('idea-selected-avatar-id')).toBe('a1');
    expect(toastError).toHaveBeenCalled();
  });

  it('race-safety: a stale (superseded) switch does not clobber the newer target', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2'), makeAvatar('a3')], serverPointer: 'a1' });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a1'));

    // Make the FIRST RPC (to a2) hang until we resolve it, the SECOND (a3) fast.
    let resolveFirst!: () => void;
    setCurrentAvatarRPC
      .mockImplementationOnce(() => new Promise<void>((res) => { resolveFirst = res; }))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      const p1 = result.result.current.setCurrentAvatar('a2'); // hangs
      const p2 = result.result.current.setCurrentAvatar('a3'); // resolves
      await p2;
      resolveFirst();
      await p1;
    });

    // The newer switch (a3) must own the final state — the stale a2 call must
    // not roll back or override it.
    expect(result.result.current.selectedAvatarId).toBe('a3');
  });
});

describe('AvatarContext startup priority', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('server pointer wins on startup', async () => {
    const result = setup({ avatars: [makeAvatar('a1'), makeAvatar('a2')], serverPointer: 'a2' });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('a2'));
  });

  it('auto-selects first non-template when avatars are already loaded and no pointer resolves', async () => {
    // avatars present from first render; server pointer resolves to null AFTER.
    // The auto-select effect must still fire (startup-resolved is state, not a
    // bare ref, so flipping it re-runs the effect).
    const result = setup({ avatars: [makeAvatar('tpl', true), makeAvatar('real')], serverPointer: null });
    await waitFor(() => expect(result.result.current.selectedAvatarId).toBe('real'));
  });
});
