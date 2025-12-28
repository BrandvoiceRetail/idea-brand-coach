import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChat } from '../useChat';
import { useServices } from '@/services/ServiceProvider';
import type { IChatService } from '@/services/interfaces/IChatService';

vi.mock('@/services/ServiceProvider');

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
      createSession: vi.fn().mockResolvedValue({ id: 'test-session', user_id: 'test-user', chatbot_type: 'idea-framework-consultant', title: 'New Chat', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      getSessions: vi.fn().mockResolvedValue([]),
      getSession: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue({ id: 'test-session', user_id: 'test-user', chatbot_type: 'idea-framework-consultant', title: 'Updated', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      getSessionMessages: vi.fn().mockResolvedValue([]),
      generateSessionTitle: vi.fn().mockResolvedValue(undefined),
      regenerateSessionTitle: vi.fn().mockResolvedValue(null),
    };

    vi.mocked(useServices).mockReturnValue({
      diagnosticService: {} as any,
      userProfileService: {} as any,
      chatService: mockChatService,
      authService: {} as any,
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearChat');
    expect(result.current).toHaveProperty('isLoading');
  });
});
