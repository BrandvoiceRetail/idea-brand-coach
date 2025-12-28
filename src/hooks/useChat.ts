/**
 * useChat Hook
 * React hook for IDEA Framework Consultant chat operations
 *
 * @param chatbotType - Optional chatbot type (defaults to 'idea-framework-consultant')
 * @param sessionId - Optional session ID to scope messages to specific session
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { ChatMessageCreate, ChatbotType } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

interface UseChatOptions {
  chatbotType?: ChatbotType;
  sessionId?: string;
}

export const useChat = (options: UseChatOptions = {}) => {
  const { chatbotType = 'idea-framework-consultant', sessionId } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // Mutation: Send message (keyed by session to reset state on session switch)
  const sendMessageMutation = useMutation({
    mutationKey: ['chat', 'sendMessage', chatbotType, sessionId],
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage({
      ...message,
      chatbot_type: chatbotType,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType, sessionId] });
      // Wait for title generation to complete, then refresh sidebar
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
    isSending: sendMessageMutation.isPending,
    
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
