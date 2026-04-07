/**
 * useRejectionMessages Hook
 *
 * Tracks field rejections during a review batch and generates local-only
 * assistant messages for the chat display. When fields are rejected in
 * the review modal, TrevBot posts a follow-up acknowledging the rejection
 * and asking for the correct value.
 *
 * Key behaviors:
 * - Individual rejections are accumulated (not immediately displayed)
 * - A combined message is generated when flushRejections() is called
 *   (typically after the batch review completes or the modal closes)
 * - Messages are local-only (not persisted to Supabase)
 * - Multiple fields are combined into a single message
 */

import { useState, useCallback, useRef } from 'react';
import type { InjectedAssistantMessage } from '@/hooks/useBrandCoachChat';

// ============================================================================
// Types
// ============================================================================

interface RejectedFieldInfo {
  /** Field identifier */
  fieldId: string;
  /** Human-readable field label */
  fieldLabel: string;
}

interface UseRejectionMessagesReturn {
  /** All injected messages (rejection follow-ups) for display */
  rejectionMessages: InjectedAssistantMessage[];

  /** Record a field rejection (accumulated until flushed) */
  trackRejection: (fieldId: string, fieldLabel: string) => void;

  /** Flush accumulated rejections into a single chat message */
  flushRejections: () => void;

  /** Number of rejections pending flush */
  pendingRejectionCount: number;

  /** Clear all rejection messages (e.g., on session switch) */
  clearRejectionMessages: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build the rejection follow-up message content.
 *
 * Single field:
 *   "Got it, I won't use that for **Brand Name**. What would you like instead?"
 *
 * Multiple fields:
 *   "Got it, I won't use those for **Brand Name**, **Mission**, and **Core Values**.
 *    What would you like instead?"
 */
export function buildRejectionMessageContent(labels: string[]): string {
  if (labels.length === 0) return '';

  if (labels.length === 1) {
    return `Got it, I won't use that for **${labels[0]}**. What would you like instead?`;
  }

  const boldLabels = labels.map((l) => `**${l}**`);
  const allButLast = boldLabels.slice(0, -1).join(', ');
  const last = boldLabels[boldLabels.length - 1];
  return `Got it, I won't use those for ${allButLast} and ${last}. What would you like instead?`;
}

// ============================================================================
// Hook
// ============================================================================

export function useRejectionMessages(): UseRejectionMessagesReturn {
  /** Accumulated rejection messages that have been flushed to display */
  const [rejectionMessages, setRejectionMessages] = useState<InjectedAssistantMessage[]>([]);

  /** Rejections accumulated during the current batch (not yet flushed) */
  const pendingRejectionsRef = useRef<RejectedFieldInfo[]>([]);

  /** Counter for generating unique message IDs */
  const idCounterRef = useRef(0);

  const trackRejection = useCallback((fieldId: string, fieldLabel: string): void => {
    // Avoid duplicate tracking for the same field in a single batch
    const alreadyTracked = pendingRejectionsRef.current.some(
      (r) => r.fieldId === fieldId,
    );
    if (!alreadyTracked) {
      pendingRejectionsRef.current.push({ fieldId, fieldLabel });
    }
  }, []);

  const flushRejections = useCallback((): void => {
    const pending = pendingRejectionsRef.current;
    if (pending.length === 0) return;

    const labels = pending.map((r) => r.fieldLabel);
    const content = buildRejectionMessageContent(labels);
    idCounterRef.current += 1;

    const message: InjectedAssistantMessage = {
      id: `rejection-${Date.now()}-${idCounterRef.current}`,
      content,
      created_at: new Date().toISOString(),
    };

    setRejectionMessages((prev) => [...prev, message]);
    pendingRejectionsRef.current = [];
  }, []);

  const pendingRejectionCount = pendingRejectionsRef.current.length;

  const clearRejectionMessages = useCallback((): void => {
    setRejectionMessages([]);
    pendingRejectionsRef.current = [];
  }, []);

  return {
    rejectionMessages,
    trackRejection,
    flushRejections,
    pendingRejectionCount,
    clearRejectionMessages,
  };
}
