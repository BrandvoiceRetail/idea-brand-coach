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
import { captureAlphaEvent } from '@/lib/posthogClient';
import { avatarChatMessagesKey, avatarChatSessionsKey } from '@/lib/queryKeys';

interface UseChatOptions {
  chatbotType?: ChatbotType;
  sessionId?: string;
  chapterId?: ChapterId;
  chapterMetadata?: ChapterMetadata;
  /**
   * Active context avatar SET — the per-thread retrieval anchor (design §2.1,
   * set model). Scopes the cache namespace AND rides along in the outgoing
   * message body as `avatar_ids` (the edge-fn union read, M2). `avatarIds[0]` is
   * the focus, also sent as legacy `avatar_id` for back-compat.
   */
  avatarIds?: string[];
  /**
   * Single focus avatar (back-compat shim). Folded into the set as `[avatarId]`
   * when `avatarIds` is not supplied.
   */
  avatarId?: string;
}

export const useChat = (options: UseChatOptions = {}) => {
  const { chatbotType = 'idea-framework-consultant', sessionId, chapterId, chapterMetadata, avatarIds, avatarId } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Normalize to the active SET (the firewall anchor). A bare `avatarId` is the
  // one-member set; an explicit `avatarIds` wins. The focus (`avatar_id`) is the
  // first member.
  const contextAvatarIds = avatarIds ?? (avatarId ? [avatarId] : []);
  const focusAvatarId = contextAvatarIds[0];
  // Stable identity for effect deps (sorted join) so reordering the same set
  // does not retrigger resets.
  const contextAvatarKey = [...new Set(contextAvatarIds)].sort().join(',');

  // Streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedExtractedFields, setStreamedExtractedFields] = useState<
    Array<{ identifier: string; value: unknown; confidence: number; source: string; context?: string }>
  >([]);
  // Transient: Trevor is reading/updating his persistent memory mid-response.
  const [memoryActivity, setMemoryActivity] = useState<'reading' | 'updating' | null>(null);
  const abortRef = useRef(false);

  // Reset streaming state on session switch
  useEffect(() => {
    setStreamingContent('');
    setIsStreaming(false);
    setStreamedExtractedFields([]);
    setMemoryActivity(null);
  }, [sessionId]);

  // Set chatbot type on service when it changes
  useEffect(() => {
    chatService.setChatbotType(chatbotType);
  }, [chatService, chatbotType]);

  // Set current session on service when it changes
  useEffect(() => {
    chatService.setCurrentSession(sessionId);
  }, [chatService, sessionId]);

  // Scope outgoing messages to the current FOCUS avatar (design §2.1). The
  // orchestrator takes a single id today; the full set rides in the message body
  // metadata (see sendMessage/sendMessageStreaming below).
  useEffect(() => {
    chatService.setCurrentAvatar(focusAvatarId);
  }, [chatService, focusAvatarId]);

  // Avatar-scoped cache keys (bleed firewall §2.2, set model): both the
  // per-session message list AND the session list live under the ['avatar', …]
  // namespace so the switch-invalidation predicate (q.queryKey[0] === 'avatar')
  // nukes them. The SET collapses to one stable segment (sorted) so reordering
  // shares a bucket; an empty set collapses to the 'brand' segment.
  const messagesKey = avatarChatMessagesKey(contextAvatarIds, chatbotType, sessionId);
  const sessionsKey = avatarChatSessionsKey(contextAvatarIds, chatbotType);

  // Query: Get chat history (keyed by avatar + chatbot type + session ID)
  const {
    data: messages,
    isLoading,
    error,
  } = useQuery({
    queryKey: messagesKey,
    queryFn: () => chatService.getChatHistory(),
    retry: 1,
    enabled: !!sessionId, // Only fetch if we have a session
  });

  // Stamp the active avatar SET onto the outgoing message metadata (wires M2):
  // the consultant edge fn reads `metadata.avatar_ids` for the union retrieval
  // scope, and `metadata.avatar_id` (the focus) for the legacy single-avatar
  // fallback. The orchestrator spreads `metadata` into the request body, so this
  // is the in-service path to the edge-fn body.
  const withAvatarScope = useCallback((message: ChatMessageCreate): ChatMessageCreate => {
    if (contextAvatarIds.length === 0) return message;
    return {
      ...message,
      metadata: {
        ...message.metadata,
        avatar_ids: contextAvatarIds,
        avatar_id: focusAvatarId,
      },
    };
    // contextAvatarKey encodes the set; focusAvatarId is its first member.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextAvatarKey]);

  // Mutation: Send message (non-streaming fallback, keyed by session)
  const sendMessageMutation = useMutation({
    mutationKey: ['chat', 'sendMessage', chatbotType, sessionId],
    mutationFn: (message: ChatMessageCreate) => chatService.sendMessage({
      ...withAvatarScope(message),
      chatbot_type: chatbotType,
      ...(chapterId && { chapter_id: chapterId }),
      ...(chapterMetadata && { chapter_metadata: chapterMetadata }),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: messagesKey });
      if (data.titlePromise) {
        data.titlePromise.finally(() => {
          queryClient.invalidateQueries({ queryKey: sessionsKey });
        });
      }
    },
    onError: (error: Error) => {
      captureAlphaEvent('llm_call_failed', { which_call: 'conversation', error_type: 'send_error' });
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

    // User-perceived latency: start → first token (TTFT) and start → complete (total).
    const startedAt = performance.now();
    let firstTokenAt: number | null = null;
    const ttftMs = (): number | null =>
      firstTokenAt !== null ? Math.round(firstTokenAt - startedAt) : null;
    const totalMs = (): number => Math.round(performance.now() - startedAt);

    try {
      await chatService.sendMessageStreaming(
        {
          ...withAvatarScope(message),
          chatbot_type: chatbotType,
          ...(chapterId && { chapter_id: chapterId }),
          ...(chapterMetadata && { chapter_metadata: chapterMetadata }),
        },
        {
          onTextDelta: (delta: string) => {
            if (!abortRef.current) {
              if (firstTokenAt === null) firstTokenAt = performance.now();
              setMemoryActivity(null);
              setStreamingContent(prev => prev + delta);
            }
          },
          onExtractedFields: (fields) => {
            setStreamedExtractedFields(fields);
          },
          onMemoryActivity: (action) => {
            if (!abortRef.current) {
              setMemoryActivity(action);
            }
          },
          onComplete: () => {
            setIsStreaming(false);
            setStreamingContent('');
            setMemoryActivity(null);
            captureAlphaEvent('chat_response_latency', {
              ok: true,
              chatbot_type: chatbotType,
              chapter_id: chapterId ?? null,
              ttft_ms: ttftMs(),
              total_ms: totalMs(),
            });
            // Refresh messages from DB (now includes the saved assistant message)
            queryClient.invalidateQueries({ queryKey: messagesKey });
            // Refresh sidebar for potential title update
            queryClient.invalidateQueries({ queryKey: sessionsKey });
          },
          onError: (error: Error) => {
            setIsStreaming(false);
            setStreamingContent('');
            setMemoryActivity(null);
            // Covers stream-body errors too (HTTP 200 wrapping a failure)
            captureAlphaEvent('llm_call_failed', { which_call: 'conversation', error_type: 'stream_error' });
            captureAlphaEvent('chat_response_latency', {
              ok: false,
              chatbot_type: chatbotType,
              chapter_id: chapterId ?? null,
              ttft_ms: ttftMs(),
              total_ms: totalMs(),
              error_type: 'stream_error',
            });
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
      setMemoryActivity(null);
      captureAlphaEvent('llm_call_failed', { which_call: 'conversation', error_type: 'exception' });
      captureAlphaEvent('chat_response_latency', {
        ok: false,
        chatbot_type: chatbotType,
        chapter_id: chapterId ?? null,
        ttft_ms: ttftMs(),
        total_ms: totalMs(),
        error_type: 'exception',
      });
      toast({
        title: 'Error Sending Message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
    // sessionId is encoded inside messagesKey/sessionsKey, so it is not a
    // separate dependency here.
  }, [chatService, chatbotType, chapterId, chapterMetadata, queryClient, toast, messagesKey, sessionsKey, withAvatarScope]);

  // Mutation: Clear chat history (keyed by session to reset state on session switch)
  const clearChatMutation = useMutation({
    mutationKey: ['chat', 'clearChat', chatbotType, sessionId],
    mutationFn: () => chatService.clearChatHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesKey });
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
    memoryActivity,
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
