import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChat } from '../useChat';
import { useServices } from '@/services/ServiceProvider';
import type { IChatService } from '@/services/interfaces/IChatService';
import type { ChatMessageCreate } from '@/types/chat';
import { captureAlphaEvent } from '@/lib/posthogClient';

vi.mock('@/services/ServiceProvider');
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
  identifyUser: vi.fn(),
}));

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
    const mockChatService: IChatService = {
      sendMessage: vi.fn(),
      getChatHistory: vi.fn().mockResolvedValue([]),
      clearChatHistory: vi.fn(),
      getRecentMessages: vi.fn().mockResolvedValue([]),
      setChatbotType: vi.fn(),
      setCurrentSession: vi.fn(),
      getCurrentSessionId: vi.fn().mockReturnValue(undefined),
      createSession: vi.fn().mockResolvedValue({ id: 'test-session', user_id: 'test-user', chatbot_type: 'idea-framework-consultant', title: 'New Chat', conversation_type: 'general', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      getSessions: vi.fn().mockResolvedValue([]),
      getSession: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue({ id: 'test-session', user_id: 'test-user', chatbot_type: 'idea-framework-consultant', title: 'Updated', conversation_type: 'general', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      getSessionMessages: vi.fn().mockResolvedValue([]),
      generateSessionTitle: vi.fn().mockResolvedValue(undefined),
      regenerateSessionTitle: vi.fn().mockResolvedValue(null),
      sendMessageStreaming: vi.fn(),
    };

    vi.mocked(useServices).mockReturnValue({
      diagnosticService: {} as never,
      userProfileService: {} as never,
      chatService: mockChatService,
      authService: {} as never,
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearChat');
    expect(result.current).toHaveProperty('isLoading');
  });

  const makeChatService = (streaming: IChatService['sendMessageStreaming']): IChatService =>
    ({
      sendMessage: vi.fn(),
      getChatHistory: vi.fn().mockResolvedValue([]),
      clearChatHistory: vi.fn(),
      getRecentMessages: vi.fn().mockResolvedValue([]),
      setChatbotType: vi.fn(),
      setCurrentSession: vi.fn(),
      getCurrentSessionId: vi.fn().mockReturnValue(undefined),
      createSession: vi.fn().mockResolvedValue(null),
      getSessions: vi.fn().mockResolvedValue([]),
      getSession: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue(null),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      getSessionMessages: vi.fn().mockResolvedValue([]),
      generateSessionTitle: vi.fn().mockResolvedValue(undefined),
      regenerateSessionTitle: vi.fn().mockResolvedValue(null),
      sendMessageStreaming: streaming,
    }) as unknown as IChatService;

  const renderWith = (chatService: IChatService) => {
    vi.mocked(useServices).mockReturnValue({
      diagnosticService: {} as never,
      userProfileService: {} as never,
      chatService,
      authService: {} as never,
    });
    return renderHook(() => useChat(), { wrapper });
  };

  const message = { role: 'user', content: 'hello' } as unknown as ChatMessageCreate;

  it('captures chat_response_latency with TTFT + total on a successful stream', async () => {
    const streaming: IChatService['sendMessageStreaming'] = async (_msg, cb) => {
      cb.onTextDelta?.('hi');
      cb.onComplete?.();
    };
    const { result } = renderWith(makeChatService(streaming));

    await act(async () => {
      await result.current.sendMessageStreaming(message);
    });

    const call = vi.mocked(captureAlphaEvent).mock.calls.find(c => c[0] === 'chat_response_latency');
    expect(call).toBeTruthy();
    const props = call![1] as Record<string, unknown>;
    expect(props.ok).toBe(true);
    expect(typeof props.total_ms).toBe('number');
    expect(typeof props.ttft_ms).toBe('number');
  });

  it('captures chat_response_latency with ok:false on a stream error', async () => {
    const streaming: IChatService['sendMessageStreaming'] = async (_msg, cb) => {
      cb.onError?.(new Error('boom'));
    };
    const { result } = renderWith(makeChatService(streaming));

    await act(async () => {
      await result.current.sendMessageStreaming(message);
    });

    const call = vi
      .mocked(captureAlphaEvent)
      .mock.calls.find(
        c => c[0] === 'chat_response_latency' && (c[1] as Record<string, unknown>).ok === false,
      );
    expect(call).toBeTruthy();
    expect((call![1] as Record<string, unknown>).error_type).toBe('stream_error');
  });
});
