/**
 * useChatSessions — session reset on avatar switch (multi-avatar design §4.1).
 *
 * Pins the correctness fix: when `avatarId` changes, the hook MUST clear its
 * selected session so the previous avatar's thread does not survive the switch
 * (which would leave `useChat` loading avatar A's messages into avatar B's view
 * — the cross-avatar bleed §2.1/§2.2). After the reset, the auto-select effect
 * re-picks the NEW avatar's most-recent thread.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChatSessions } from '../useChatSessions';
import { useServices } from '@/services/ServiceProvider';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { ChatSession } from '@/types/chat';

vi.mock('@/services/ServiceProvider');

function session(id: string, avatarId: string): ChatSession {
  return {
    id,
    user_id: 'user-1',
    avatar_id: avatarId,
    chatbot_type: 'idea-framework-consultant',
    title: `Thread ${id}`,
    conversation_type: 'general',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as ChatSession;
}

describe('useChatSessions — avatar switch resets the selected session', () => {
  let queryClient: QueryClient;
  let setCurrentSession: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  function mockService(sessionsByAvatar: Record<string, ChatSession[]>): void {
    setCurrentSession = vi.fn();
    const svc: Partial<IChatService> = {
      setChatbotType: vi.fn(),
      setCurrentAvatar: vi.fn(),
      setCurrentSession,
      // getSessions reflects whatever avatar the service was last scoped to; the
      // hook's queryFn calls it after setCurrentAvatar runs in its effect. We key
      // off the most-recent setCurrentAvatar arg via a closure variable.
      getSessions: vi.fn(),
    };
    vi.mocked(useServices).mockReturnValue({
      chatService: svc as IChatService,
    } as unknown as ReturnType<typeof useServices>);

    let scoped: string | undefined;
    (svc.setCurrentAvatar as ReturnType<typeof vi.fn>).mockImplementation((id?: string) => {
      scoped = id;
    });
    (svc.getSessions as ReturnType<typeof vi.fn>).mockImplementation(async () =>
      scoped ? sessionsByAvatar[scoped] ?? [] : [],
    );
  }

  it('clears currentSessionId when avatarId changes, then auto-selects the new avatar thread', async () => {
    mockService({
      a1: [session('s-a1', 'a1')],
      a2: [session('s-a2', 'a2')],
    });

    const { result, rerender } = renderHook(
      ({ avatarId }: { avatarId: string }) => useChatSessions({ chatbotType: 'idea-framework-consultant', avatarId }),
      { wrapper, initialProps: { avatarId: 'a1' } },
    );

    // Auto-select picks avatar a1's only thread.
    await waitFor(() => expect(result.current.currentSessionId).toBe('s-a1'));

    // Switch avatars.
    rerender({ avatarId: 'a2' });

    // The selected session must move to a2's thread (never stay on s-a1).
    await waitFor(() => expect(result.current.currentSessionId).toBe('s-a2'));
    expect(result.current.currentSessionId).not.toBe('s-a1');
    // The service was told to clear the session at least once during the switch.
    expect(setCurrentSession).toHaveBeenCalledWith(undefined);
  });

  it('resets when the avatar SET changes (focus-only reorder does NOT reset)', async () => {
    // Scope by FOCUS avatar (ids[0]); the hook tells the service the focus id.
    mockService({
      a1: [session('s-a1', 'a1')],
      a2: [session('s-a2', 'a2')],
    });

    const { result, rerender } = renderHook(
      ({ avatarIds }: { avatarIds: string[] }) =>
        useChatSessions({ chatbotType: 'idea-framework-consultant', avatarIds }),
      { wrapper, initialProps: { avatarIds: ['a1', 'a2'] } },
    );

    await waitFor(() => expect(result.current.currentSessionId).toBe('s-a1'));
    setCurrentSession.mockClear();

    // Same members, reordered → stable set key → NO reset (focus stays a1's data).
    rerender({ avatarIds: ['a2', 'a1'] });
    await waitFor(() => expect(result.current.currentSessionId).toBe('s-a1'));
    expect(setCurrentSession).not.toHaveBeenCalledWith(undefined);

    // Genuinely different set ([a2] only) → reset + re-pick a2's thread.
    rerender({ avatarIds: ['a2'] });
    await waitFor(() => expect(result.current.currentSessionId).toBe('s-a2'));
    expect(setCurrentSession).toHaveBeenCalledWith(undefined);
  });
});
