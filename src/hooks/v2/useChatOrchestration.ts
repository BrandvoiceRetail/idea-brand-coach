/**
 * useChatOrchestration Hook
 *
 * Owns chat message processing (useBrandCoachChat), export actions,
 * document upload flow, and review context state.
 *
 * Note: useChat and useChatSessions are called in the composer because
 * their outputs (messages, currentSessionId) are shared with useFieldOrchestration.
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBrandCoachChat } from '@/hooks/useBrandCoachChat';
import { useChatExportActions } from '@/hooks/useChatExportActions';
import { useDocumentUploadFlow } from '@/hooks/useDocumentUploadFlow';
import { ChatMessageService } from '@/services/chat/ChatMessageService';
import type { ProcessedMessage } from '@/hooks/useBrandCoachChat';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';
import type { Chapter } from '@/types/chapter';
import type { UploadedDocument } from '@/types/document';
import { useServices } from '@/services/ServiceProvider';

// ============================================================================
// Types
// ============================================================================

export interface UseChatOrchestrationConfig {
  /** Current user ID for message persistence */
  userId: string | undefined;
  /** Current chat session ID */
  sessionId: string | undefined;
  /** Raw messages from useChat */
  messages: ChatMessage[];
  /** Streaming send function from useChat */
  sendMessageStreaming: (message: ChatMessageCreate) => Promise<void>;
  /** Non-streaming send function from useChat */
  sendMessage: (message: ChatMessageCreate) => Promise<unknown>;
  /** Clear chat function from useChat */
  clearChat: () => void;
  /** Current chapter for chat context */
  currentChapter: Chapter | null;
  /** Current field values for chat context */
  fieldValues: Record<string, string | string[]>;
  /** Currently focused field ID */
  focusedFieldId: string | null;
  /** User documents for context */
  userDocuments: UploadedDocument[];
  /** Whether system KB is enabled */
  isSystemKBEnabled: boolean;
  /** Latest diagnostic data */
  latestDiagnostic: unknown | null;
}

export interface UseChatOrchestrationReturn {
  /** Processed messages with pending optimistic messages */
  messagesWithPending: ProcessedMessage[];
  /** Display messages (filtered, no system messages) */
  displayMessages: ProcessedMessage[];
  /** Send a message with full chapter context */
  handleSendMessage: (content: string) => Promise<void>;

  /** Export actions */
  isCopied: boolean;
  handleCopyChat: () => void;
  handleClearChat: () => Promise<void>;
  downloadResponse: () => void;

  /** Document upload */
  isExtractingFromDoc: boolean;
  handleDocumentUploadComplete: (doc: { id: string; filename: string }) => Promise<void>;

  /** Inject a local assistant message without triggering edge function */
  injectLocalMessage: (content: string, metadata?: Record<string, unknown>) => void;

  /** Review context state */
  reviewContextActive: boolean;
  reviewEnrichmentStatus: 'none' | 'pending' | 'complete';
  reviewCount: number;
  handleSendReviewContext: (contextString: string) => void;
  handleEnrichmentComplete: (contextString: string, totalReviews: number) => void;
  handleClearReviewContext: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useChatOrchestration({
  userId,
  sessionId,
  messages,
  sendMessageStreaming,
  sendMessage,
  clearChat,
  currentChapter,
  fieldValues,
  focusedFieldId,
  userDocuments,
  isSystemKBEnabled,
  latestDiagnostic,
}: UseChatOrchestrationConfig): UseChatOrchestrationReturn {
  const { toast } = useToast();
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const chatMessageServiceRef = useRef(new ChatMessageService());

  // ── Review context state ──────────────────────────────────────────────
  const [reviewContextActive, setReviewContextActive] = useState(false);
  const [reviewEnrichmentStatus, setReviewEnrichmentStatus] = useState<'none' | 'pending' | 'complete'>('none');
  const [reviewCount, setReviewCount] = useState(0);

  const handleSendReviewContext = useCallback((contextString: string): void => {
    chatService.setCompetitiveInsightsContext(contextString);
    setReviewContextActive(true);
    setReviewEnrichmentStatus('pending');
    toast({ title: 'Review data shared with Trevor', description: 'Competitor analysis context is now available in chat.' });
  }, [chatService, toast]);

  const handleEnrichmentComplete = useCallback((contextString: string, totalReviews: number): void => {
    chatService.setCompetitiveInsightsContext(contextString);
    setReviewEnrichmentStatus('complete');
    setReviewCount(totalReviews);
  }, [chatService]);

  const handleClearReviewContext = useCallback((): void => {
    chatService.setCompetitiveInsightsContext(null);
    setReviewContextActive(false);
    setReviewEnrichmentStatus('none');
    setReviewCount(0);
  }, [chatService]);

  // ── Brand coach chat processing ───────────────────────────────────────
  const { messagesWithPending, displayMessages, handleSendMessage } = useBrandCoachChat({
    messages,
    currentChapter,
    fieldValues,
    focusedFieldId,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
    sendMessageStreaming,
  });

  // ── Export actions ────────────────────────────────────────────────────
  const { isCopied, downloadResponse, handleCopyChat, handleClearChat } = useChatExportActions({
    displayMessages,
    clearChat,
  });

  // ── Local message injection (no edge function) ───────────────────────
  const injectLocalMessage = useCallback((content: string, metadata?: Record<string, unknown>): void => {
    const mergedMetadata: Record<string, unknown> = {
      injected: true,
      ...metadata,
    };

    // 1. Optimistically add to React Query cache so it appears immediately
    const optimisticMessage: ChatMessage = {
      id: `injected-${Date.now()}`,
      user_id: userId || '',
      session_id: sessionId,
      role: 'assistant',
      content,
      chatbot_type: 'idea-framework-consultant',
      metadata: mergedMetadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    queryClient.setQueryData<ChatMessage[]>(
      ['chat', 'messages', 'idea-framework-consultant', sessionId],
      (prev) => [...(prev || []), optimisticMessage],
    );

    // 2. Persist to chat_messages table (fire-and-forget)
    if (userId && sessionId) {
      chatMessageServiceRef.current.saveAssistantMessage(
        userId,
        content,
        'idea-framework-consultant',
        sessionId,
        mergedMetadata,
      ).then(({ data, error }) => {
        if (error) {
          console.error('[Chat] Failed to persist injected message:', error.message);
        } else if (data) {
          // Replace optimistic ID with real DB ID in the cache
          queryClient.setQueryData<ChatMessage[]>(
            ['chat', 'messages', 'idea-framework-consultant', sessionId],
            (prev) => prev?.map(msg =>
              msg.id === optimisticMessage.id ? data : msg
            ) || [],
          );
        }
      });
    }
  }, [userId, sessionId, queryClient]);

  // ── Document upload flow ──────────────────────────────────────────────
  const { isExtractingFromDoc, handleDocumentUploadComplete } = useDocumentUploadFlow({
    sendMessage,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
  });

  return {
    messagesWithPending,
    displayMessages,
    handleSendMessage,
    isCopied,
    handleCopyChat,
    handleClearChat,
    downloadResponse,
    isExtractingFromDoc,
    handleDocumentUploadComplete,
    injectLocalMessage,
    reviewContextActive,
    reviewEnrichmentStatus,
    reviewCount,
    handleSendReviewContext,
    handleEnrichmentComplete,
    handleClearReviewContext,
  };
}
