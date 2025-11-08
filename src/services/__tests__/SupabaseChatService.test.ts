import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseChatService } from '../SupabaseChatService';
import { supabase } from '@/integrations/supabase/client';

describe('SupabaseChatService', () => {
  let service: SupabaseChatService;

  beforeEach(() => {
    service = new SupabaseChatService();
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message and get AI response', async () => {
      const mockUser = { id: 'user-123' };
      const mockMessage = {
        role: 'user' as const,
        content: 'Hello, Brand Coach!',
      };
      const mockResponse = 'Hello! How can I help you with your brand today?';
      const mockAssistantMessage = {
        id: 'msg-123',
        user_id: 'user-123',
        role: 'assistant',
        content: mockResponse,
        metadata: {},
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      // Mock edge function response
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { 
          response: mockResponse,
          suggestions: [],
          sources: []
        },
        error: null,
      });

      // Mock database inserts and selects
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockAssistantMessage,
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await service.sendMessage(mockMessage);

      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe(mockResponse);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('brand-coach-gpt', 
        expect.objectContaining({
          body: expect.objectContaining({
            message: mockMessage.content,
          }),
        })
      );
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        service.sendMessage({ role: 'user', content: 'test' })
      ).rejects.toThrow('User not authenticated');
    });

    it('should handle edge function errors', async () => {
      const mockUser = { id: 'user-123' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      const mockError = new Error('AI service unavailable');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: mockError as any,
      });

      await expect(
        service.sendMessage({ role: 'user', content: 'test' })
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('getChatHistory', () => {
    it('should fetch chat history successfully', async () => {
      const mockUser = { id: 'user-123' };
      const mockMessages = [
        {
          id: 'msg-1',
          user_id: 'user-123',
          role: 'user',
          content: 'Hello',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          metadata: null,
        },
        {
          id: 'msg-2',
          user_id: 'user-123',
          role: 'assistant',
          content: 'Hi!',
          created_at: '2025-01-01T00:00:01Z',
          updated_at: '2025-01-01T00:00:01Z',
          metadata: null,
        },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockMessages,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await service.getChatHistory();

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should return empty array when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await service.getChatHistory();

      expect(result).toEqual([]);
    });
  });

  describe('clearChatHistory', () => {
    it('should clear chat history successfully', async () => {
      const mockUser = { id: 'user-123' };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as any);

      await service.clearChatHistory();

      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(service.clearChatHistory()).rejects.toThrow('User not authenticated');
    });
  });
});
