/**
 * useChat Hook
 * React hook for Brand Coach chat operations
 *
 * @param chatbotType - Optional chatbot type ('brand-coach' or 'idea-framework-consultant')
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { ChatMessageCreate, ChatbotType } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

interface UseChatOptions {
  chatbotType?: ChatbotType;
}

export const useChat = (options: UseChatOptions = {}) => {
  const { chatbotType = 'brand-coach' } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Set chatbot type on service when it changes
  useEffect(() => {
    chatService.setChatbotType(chatbotType);
  }, [chatService, chatbotType]);

  // Query: Get chat history (keyed by chatbot type for separate caches)
  const {
    data: messages,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chat', 'messages', chatbotType],
    queryFn: () => chatService.getChatHistory(),
    retry: 1,
  });

  // Mutation: Send message
  const sendMessageMutation = useMutation({
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage({
      ...message,
      chatbot_type: chatbotType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType] });
      // Also invalidate sessions to refresh titles in sidebar
      // Delay slightly to allow title generation to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Sending Message',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Clear chat history
  const clearChatMutation = useMutation({
    mutationFn: () => chatService.clearChatHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType] });
      toast({
        title: 'Chat Cleared',
        description: 'Your chat history has been cleared.',
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
