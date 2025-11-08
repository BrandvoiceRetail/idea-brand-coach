import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useChat } from '../useChat';
import { useServices } from '@/services/ServiceProvider';

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
    const mockChatService = {
      sendMessage: vi.fn(),
      getChatHistory: vi.fn().mockResolvedValue([]),
      clearChatHistory: vi.fn(),
      getRecentMessages: vi.fn().mockResolvedValue([]),
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
