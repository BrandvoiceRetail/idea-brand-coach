/**
 * useChat Hook
 * React hook for IDEA Framework Consultant chat operations
 *
 * @param chatbotType - Optional chatbot type (defaults to 'idea-framework-consultant')
 * @param sessionId - Optional session ID to scope messages to specific session
 * @param chapterId - Optional chapter ID for book-guided chat workflow
 * @param chapterMetadata - Optional chapter metadata for context-aware responses
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { ChatMessageCreate, ChatbotType } from '@/types/chat';
import { ChapterId, ChapterMetadata } from '@/types/chapter';
import { useToast } from '@/hooks/use-toast';

interface UseChatOptions {
  chatbotType?: ChatbotType;
  sessionId?: string;
  chapterId?: ChapterId;
  chapterMetadata?: ChapterMetadata;
}

export const useChat = (options: UseChatOptions = {}) => {
  const { chatbotType = 'idea-framework-consultant', sessionId, chapterId, chapterMetadata } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedExtractedFields, setStreamedExtractedFields] = useState<
    Array<{ identifier: string; value: unknown; confidence: number; source: string; context?: string }>
  >([]);
  const abortRef = useRef(false);

  // Reset streaming state on session switch
  useEffect(() => {
    setStreamingContent('');
    setIsStreaming(false);
    setStreamedExtractedFields([]);
  }, [sessionId]);

  // Set chatbot type on service when it changes
  useEffect(() => {
    chatService.setChatbotType(chatbotType);
  }, [chatService, chatbotType]);

  // Set current session on service when it changes
  useEffect(() => {
    chatService.setCurrentSession(sessionId);
  }, [chatService, sessionId]);

  // Query: Get chat history (keyed by chatbot type AND session ID for per-session caching)
  const {
    data: messages,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chat', 'messages', chatbotType, sessionId],
    queryFn: () => chatService.getChatHistory(),
    retry: 1,
    enabled: !!sessionId, // Only fetch if we have a session
  });

  // Mutation: Send message (non-streaming fallback, keyed by session)
  const sendMessageMutation = useMutation({
    mutationKey: ['chat', 'sendMessage', chatbotType, sessionId],
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage({
      ...message,
      chatbot_type: chatbotType,
      ...(chapterId && { chapter_id: chapterId }),
      ...(chapterMetadata && { chapter_metadata: chapterMetadata }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType, sessionId] });
      if (data.titlePromise) {
        data.titlePromise.finally(() => {
          queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Sending Message',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Streaming send message
  const sendMessageStreaming = useCallback(async (message: ChatMessageCreate): Promise<void> => {
    setStreamingContent('');
    setStreamedExtractedFields([]);
    setIsStreaming(true);
    abortRef.current = false;

    try {
      await chatService.sendMessageStreaming(
        {
          ...message,
          chatbot_type: chatbotType,
          ...(chapterId && { chapter_id: chapterId }),
          ...(chapterMetadata && { chapter_metadata: chapterMetadata }),
        },
        {
          onTextDelta: (delta: string) => {
            if (!abortRef.current) {
              setStreamingContent(prev => prev + delta);
            }
          },
          onExtractedFields: (fields) => {
            setStreamedExtractedFields(fields);
          },
          onComplete: () => {
            setIsStreaming(false);
            setStreamingContent('');
            // Refresh messages from DB (now includes the saved assistant message)
            queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType, sessionId] });
            // Refresh sidebar for potential title update
            queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
          },
          onError: (error: Error) => {
            setIsStreaming(false);
            setStreamingContent('');
            toast({
              title: 'Streaming Error',
              description: error.message,
              variant: 'destructive',
            });
          },
        }
      );
    } catch (error) {
      setIsStreaming(false);
      setStreamingContent('');
      toast({
        title: 'Error Sending Message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [chatService, chatbotType, chapterId, chapterMetadata, sessionId, queryClient, toast]);

  // Mutation: Clear chat history (keyed by session to reset state on session switch)
  const clearChatMutation = useMutation({
    mutationKey: ['chat', 'clearChat', chatbotType, sessionId],
    mutationFn: () => chatService.clearChatHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType, sessionId] });
      toast({
        title: 'Chat Cleared',
        description: 'Your conversation has been cleared.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Clearing Chat',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    messages: messages || [],

    // Loading states
    isLoading,
    isSending: sendMessageMutation.isPending || isStreaming,

    // Streaming
    isStreaming,
    streamingContent,
    streamedExtractedFields,
    sendMessageStreaming,

    // Error
    error,

    // Mutations
    sendMessage: sendMessageMutation.mutateAsync,
    clearChat: clearChatMutation.mutate,
    isClearing: clearChatMutation.isPending,

    // Last response data (includes suggestions and sources)
    lastResponse: sendMessageMutation.data,
  };
};
