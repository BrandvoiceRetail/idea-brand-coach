/**
 * useBrandCoachChat Hook
 *
 * Extracted from BrandCoachV2.tsx — encapsulates message processing,
 * display message computation, optimistic pending messages, and the
 * handleSendMessage flow including chapter context building.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { ChapterContext, ChapterId } from '@/types/chapter';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';

/**
 * Collects all field IDs and their labels from CHAPTER_FIELDS_MAP.
 * Deduplicated helper — used by both handleSendMessage and document upload flows.
 */
export function collectCurrentFields(): {
  allFieldsToCapture: string[];
  allFieldLabels: Record<string, string>;
} {
  const allFieldsToCapture: string[] = [];
  const allFieldLabels: Record<string, string> = {};

  Object.values(CHAPTER_FIELDS_MAP).forEach(chapter => {
    if (chapter.fields) {
      chapter.fields.forEach(field => {
        allFieldsToCapture.push(field.id);
        allFieldLabels[field.id] = field.label;
      });
    }
  });

  return { allFieldsToCapture, allFieldLabels };
}

/** Minimal chapter shape needed by this hook */
interface ChapterInfo {
  id: ChapterId;
  number: number;
  title: string;
}

/**
 * A local-only assistant message injected into the display list
 * (e.g., rejection follow-ups). Not persisted to Supabase.
 */
export interface InjectedAssistantMessage {
  /** Unique identifier for deduplication */
  id: string;
  /** Markdown content to display */
  content: string;
  /** ISO 8601 timestamp for ordering */
  created_at: string;
}

interface UseBrandCoachChatConfig {
  /** Messages from the useChat hook */
  messages: ChatMessage[];
  /** Current chapter the user is on */
  currentChapter: ChapterInfo | null;
  /** Current field values for context */
  fieldValues: Record<string, string | string[]>;
  /** Currently focused field ID */
  focusedFieldId: string | null;
  /** User documents for context */
  userDocuments: unknown[];
  /** Whether system KB is enabled */
  isSystemKBEnabled: boolean;
  /** Latest diagnostic data */
  latestDiagnostic: unknown | null;
  /** Streaming send function from useChat */
  sendMessageStreaming: (message: ChatMessageCreate) => Promise<void>;
  /** Local-only assistant messages to merge into the display list */
  injectedMessages?: InjectedAssistantMessage[];
}

interface PendingUserMessage {
  id: string;
  content: string;
  role: 'user';
  created_at: string;
}

/** A processed message that may include extractedFields for badge display */
export type ProcessedMessage = ChatMessage & {
  extractedFields?: Record<string, string>;
};

interface UseBrandCoachChatReturn {
  /** Processed messages filtered for display (no system messages) with pending */
  messagesWithPending: ProcessedMessage[];
  /** Display messages without pending (used for export/copy) */
  displayMessages: ProcessedMessage[];
  /** Currently pending optimistic user message */
  pendingUserMessage: PendingUserMessage | null;
  /** Send a message with full chapter context */
  handleSendMessage: (content: string) => Promise<void>;
  /** Clear the pending optimistic message */
  clearPendingMessage: () => void;
  /** Set field interaction counts callback (for focused field tracking) */
  onFieldInteraction: (fieldId: string) => void;
}

export function useBrandCoachChat(config: UseBrandCoachChatConfig): UseBrandCoachChatReturn {
  const {
    messages,
    currentChapter,
    fieldValues,
    focusedFieldId,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
    sendMessageStreaming,
    injectedMessages = [],
  } = config;

  const [pendingUserMessage, setPendingUserMessage] = useState<PendingUserMessage | null>(null);
  const [fieldInteractionCounts, setFieldInteractionCounts] = useState<Record<string, number>>({});

  // Pure display transformation — builds extractedFields from metadata for badge rendering
  const processedMessages = useMemo<ProcessedMessage[]>(() => {
    return messages.map((msg) => {
      if (msg.role !== 'assistant') return msg;

      const metaFields = (msg.metadata as Record<string, unknown>)?.extractedFields as
        | Array<{ identifier: string; value: unknown }>
        | undefined;

      if (metaFields?.length) {
        const extractedFields: Record<string, string> = {};
        for (const field of metaFields) {
          extractedFields[field.identifier] = Array.isArray(field.value)
            ? field.value.join(', ')
            : String(field.value);
        }

        let finalContent = msg.content;
        if (Object.keys(extractedFields).length > 0 && msg.content.includes('document')) {
          const fieldCount = Object.keys(extractedFields).length;
          finalContent = `${msg.content}\n\n✨ **Success!** I've extracted ${fieldCount} brand element${fieldCount !== 1 ? 's' : ''} from your document. Click the green badges below to review each one!`;
        }

        return { ...msg, content: finalContent, extractedFields };
      }

      return msg;
    });
  }, [messages]);

  // Convert injected local-only messages to ProcessedMessage shape
  const injectedAsProcessed = useMemo<ProcessedMessage[]>(() => {
    return injectedMessages.map((msg) => ({
      id: msg.id,
      user_id: 'system',
      role: 'assistant' as const,
      content: msg.content,
      created_at: msg.created_at,
      updated_at: msg.created_at,
      metadata: { isInjected: true },
    }));
  }, [injectedMessages]);

  // Filter system messages from display and merge injected messages
  const displayMessages = useMemo<ProcessedMessage[]>(() => {
    const persisted = processedMessages.filter((msg) => !msg.metadata?.isSystemMessage);
    if (injectedAsProcessed.length === 0) return persisted;

    // Merge and sort by created_at to maintain chronological order
    const merged = [...persisted, ...injectedAsProcessed];
    merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return merged;
  }, [processedMessages, injectedAsProcessed]);

  // Merge pending optimistic message with display messages
  const messagesWithPending = useMemo<ProcessedMessage[]>(() => {
    if (!pendingUserMessage) return displayMessages;
    const alreadyShown = displayMessages.some(
      m => m.role === 'user' && m.content === pendingUserMessage.content,
    );
    if (alreadyShown) return displayMessages;
    return [...displayMessages, pendingUserMessage as unknown as ProcessedMessage];
  }, [displayMessages, pendingUserMessage]);

  // Clear pending message once the real message appears
  useEffect(() => {
    if (pendingUserMessage && displayMessages.length > 0) {
      const lastUserMsg = [...displayMessages].reverse().find(m => m.role === 'user');
      if (lastUserMsg && lastUserMsg.content === pendingUserMessage.content) {
        setPendingUserMessage(null);
      }
    }
  }, [displayMessages, pendingUserMessage]);

  const onFieldInteraction = useCallback((fieldId: string): void => {
    setFieldInteractionCounts(prev => ({
      ...prev,
      [fieldId]: (prev[fieldId] || 0) + 1,
    }));
  }, []);

  /**
   * Send a message with chapter context metadata
   */
  const handleSendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;

    const currentChapterKey = currentChapter
      ? BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[currentChapter.number]
      : undefined;

    const { allFieldsToCapture, allFieldLabels } = collectCurrentFields();

    // Get focused field details if one is selected
    let currentFieldDetails = null;
    if (focusedFieldId) {
      for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
        const field = chapter.fields?.find(f => f.id === focusedFieldId);
        if (field) {
          currentFieldDetails = {
            id: field.id,
            label: field.label,
            type: field.type,
            helpText: field.helpText,
          };
          break;
        }
      }

      // Track field interaction
      onFieldInteraction(focusedFieldId);
    }

    const chapterContext: ChapterContext = {
      chapterId: currentChapter?.id || 'all-chapters',
      chapterTitle: currentChapter?.title || 'All Chapters',
      chapterNumber: currentChapter?.number || 0,
      fieldsToCapture: allFieldsToCapture,
      fieldLabels: allFieldLabels,
      focusedField: focusedFieldId,
      currentFieldDetails,
      comprehensiveMode: false,
      currentFieldValues: fieldValues,
      currentChapterKey,
    };

    try {
      const messagePayload: ChatMessageCreate = {
        content,
        role: 'user' as const,
        chapterContext,
        metadata: {
          userDocuments,
          useSystemKB: isSystemKBEnabled,
          latestDiagnostic: latestDiagnostic || undefined,
        },
      };

      // Show message optimistically before backend round-trip
      setPendingUserMessage({
        id: `pending-${Date.now()}`,
        content,
        role: 'user',
        created_at: new Date().toISOString(),
      });

      await sendMessageStreaming(messagePayload);
    } catch (error) {
      console.error('Error sending message:', error);
      setPendingUserMessage(null);
    }
  }, [
    currentChapter,
    fieldValues,
    focusedFieldId,
    userDocuments,
    isSystemKBEnabled,
    latestDiagnostic,
    sendMessageStreaming,
    onFieldInteraction,
  ]);

  const clearPendingMessage = useCallback((): void => {
    setPendingUserMessage(null);
  }, []);

  return {
    messagesWithPending,
    displayMessages,
    pendingUserMessage,
    handleSendMessage,
    clearPendingMessage,
    onFieldInteraction,
  };
}
