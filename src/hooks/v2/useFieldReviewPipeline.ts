/**
 * useFieldReviewPipeline Hook
 *
 * Manages the complete field extraction review pipeline:
 * - Extraction queue (useExtractionQueue)
 * - Always-accept preference (useAlwaysAccept)
 * - Scroll-open-flash visual feedback (useScrollOpenFlash)
 * - Extraction metadata tracking (useExtractionMeta)
 * - Review modal handlers (accept, reject, accept-all, close)
 * - Badge accept handlers with flash
 * - Field click navigation with flash
 *
 * Extracted from useBrandCoachV2State to keep the composer focused
 * on orchestration and reduce its surface area.
 */

import { useRef, useCallback } from 'react';
import { useExtractionMeta } from '@/contexts/ExtractionMetaContext';
import { useExtractionQueue } from '@/hooks/v2/useExtractionQueue';
import type { PendingField as QueuePendingField } from '@/hooks/v2/useExtractionQueue';
import { useAlwaysAccept } from '@/hooks/v2/useAlwaysAccept';
import { useScrollOpenFlash } from '@/hooks/v2/useScrollOpenFlash';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';
import type { ChapterAccordionHandle } from '@/components/v2/ChapterSectionAccordion';
import type { MessageExtractionMeta } from '@/contexts/FieldReviewContext';

// ============================================================================
// Constants
// ============================================================================

/** Delay to allow the mobile sheet slide-in animation to complete before triggering scroll+flash */
const MOBILE_SHEET_ANIMATION_MS = 400;

// ============================================================================
// Types
// ============================================================================

export interface UseFieldReviewPipelineConfig {
  /** Ref to the chapter accordion for scroll-open-flash */
  accordionRef: React.RefObject<ChapterAccordionHandle>;
  /** Callback to persist a field value */
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  /** Whether device is mobile (for sheet animation delay) */
  isMobile: boolean;
  /** Callback to open mobile accordion sheet */
  setMobileAccordionOpen: (open: boolean) => void;
}

export interface UseFieldReviewPipelineReturn {
  // Queue state
  reviewQueue: QueuePendingField[];
  reviewQueueIndex: number;
  isReviewOpen: boolean;
  pendingCount: number;

  // Always-accept preference
  alwaysAccept: boolean;
  toggleAlwaysAccept: () => void;

  // Extraction metadata (from context)
  messageExtractions: Record<string, MessageExtractionMeta>;
  setMessageExtraction: (meta: MessageExtractionMeta) => void;

  // Orchestrator integration
  enqueueFieldsForReview: (fields: QueuePendingField[]) => void;

  // Review modal handlers
  handleReviewAccept: (fieldId: string, value: string | string[]) => void;
  handleReviewReject: (fieldId: string) => void;
  handleReviewAcceptAll: () => void;
  handleReviewClose: () => void;

  // Badge/field click handlers
  handleFieldAcceptFromBadge: (fieldId: string, value: string | string[]) => void;
  handleAcceptAllFromBadge: (fields: Record<string, string | string[]>) => void;
  handleFieldClick: (field: { fieldId: string }) => void;

  // Reopen review for a message's extracted fields
  handleReopenReview: (extractedFields: Record<string, string | string[]>) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useFieldReviewPipeline({
  accordionRef,
  setFieldManual,
  isMobile,
  setMobileAccordionOpen,
}: UseFieldReviewPipelineConfig): UseFieldReviewPipelineReturn {
  // ── Sub-hooks ────────────────────────────────────────────────────────
  const { messageExtractions, setMessageExtraction } = useExtractionMeta();
  const {
    queue: reviewQueue,
    currentIndex: reviewQueueIndex,
    enqueue: enqueueToQueue,
    accept: acceptFromQueue,
    reject: rejectFromQueue,
    acceptAll: acceptAllFromQueue,
    clear: clearReviewQueue,
    isOpen: isReviewOpen,
  } = useExtractionQueue();
  const { isOn: alwaysAccept, toggle: toggleAlwaysAccept } = useAlwaysAccept();
  const { triggerFlash, triggerBatchFlash } = useScrollOpenFlash({ accordionRef });

  // Stable ref for setFieldManual to avoid callback churn
  const setFieldManualRef = useRef(setFieldManual);
  setFieldManualRef.current = setFieldManual;

  const pendingCount = reviewQueue.length;

  // ── Orchestrator integration ─────────────────────────────────────────
  // Routes extracted fields to either auto-accept (flash immediately) or the review queue
  const enqueueFieldsForReview = useCallback((fields: QueuePendingField[]): void => {
    if (alwaysAccept) {
      fields.forEach(f => setFieldManualRef.current(f.fieldId, f.value));
      if (fields.length > 0) {
        triggerBatchFlash(fields.map(f => f.fieldId));
      }
    } else {
      enqueueToQueue(fields);
    }
  }, [alwaysAccept, triggerBatchFlash, enqueueToQueue]);

  // ── Review modal handlers ────────────────────────────────────────────
  const handleReviewAccept = useCallback((fieldId: string, value: string | string[]): void => {
    setFieldManualRef.current(fieldId, value);
    acceptFromQueue(fieldId);
    triggerFlash(fieldId);
  }, [acceptFromQueue, triggerFlash]);

  const handleReviewReject = useCallback((fieldId: string): void => {
    rejectFromQueue(fieldId);
  }, [rejectFromQueue]);

  const handleReviewAcceptAll = useCallback((): void => {
    const accepted = acceptAllFromQueue();
    accepted.forEach(f => setFieldManualRef.current(f.fieldId, f.value));
    if (accepted.length > 0) {
      triggerBatchFlash(accepted.map(f => f.fieldId));
    }
  }, [acceptAllFromQueue, triggerBatchFlash]);

  const handleReviewClose = useCallback((): void => {
    clearReviewQueue();
  }, [clearReviewQueue]);

  // ── Badge accept handlers (with scroll-open-flash) ───────────────────
  const handleFieldAcceptFromBadge = useCallback((fieldId: string, value: string | string[]): void => {
    setFieldManualRef.current(fieldId, value);
    triggerFlash(fieldId);
  }, [triggerFlash]);

  const handleAcceptAllFromBadge = useCallback((fields: Record<string, string | string[]>): void => {
    const entries = Object.entries(fields);
    entries.forEach(([fieldId, value]) => setFieldManualRef.current(fieldId, value));
    triggerBatchFlash(entries.map(([fieldId]) => fieldId));
  }, [triggerBatchFlash]);

  // ── Reopen review for a message's extracted fields ────────────────────
  const handleReopenReview = useCallback((extractedFields: Record<string, string | string[]>): void => {
    const fields: QueuePendingField[] = Object.entries(extractedFields).map(([fieldId, value]) => {
      let label = fieldId;
      for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
        const field = chapter.fields?.find((f: { id: string }) => f.id === fieldId);
        if (field) { label = field.label; break; }
      }
      return {
        fieldId,
        label,
        value,
        confidence: 0.95,
        source: 'user_stated' as const,
      };
    });

    if (fields.length > 0) {
      enqueueToQueue(fields);
    }
  }, [enqueueToQueue]);

  // ── Field click navigation (badge click → scroll-open-flash) ─────────
  const handleFieldClick = useCallback((field: { fieldId: string }): void => {
    if (isMobile) {
      setMobileAccordionOpen(true);
      setTimeout(() => triggerFlash(field.fieldId), MOBILE_SHEET_ANIMATION_MS);
    } else {
      triggerFlash(field.fieldId);
    }
  }, [isMobile, triggerFlash, setMobileAccordionOpen]);

  return {
    reviewQueue,
    reviewQueueIndex,
    isReviewOpen,
    pendingCount,
    alwaysAccept,
    toggleAlwaysAccept,
    messageExtractions,
    setMessageExtraction,
    enqueueFieldsForReview,
    handleReviewAccept,
    handleReviewReject,
    handleReviewAcceptAll,
    handleReviewClose,
    handleFieldAcceptFromBadge,
    handleAcceptAllFromBadge,
    handleFieldClick,
    handleReopenReview,
  };
}
