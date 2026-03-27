/**
 * useExtractionQueue Hook
 *
 * Manages the pending extraction batch. Fields enter the queue from the
 * orchestrator and exit via accept/reject. Auto-opens when fields arrive,
 * auto-closes when the queue empties.
 */

import { useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * A field pending user review before being committed to the brand profile.
 * Exported for use by BatchReviewOrchestrator, useRejectionToChat, and
 * the orchestrator rewire (Story 1.8).
 */
export interface PendingField {
  /** Field identifier matching ALL_FIELDS_MAP field IDs */
  fieldId: string;
  /** Human-readable label */
  label: string;
  /** Extracted value (string for text/textarea, string[] for array fields) */
  value: string | string[];
  /** AI confidence score (0-1) */
  confidence: number;
  /** How the value was derived */
  source: 'user_stated' | 'user_confirmed' | 'inferred_strong' | 'document';
  /** Brief explanation of why this was extracted */
  context?: string;
  /** Chapter key this field belongs to (e.g. 'BRAND_FOUNDATION') */
  chapterId: string;
  /** Human-readable chapter title */
  chapterTitle: string;
  /** ID of the chat message that triggered extraction */
  messageId: string;
}

/**
 * Return type for the extraction queue hook.
 */
export interface UseExtractionQueueReturn {
  /** Current pending fields awaiting review */
  queue: PendingField[];
  /** Index of the field currently being reviewed */
  currentIndex: number;
  /** Append new fields to the queue */
  enqueue: (fields: PendingField[]) => void;
  /** Accept a field (optionally with an edited value) and remove it from the queue */
  accept: (fieldId: string, value?: string | string[]) => void;
  /** Reject a field and remove it from the queue */
  reject: (fieldId: string) => void;
  /** Accept all remaining fields; returns the accepted fields for downstream processing */
  acceptAll: () => PendingField[];
  /** Clear the entire queue without accepting or rejecting */
  clear: () => void;
  /** Whether the review UI should be visible */
  isOpen: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useExtractionQueue(): UseExtractionQueueReturn {
  const [queue, setQueue] = useState<PendingField[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  /**
   * Append fields to the queue. If the queue was empty, opens the review UI.
   * New extractions arriving during an active review are appended — the
   * progress indicator updates automatically.
   */
  const enqueue = useCallback((fields: PendingField[]): void => {
    if (fields.length === 0) return;

    setQueue((prev) => {
      // Deduplicate: skip fields already in the queue by fieldId
      const existingIds = new Set(prev.map((f) => f.fieldId));
      const newFields = fields.filter((f) => !existingIds.has(f.fieldId));
      if (newFields.length === 0) return prev;

      const wasEmpty = prev.length === 0;
      if (wasEmpty) {
        setCurrentIndex(0);
        setIsOpen(true);
      }

      return [...prev, ...newFields];
    });
  }, []);

  /**
   * Accept a single field. Removes it from the queue and advances the index.
   * Optionally accepts an edited value (for inline edits in the review modal).
   */
  const accept = useCallback((fieldId: string, _value?: string | string[]): void => {
    setQueue((prev) => {
      const next = prev.filter((f) => f.fieldId !== fieldId);
      if (next.length === 0) {
        setIsOpen(false);
        setCurrentIndex(0);
      } else {
        setCurrentIndex((idx) => Math.min(idx, next.length - 1));
      }
      return next;
    });
  }, []);

  /**
   * Reject a single field. Removes it from the queue and advances the index.
   */
  const reject = useCallback((fieldId: string): void => {
    setQueue((prev) => {
      const next = prev.filter((f) => f.fieldId !== fieldId);
      if (next.length === 0) {
        setIsOpen(false);
        setCurrentIndex(0);
      } else {
        setCurrentIndex((idx) => Math.min(idx, next.length - 1));
      }
      return next;
    });
  }, []);

  /**
   * Accept all remaining fields in the queue. Returns the full list of
   * accepted PendingField objects so the caller can commit them and
   * trigger batch flash animations.
   */
  const acceptAll = useCallback((): PendingField[] => {
    let accepted: PendingField[] = [];
    setQueue((prev) => {
      accepted = [...prev];
      return [];
    });
    setIsOpen(false);
    setCurrentIndex(0);
    return accepted;
  }, []);

  /**
   * Clear the queue without accepting or rejecting any fields.
   * Used when the user dismisses the review modal.
   */
  const clear = useCallback((): void => {
    setQueue([]);
    setIsOpen(false);
    setCurrentIndex(0);
  }, []);

  return {
    queue,
    currentIndex,
    enqueue,
    accept,
    reject,
    acceptAll,
    clear,
    isOpen,
  };
}
