/**
 * useExtractionQueue Hook
 *
 * Manages the pending extraction batch. Fields enter the queue from the
 * orchestrator and exit via accept/reject. Auto-opens when fields arrive,
 * auto-closes when the queue empties.
 */

import { useState, useCallback, useRef } from 'react';
import { captureAlphaEvent } from '@/lib/posthogClient';

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

  // Fresh mirror of the queue so the (empty-deps) callbacks below can read the
  // field being acted on — to emit a rich, MF-5-safe review-signal event once,
  // outside the state updater.
  const queueRef = useRef<PendingField[]>(queue);
  queueRef.current = queue;

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
    const field = queueRef.current.find((f) => f.fieldId === fieldId);
    if (field) {
      // `_value` present = the user edited the AI's value before accepting — a
      // stronger "the AI was close but off" signal than a clean accept.
      captureAlphaEvent('field_review_accepted', {
        field_id: field.fieldId,
        chapter_id: field.chapterId,
        source: field.source,
        confidence: field.confidence,
        edited: _value !== undefined,
      });
    }
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
    const field = queueRef.current.find((f) => f.fieldId === fieldId);
    if (field) {
      captureAlphaEvent('field_review_rejected', {
        field_id: field.fieldId,
        chapter_id: field.chapterId,
        source: field.source,
        confidence: field.confidence,
      });
    }
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
    if (queueRef.current.length > 0) {
      captureAlphaEvent('field_review_accept_all', { count: queueRef.current.length });
    }
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
    // Dismissing the modal with fields still pending = abandoned review (the
    // user neither approved nor corrected the AI's extractions).
    if (queueRef.current.length > 0) {
      captureAlphaEvent('field_review_abandoned', { remaining_count: queueRef.current.length });
    }
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
