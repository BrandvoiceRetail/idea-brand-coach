/**
 * useChatSessions Hook
 * React hook for managing chat sessions (like ChatGPT/Claude.ai conversation threads)
 *
 * @param chatbotType - The chatbot type to filter sessions by
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { ChatSession, ChatSessionCreate, ChatSessionUpdate, ChatbotType } from '@/types/chat';
import { useToast } from '@/hooks/use-toast';

interface UseChatSessionsOptions {
  chatbotType?: ChatbotType;
  /** Auto-create a session if none exists */
  autoCreate?: boolean;
}

export const useChatSessions = (options: UseChatSessionsOptions = {}) => {
  const { chatbotType = 'idea-framework-consultant', autoCreate = true } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Local state for current session
  const [currentSessionId, setCurrentSessionIdState] = useState<string | undefined>(undefined);

  // Set chatbot type on service when it changes
  useEffect(() => {
    chatService.setChatbotType(chatbotType);
  }, [chatService, chatbotType]);

  // Query: Get all sessions
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useQuery({
    queryKey: ['chat', 'sessions', chatbotType],
    queryFn: () => chatService.getSessions(),
    retry: 1,
  });

  // Auto-create session if none exists and autoCreate is enabled
  useEffect(() => {
    if (!isLoadingSessions && sessions && sessions.length === 0 && autoCreate && !currentSessionId) {
      // Create a new session automatically
      chatService.createSession().then(newSession => {
        setCurrentSessionIdState(newSession.id);
        chatService.setCurrentSession(newSession.id);
        queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
      }).catch(error => {
        console.error('Failed to auto-create session:', error);
      });
    }
  }, [sessions, isLoadingSessions, autoCreate, currentSessionId, chatService, queryClient, chatbotType]);

  // Set first session as current if none selected and sessions exist
  useEffect(() => {
    if (!isLoadingSessions && sessions && sessions.length > 0 && !currentSessionId) {
      const firstSession = sessions[0];
      setCurrentSessionIdState(firstSession.id);
      chatService.setCurrentSession(firstSession.id);
    }
  }, [sessions, isLoadingSessions, currentSessionId, chatService]);

  // Sync current session ID with service
  const setCurrentSessionId = useCallback((sessionId: string | undefined) => {
    setCurrentSessionIdState(sessionId);
    chatService.setCurrentSession(sessionId);
    // Invalidate messages cache when session changes
    queryClient.invalidateQueries({ queryKey: ['chat', 'messages', chatbotType] });
  }, [chatService, queryClient, chatbotType]);

  // Get current session object
  const currentSession = sessions?.find(s => s.id === currentSessionId) ?? null;

  // Mutation: Create session
  const createSessionMutation = useMutation({
    mutationFn: (data?: ChatSessionCreate) => chatService.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
      // Switch to new session
      setCurrentSessionId(newSession.id);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Creating Session',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Update session
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, update }: { sessionId: string; update: ChatSessionUpdate }) =>
      chatService.updateSession(sessionId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Updating Session',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => chatService.deleteSession(sessionId),
    onSuccess: (_, deletedSessionId) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'sessions', chatbotType] });

      // If deleted current session, switch to another
      if (deletedSessionId === currentSessionId) {
        const remainingSessions = sessions?.filter(s => s.id !== deletedSessionId) ?? [];
        if (remainingSessions.length > 0) {
          setCurrentSessionId(remainingSessions[0].id);
        } else {
          setCurrentSessionId(undefined);
        }
      }

      toast({
        title: 'Session Deleted',
        description: 'The conversation has been deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Deleting Session',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create new chat (convenience wrapper)
  const createNewChat = useCallback(async () => {
    const newSession = await createSessionMutation.mutateAsync();
    return newSession;
  }, [createSessionMutation]);

  // Rename session (convenience wrapper)
  const renameSession = useCallback(async (sessionId: string, title: string) => {
    return updateSessionMutation.mutateAsync({ sessionId, update: { title } });
  }, [updateSessionMutation]);

  // Delete session (convenience wrapper)
  const deleteSession = useCallback(async (sessionId: string) => {
    return deleteSessionMutation.mutateAsync(sessionId);
  }, [deleteSessionMutation]);

  // Switch to session
  const switchToSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, [setCurrentSessionId]);

  return {
    // Data
    sessions: sessions ?? [],
    currentSession,
    currentSessionId,

    // Loading states
    isLoadingSessions,
    isCreating: createSessionMutation.isPending,
    isUpdating: updateSessionMutation.isPending,
    isDeleting: deleteSessionMutation.isPending,

    // Error
    error: sessionsError,

    // Actions
    createNewChat,
    renameSession,
    deleteSession,
    switchToSession,
    setCurrentSessionId,
  };
};
