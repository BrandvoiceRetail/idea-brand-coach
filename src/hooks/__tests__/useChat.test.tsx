import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChat } from '../useChat';
import { useServices } from '@/services/ServiceProvider';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { ChatMessageCreate, ChatResponse } from '@/types/chat';

vi.mock('@/services/ServiceProvider');

/** Minimal IChatService stub (no `any`) for the metadata-wiring assertions. */
function makeChatServiceStub(overrides: Partial<IChatService> = {}): IChatService {
  const session = {
    id: 'test-session',
    user_id: 'test-user',
    chatbot_type: 'idea-framework-consultant' as const,
    title: 'New Chat',
    conversation_type: 'general' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    sendMessage: vi.fn().mockResolvedValue({ message: {}, suggestions: [], sources: [] } as unknown as ChatResponse),
    getChatHistory: vi.fn().mockResolvedValue([]),
    clearChatHistory: vi.fn(),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    setChatbotType: vi.fn(),
    setCurrentSession: vi.fn(),
    setCurrentAvatar: vi.fn(),
    ensureSessionForAvatar: vi.fn().mockResolvedValue(session),
    getCurrentSessionId: vi.fn().mockReturnValue(undefined),
    createSession: vi.fn().mockResolvedValue(session),
    getSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    updateSession: vi.fn().mockResolvedValue(session),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getSessionMessages: vi.fn().mockResolvedValue([]),
    generateSessionTitle: vi.fn().mockResolvedValue(undefined),
    regenerateSessionTitle: vi.fn().mockResolvedValue(null),
    sendMessageStreaming: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as IChatService;
}

describe('useChat', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  it('should provide chat methods and state', () => {
    const chatService = makeChatServiceStub();
    vi.mocked(useServices).mockReturnValue({ chatService } as unknown as ReturnType<typeof useServices>);

    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearChat');
    expect(result.current).toHaveProperty('isLoading');
  });

  it('stamps the active avatar SET (avatar_ids + focus avatar_id) onto the outgoing message metadata (wires M2)', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ message: {}, suggestions: [], sources: [] } as unknown as ChatResponse);
    const chatService = makeChatServiceStub({ sendMessage });
    vi.mocked(useServices).mockReturnValue({ chatService } as unknown as ReturnType<typeof useServices>);

    const { result } = renderHook(() => useChat({ avatarIds: ['a2', 'a1'] }), { wrapper });

    await act(async () => {
      await result.current.sendMessage({ role: 'user', content: 'hi' } as ChatMessageCreate);
    });

    const sent = sendMessage.mock.calls[0][0] as ChatMessageCreate;
    expect(sent.metadata?.avatar_ids).toEqual(['a2', 'a1']);
    expect(sent.metadata?.avatar_id).toBe('a2'); // focus = ids[0]
  });

  it('falls back to the single avatarId as a one-member set', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ message: {}, suggestions: [], sources: [] } as unknown as ChatResponse);
    const chatService = makeChatServiceStub({ sendMessage });
    vi.mocked(useServices).mockReturnValue({ chatService } as unknown as ReturnType<typeof useServices>);

    const { result } = renderHook(() => useChat({ avatarId: 'solo' }), { wrapper });

    await act(async () => {
      await result.current.sendMessage({ role: 'user', content: 'hi' } as ChatMessageCreate);
    });

    const sent = sendMessage.mock.calls[0][0] as ChatMessageCreate;
    expect(sent.metadata?.avatar_ids).toEqual(['solo']);
    expect(sent.metadata?.avatar_id).toBe('solo');
  });
});
