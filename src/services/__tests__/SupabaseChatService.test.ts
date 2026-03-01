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
        content: 'Hello, IDEA Framework Consultant!',
      };
      const mockResponse = 'Hello! How can I help you with your brand today?';
      const mockUserMessage = {
        id: 'msg-user-123',
        user_id: 'user-123',
        role: 'user',
        content: mockMessage.content,
        chatbot_type: 'idea-framework-consultant',
        metadata: {},
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };
      const mockAssistantMessage = {
        id: 'msg-123',
        user_id: 'user-123',
        role: 'assistant',
        content: mockResponse,
        chatbot_type: 'idea-framework-consultant',
        metadata: { suggestions: [], sources: [] },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'mock-token' } as any },
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

      // Mock database operations with complete chain
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockUserMessage,
                  error: null,
                }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      // First call: save user message (insert)
      // Second call: get recent messages (select) - return empty
      // Third call: save assistant message (insert)
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        if (table === 'chat_messages') {
          if (callCount === 1 || callCount === 3) {
            // Insert calls (user message and assistant message)
            const messageData = callCount === 1 ? mockUserMessage : mockAssistantMessage;
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: messageData,
                    error: null,
                  }),
                }),
              }),
            } as any;
          } else {
            // Select call (get recent messages)
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      const result = await service.sendMessage(mockMessage);

      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe(mockResponse);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('idea-framework-consultant-test',
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
      const mockUserMessage = {
        id: 'msg-user-123',
        user_id: 'user-123',
        role: 'user',
        content: 'test',
        chatbot_type: 'idea-framework-consultant',
        metadata: {},
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { access_token: 'mock-token' } as any },
        error: null,
      });

      // Mock database operations
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        if (table === 'chat_messages') {
          if (callCount === 1) {
            // Insert user message
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockUserMessage,
                    error: null,
                  }),
                }),
              }),
            } as any;
          } else {
            // Get recent messages
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

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
          chatbot_type: 'idea-framework-consultant',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          metadata: null,
        },
        {
          id: 'msg-2',
          user_id: 'user-123',
          role: 'assistant',
          content: 'Hi!',
          chatbot_type: 'idea-framework-consultant',
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
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockMessages,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const result = await service.getChatHistory();

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
    });

    it('should throw error when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(service.getChatHistory()).rejects.toThrow('User not authenticated');
    });
  });

  describe('clearChatHistory', () => {
    it('should clear chat history successfully', async () => {
      const mockUser = { id: 'user-123' };
      const sessionId = 'session-123';

      // Set current session
      service.setCurrentSession(sessionId);

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      // Mock count query (before delete)
      // Mock delete query
      // Mock count query (after delete)
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        callCount++;
        if (table === 'chat_messages') {
          if (callCount === 1 || callCount === 3) {
            // Count queries
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      count: callCount === 1 ? 5 : 0,
                      error: null,
                    }),
                  }),
                }),
              }),
            } as any;
          } else {
            // Delete query
            return {
              delete: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      error: null,
                    }),
                  }),
                }),
              }),
            } as any;
          }
        }
        return {} as any;
      });

      await service.clearChatHistory();

      expect(supabase.from).toHaveBeenCalledWith('chat_messages');
    });

    it('should throw error when user not authenticated', async () => {
      service.setCurrentSession('session-123');

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(service.clearChatHistory()).rejects.toThrow('User not authenticated');
    });
  });
});
