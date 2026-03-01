/**
 * useFieldSync Hook
 * Synchronizes chat responses to brand fields with local-first persistence
 * Combines patterns from useChat and usePersistedField
 */

import { useEffect, useCallback, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { usePersistedField } from '@/hooks/usePersistedField';
import { usePanelCommunication } from '@/v2/contexts/PanelCommunicationContext';
import type { ChatMessage, ChatbotType } from '@/types/chat';
import type { KnowledgeCategory } from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for field sync hook
 */
interface UseFieldSyncConfig {
  /** Field identifier to sync to */
  fieldIdentifier: string;

  /** Knowledge category for the field */
  category: KnowledgeCategory;

  /** Optional chatbot type (defaults to 'idea-framework-consultant') */
  chatbotType?: ChatbotType;

  /** Optional session ID to scope messages */
  sessionId?: string;

  /** Optional panel to notify when field updates */
  sourcePanel?: 'left' | 'center' | 'right';

  /** Optional extractor function to parse field value from chat message */
  extractValue?: (message: ChatMessage) => string | null;

  /** Enable auto-sync (default: true) */
  autoSync?: boolean;
}

/**
 * Return type for field sync hook
 */
interface UseFieldSyncReturn {
  /** Current field value */
  fieldValue: string;

  /** Update field value manually */
  updateField: (newValue: string) => void;

  /** Latest chat messages */
  messages: ChatMessage[];

  /** Sync specific message to field */
  syncMessage: (messageId: string) => Promise<void>;

  /** Force sync latest assistant message */
  syncLatestMessage: () => Promise<void>;

  /** Loading states */
  isLoading: boolean;
  isSyncing: boolean;

  /** Error state */
  error: Error | null;
}

/**
 * Default value extractor - looks for field value in message metadata
 */
const defaultExtractValue = (message: ChatMessage): string | null => {
  if (message.role !== 'assistant') {
    return null;
  }

  // Check metadata for field value
  if (message.metadata?.fieldValue) {
    return String(message.metadata.fieldValue);
  }

  // Check metadata for structured data
  if (message.metadata?.structuredData) {
    return JSON.stringify(message.metadata.structuredData, null, 2);
  }

  // Fallback to content for assistant messages
  return message.content || null;
};

/**
 * Hook for synchronizing chat responses to brand fields
 * Provides automatic or manual sync of AI responses to persisted fields
 */
export function useFieldSync({
  fieldIdentifier,
  category,
  chatbotType = 'idea-framework-consultant',
  sessionId,
  sourcePanel = 'center',
  extractValue = defaultExtractValue,
  autoSync = true,
}: UseFieldSyncConfig): UseFieldSyncReturn {
  // Get chat state
  const { messages, isLoading: isChatLoading } = useChat({
    chatbotType,
    sessionId,
  });

  // Get persisted field state
  const {
    value: fieldValue,
    onChange: updateFieldValue,
    isLoading: isFieldLoading,
    error,
  } = usePersistedField({
    fieldIdentifier,
    category,
    defaultValue: '',
  });

  // Get panel communication for notifications
  const { notifyFieldUpdate } = usePanelCommunication();

  // Track last synced message to avoid duplicate syncs
  const lastSyncedMessageIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  /**
   * Sync a specific message to the field
   */
  const syncMessage = useCallback(
    async (messageId: string): Promise<void> => {
      const message = messages.find((msg) => msg.id === messageId);
      if (!message) {
        return;
      }

      // Extract value from message
      const extractedValue = extractValue(message);
      if (extractedValue === null || extractedValue === '') {
        return;
      }

      // Prevent duplicate syncs
      if (lastSyncedMessageIdRef.current === messageId) {
        return;
      }

      isSyncingRef.current = true;
      lastSyncedMessageIdRef.current = messageId;

      try {
        // Update field (triggers local-first persistence + background sync)
        updateFieldValue(extractedValue);

        // Notify other panels about the update
        notifyFieldUpdate(fieldIdentifier, extractedValue, sourcePanel);
      } catch (err) {
        console.error('[useFieldSync] Failed to sync message:', err);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [messages, extractValue, updateFieldValue, notifyFieldUpdate, fieldIdentifier, sourcePanel]
  );

  /**
   * Sync the latest assistant message
   */
  const syncLatestMessage = useCallback(async (): Promise<void> => {
    // Find the most recent assistant message
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === 'assistant');

    if (!latestAssistantMessage) {
      return;
    }

    await syncMessage(latestAssistantMessage.id);
  }, [messages, syncMessage]);

  /**
   * Auto-sync effect - syncs latest assistant message when messages change
   */
  useEffect(() => {
    if (!autoSync || messages.length === 0) {
      return;
    }

    // Find latest assistant message
    const latestAssistantMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === 'assistant');

    if (!latestAssistantMessage) {
      return;
    }

    // Skip if already synced this message
    if (lastSyncedMessageIdRef.current === latestAssistantMessage.id) {
      return;
    }

    // Skip if currently syncing
    if (isSyncingRef.current) {
      return;
    }

    // Auto-sync the latest message
    void syncMessage(latestAssistantMessage.id);
  }, [messages, autoSync, syncMessage]);

  /**
   * Manual field update (bypasses chat sync)
   */
  const updateField = useCallback(
    (newValue: string): void => {
      updateFieldValue(newValue);
      notifyFieldUpdate(fieldIdentifier, newValue, sourcePanel);
    },
    [updateFieldValue, notifyFieldUpdate, fieldIdentifier, sourcePanel]
  );

  return {
    fieldValue,
    updateField,
    messages,
    syncMessage,
    syncLatestMessage,
    isLoading: isChatLoading || isFieldLoading,
    isSyncing: isSyncingRef.current,
    error,
  };
}
