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
  /** Filter to only field-level conversations */
  conversationType?: 'general' | 'field';
  /** Filter to a specific field ID (requires conversationType: 'field') */
  fieldId?: string;
  /** Field label for session title (used when creating field sessions) */
  fieldLabel?: string;
}

export const useChatSessions = (options: UseChatSessionsOptions = {}) => {
  const {
    chatbotType = 'idea-framework-consultant',
    autoCreate = true,
    conversationType,
    fieldId,
    fieldLabel,
  } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Local state for current session
  const [currentSessionId, setCurrentSessionIdState] = useState<string | undefined>(undefined);

  // Set chatbot type on service when it changes
  useEffect(() => {
    chatService.setChatbotType(chatbotType);
  }, [chatService, chatbotType]);

  // Build query key based on filters
  const queryKey = conversationType === 'field' && fieldId
    ? ['chat', 'sessions', chatbotType, 'field', fieldId]
    : ['chat', 'sessions', chatbotType];

  // Query: Get all sessions (with optional filtering)
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const allSessions = await chatService.getSessions();
      // Filter by conversation type and field ID if specified
      if (conversationType === 'field' && fieldId) {
        return allSessions.filter(
          s => s.conversation_type === 'field' && s.field_id === fieldId
        );
      }
      if (conversationType) {
        return allSessions.filter(s => s.conversation_type === conversationType);
      }
      return allSessions;
    },
    retry: 1,
  });

  // Build session create data with field context if applicable
  const buildSessionCreateData = useCallback((): ChatSessionCreate => {
    if (conversationType === 'field' && fieldId) {
      return {
        title: fieldLabel || 'Field Chat',
        conversation_type: 'field',
        field_id: fieldId,
        field_label: fieldLabel,
      };
    }
    return {};
  }, [conversationType, fieldId, fieldLabel]);

  // Auto-create session if none exists and autoCreate is enabled
  useEffect(() => {
    if (!isLoadingSessions && sessions && sessions.length === 0 && autoCreate && !currentSessionId) {
      // Create a new session automatically
      const sessionData = buildSessionCreateData();
      chatService.createSession(sessionData).then(newSession => {
        setCurrentSessionIdState(newSession.id);
        chatService.setCurrentSession(newSession.id);
        queryClient.invalidateQueries({ queryKey });
      }).catch(error => {
        console.error('Failed to auto-create session:', error);
      });
    }
  }, [sessions, isLoadingSessions, autoCreate, currentSessionId, chatService, queryClient, queryKey, buildSessionCreateData]);

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
    // Note: No need to invalidate messages - the query key includes sessionId
    // so React Query will automatically fetch messages for the new session
  }, [chatService]);

  // Get current session object
  const currentSession = sessions?.find(s => s.id === currentSessionId) ?? null;

  // Mutation: Create session
  const createSessionMutation = useMutation({
    mutationFn: (data?: ChatSessionCreate) => chatService.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey });
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
      queryClient.invalidateQueries({ queryKey });
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
      queryClient.invalidateQueries({ queryKey });

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
    const sessionData = buildSessionCreateData();
    const newSession = await createSessionMutation.mutateAsync(sessionData);
    return newSession;
  }, [createSessionMutation, buildSessionCreateData]);

  // Rename session (convenience wrapper)
  const renameSession = useCallback(async (sessionId: string, title: string) => {
    return updateSessionMutation.mutateAsync({ sessionId, update: { title } });
  }, [updateSessionMutation]);

  // Delete session (convenience wrapper)
  const deleteSession = useCallback(async (sessionId: string) => {
    return deleteSessionMutation.mutateAsync(sessionId);
  }, [deleteSessionMutation]);

  // Mutation: Regenerate title
  const regenerateTitleMutation = useMutation({
    mutationFn: (sessionId: string) => chatService.regenerateSessionTitle(sessionId),
    onSuccess: (newTitle) => {
      if (newTitle) {
        queryClient.invalidateQueries({ queryKey });
        toast({
          title: 'Title Updated',
          description: `New title: "${newTitle}"`,
        });
      } else {
        toast({
          title: 'Could Not Generate Title',
          description: 'Try again or rename manually.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Generating Title',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Regenerate title (convenience wrapper)
  const regenerateTitle = useCallback(async (sessionId: string) => {
    return regenerateTitleMutation.mutateAsync(sessionId);
  }, [regenerateTitleMutation]);

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
    isRegeneratingTitle: regenerateTitleMutation.isPending,

    // Error
    error: sessionsError,

    // Actions
    createNewChat,
    renameSession,
    deleteSession,
    regenerateTitle,
    switchToSession,
    setCurrentSessionId,
  };
};
