/**
 * useChat Hook
 * React hook for Brand Coach chat operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { ChatMessageCreate } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

export const useChat = () => {
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query: Get chat history
  const {
    data: messages,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chat', 'messages'],
    queryFn: () => chatService.getChatHistory(),
    retry: 1,
  });

  // Mutation: Send message
  const sendMessageMutation = useMutation({
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
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
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
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
