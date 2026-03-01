import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseChatService } from '../SupabaseChatService';
import { supabase } from '@/integrations/supabase/client';
import { ChatImageAttachment } from '@/types/chat';

vi.mock('@/integrations/supabase/client');
vi.mock('@/lib/knowledge-base/sync-service-instance');

describe('SupabaseChatService - Image Processing', () => {
  let service: SupabaseChatService;

  beforeEach(() => {
    service = new SupabaseChatService();
    vi.clearAllMocks();
  });

  describe('sendMessage with images', () => {
    it('should send message with image metadata', async () => {
      const mockUser = { id: 'user-123' };
      const mockSession = {
        access_token: 'mock-token',
        user: mockUser,
      };

      const mockImages: ChatImageAttachment[] = [
        {
          id: 'img-1',
          url: 'https://example.com/image1.jpg',
          filename: 'product.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
        },
        {
          id: 'img-2',
          url: 'https://example.com/image2.png',
          filename: 'logo.png',
          mime_type: 'image/png',
          file_size: 2048,
        },
      ];

      const mockMessage = {
        role: 'user' as const,
        content: 'Analyze these product images',
        metadata: {
          images: mockImages,
          useSystemKB: true,
        },
      };

      // Mock auth
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      // Mock database operations
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'msg-123',
                    user_id: 'user-123',
                    role: 'user',
                    content: mockMessage.content,
                    metadata: mockMessage.metadata,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                  },
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

      // Mock edge function with image processing
      const mockEdgeFunctionInvoke = vi.fn().mockResolvedValue({
        data: {
          response: 'Based on the product images, I can see strong visual branding...',
          suggestions: ['How can I improve the hero image?'],
          sources: [],
        },
        error: null,
      });

      vi.mocked(supabase.functions.invoke).mockImplementation(mockEdgeFunctionInvoke);

      // Send message
      await service.sendMessage(mockMessage);

      // Verify edge function was called with images in metadata
      expect(mockEdgeFunctionInvoke).toHaveBeenCalledWith(
        'idea-framework-consultant-test',
        {
          headers: {
            Authorization: `Bearer ${mockSession.access_token}`,
          },
          body: {
            message: mockMessage.content,
            chat_history: expect.any(Array),
            metadata: {
              images: mockImages,
              useSystemKB: true,
            },
          },
        }
      );
    });

    it('should handle messages without images', async () => {
      const mockUser = { id: 'user-123' };
      const mockSession = {
        access_token: 'mock-token',
        user: mockUser,
      };

      const mockMessage = {
        role: 'user' as const,
        content: 'What is the IDEA Framework?',
        metadata: {
          useSystemKB: true,
        },
      };

      // Mock auth
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      // Mock database operations
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'msg-123',
                    user_id: 'user-123',
                    role: 'user',
                    content: mockMessage.content,
                    metadata: mockMessage.metadata,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                  },
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

      // Mock edge function without images
      const mockEdgeFunctionInvoke = vi.fn().mockResolvedValue({
        data: {
          response: 'The IDEA Framework stands for...',
          suggestions: [],
          sources: [],
        },
        error: null,
      });

      vi.mocked(supabase.functions.invoke).mockImplementation(mockEdgeFunctionInvoke);

      // Send message
      await service.sendMessage(mockMessage);

      // Verify edge function was called without images
      expect(mockEdgeFunctionInvoke).toHaveBeenCalledWith(
        'idea-framework-consultant-test',
        {
          headers: {
            Authorization: `Bearer ${mockSession.access_token}`,
          },
          body: {
            message: mockMessage.content,
            chat_history: expect.any(Array),
            metadata: {
              useSystemKB: true,
            },
          },
        }
      );

      // Verify no images property in metadata
      const callArgs = mockEdgeFunctionInvoke.mock.calls[0][1].body;
      expect(callArgs.metadata.images).toBeUndefined();
    });

    it('should save message with image metadata to database', async () => {
      const mockUser = { id: 'user-123' };
      const mockSession = {
        access_token: 'mock-token',
        user: mockUser,
      };

      const mockImages: ChatImageAttachment[] = [
        {
          id: 'img-1',
          url: 'https://example.com/image1.jpg',
          filename: 'product.jpg',
          mime_type: 'image/jpeg',
          file_size: 1024,
        },
      ];

      const mockMessage = {
        role: 'user' as const,
        content: 'Analyze this image',
        metadata: {
          images: mockImages,
        },
      };

      // Mock auth
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession as any },
        error: null,
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'msg-123',
              user_id: 'user-123',
              role: 'user',
              content: mockMessage.content,
              metadata: mockMessage.metadata,
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      });

      // Mock database operations
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            insert: mockInsert,
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

      // Mock edge function
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          response: 'I can see the product image...',
          suggestions: [],
          sources: [],
        },
        error: null,
      });

      // Send message
      await service.sendMessage(mockMessage);

      // Verify message was saved with image metadata
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        role: 'user',
        content: mockMessage.content,
        chatbot_type: 'idea-framework-consultant',
        session_id: undefined,
        metadata: {
          images: mockImages,
        },
      });
    });
  });

  describe('getChatHistory with images', () => {
    it('should retrieve messages with image metadata', async () => {
      const mockUser = { id: 'user-123' };

      const mockMessages = [
        {
          id: 'msg-1',
          user_id: 'user-123',
          role: 'user',
          content: 'Analyze this image',
          chatbot_type: 'idea-framework-consultant',
          metadata: {
            images: [
              {
                id: 'img-1',
                url: 'https://example.com/image1.jpg',
                filename: 'product.jpg',
              },
            ],
          },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          user_id: 'user-123',
          role: 'assistant',
          content: 'I can see the product image shows...',
          chatbot_type: 'idea-framework-consultant',
          metadata: {
            suggestions: ['How can I improve the image?'],
            sources: [],
          },
          created_at: '2025-01-01T00:01:00Z',
          updated_at: '2025-01-01T00:01:00Z',
        },
      ];

      // Mock auth
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser as any },
        error: null,
      });

      // Mock database query
      vi.mocked(supabase.from).mockImplementation(() => {
        return {
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
        } as any;
      });

      const history = await service.getChatHistory();

      // Verify messages include image metadata
      expect(history).toHaveLength(2);
      expect(history[0].metadata?.images).toEqual([
        {
          id: 'img-1',
          url: 'https://example.com/image1.jpg',
          filename: 'product.jpg',
        },
      ]);
      expect(history[1].metadata?.suggestions).toEqual(['How can I improve the image?']);
    });
  });
});