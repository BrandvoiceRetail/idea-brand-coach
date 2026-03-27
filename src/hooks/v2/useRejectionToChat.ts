/**
 * useRejectionToChat Hook
 *
 * Converts field rejections into contextual assistant messages injected
 * into the chat stream. When a user rejects an AI-extracted field, TrevBot
 * acknowledges the rejection and asks for clarification.
 *
 * Uses injectLocalMessage from useChatOrchestration (Story 0.2) so these
 * messages appear instantly without triggering an edge function call.
 */

import { useCallback } from 'react';
import type { PendingField } from '@/hooks/v2/useExtractionQueue';

// ============================================================================
// Types
// ============================================================================

export interface UseRejectionToChatReturn {
  /** Inject a follow-up message for a single rejected field */
  handleRejection: (field: PendingField) => void;
  /** Inject a combined follow-up message for multiple rejected fields */
  handleBatchRejections: (fields: PendingField[]) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Creates rejection handlers that inject assistant follow-up messages into
 * the chat when the user rejects AI-extracted field values.
 *
 * @param injectLocalMessage - From useChatOrchestration; adds an assistant
 *   message to chat state and persists it without calling the edge function.
 */
export function useRejectionToChat(
  injectLocalMessage: (content: string, metadata?: Record<string, unknown>) => void,
): UseRejectionToChatReturn {
  const handleRejection = useCallback(
    (field: PendingField): void => {
      const content = `Got it, I won't use that for ${field.label}. What would you like instead?`;

      injectLocalMessage(content, {
        injected: true,
        reason: 'field_rejection',
        rejectedFields: [field.fieldId],
      });
    },
    [injectLocalMessage],
  );

  const handleBatchRejections = useCallback(
    (fields: PendingField[]): void => {
      if (fields.length === 0) return;

      if (fields.length === 1) {
        handleRejection(fields[0]);
        return;
      }

      const labels = fields.map((f) => f.label);
      const formattedLabels =
        labels.length === 2
          ? `${labels[0]} and ${labels[1]}`
          : `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;

      const content = `Got it, I won't use those values for ${formattedLabels}. What would you like instead?`;

      injectLocalMessage(content, {
        injected: true,
        reason: 'field_rejection',
        rejectedFields: fields.map((f) => f.fieldId),
      });
    },
    [injectLocalMessage, handleRejection],
  );

  return {
    handleRejection,
    handleBatchRejections,
  };
}
