/**
 * useFieldOrchestration Hook
 *
 * Owns field extraction, field review, field sync, field extraction orchestrator,
 * chapter progress, chapter proceeding, and the precomputed chapterAccordionData memo.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useChapterProgress } from '@/hooks/useChapterProgress';
import { useFieldExtraction } from '@/hooks/useFieldExtraction';
import { useFieldReview } from '@/contexts/FieldReviewContext';
import { useSimpleFieldSync } from '@/hooks/useSimpleFieldSync';
import { useFieldExtractionOrchestrator } from '@/hooks/useFieldExtractionOrchestrator';
import { useChapterProceeding } from '@/hooks/useChapterProceeding';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { FieldSource } from '@/hooks/useFieldExtraction';
import type { MessageExtractionMeta } from '@/contexts/FieldReviewContext';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';
import type { ChapterProgress, Chapter, ChapterId } from '@/types/chapter';

// ============================================================================
// Types
// ============================================================================

interface ChapterAccordionItem {
  chapter: {
    id: string;
    number: number;
    title: string;
    category: string;
    description: string;
    fields: Array<{ id: string; label: string; type: string; helpText?: string }>;
    pillar?: string;
  };
  status: 'completed' | 'active' | 'future';
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
}

export interface UseFieldOrchestrationConfig {
  /** Avatar ID for field scoping */
  avatarId: string | null;
  /** Current session ID for chapter progress */
  sessionId: string | undefined;
  /** Chat messages from the current session (for field extraction orchestration) */
  messages: ChatMessage[];
  /** Non-streaming sendMessage for system messages (used by chapter proceeding) */
  sendMessage: (message: ChatMessageCreate) => Promise<void>;
}

export interface UseFieldOrchestrationReturn {
  /** Chapter progress */
  progress: ChapterProgress | null;
  currentChapter: Chapter | null;
  allChapters: Chapter[];
  isLoadingChapter: boolean;
  isInitializing: boolean;
  initializeProgress: () => Promise<void>;

  /** Field extraction */
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  clearFields: () => void;
  isFieldLocked: (fieldId: string) => boolean;

  /** Field review */
  pendingCount: number;
  acceptAllFields: () => void;
  messageExtractions: Record<string, MessageExtractionMeta>;
  setActiveReviewFieldId: (fieldId: string | null) => void;

  /** Field sync */
  savedFieldCount: number;

  /** Field extraction orchestrator */
  recentlyUpdatedChapterIds: string[];
  fieldToBookChapterId: Record<string, string>;

  /** Chapter proceeding */
  handleProceed: (chapterId: ChapterId) => Promise<void>;

  /** Precomputed chapter accordion data */
  chapterAccordionData: ChapterAccordionItem[];
}

// ============================================================================
// Hook
// ============================================================================

export function useFieldOrchestration({
  avatarId,
  sessionId,
  messages,
  sendMessage,
}: UseFieldOrchestrationConfig): UseFieldOrchestrationReturn {
  // ── Chapter progress ──────────────────────────────────────────────────
  const {
    progress, currentChapter, allChapters, isLoading: isLoadingChapter,
    completeCurrentChapter, initializeProgress, isInitializing,
  } = useChapterProgress({ sessionId });

  // ── Field extraction ──────────────────────────────────────────────────
  const {
    fieldValues, fieldSources, setFieldManual, setFieldLock,
    clearFields, isFieldLocked,
  } = useFieldExtraction(avatarId);

  // ── Field review context ──────────────────────────────────────────────
  const {
    enqueueFields, setMessageExtraction, registerFieldAcceptHandler,
    pendingCount, acceptAllFields, messageExtractions, setActiveReviewFieldId,
  } = useFieldReview();

  const setFieldManualRef = useRef(setFieldManual);
  setFieldManualRef.current = setFieldManual;

  useEffect(() => {
    registerFieldAcceptHandler((fieldId: string, value: string | string[]) => {
      setFieldManualRef.current(fieldId, value);
    });
  }, [registerFieldAcceptHandler]);

  // ── Field sync ────────────────────────────────────────────────────────
  const { savedFieldCount } = useSimpleFieldSync({
    avatarId: avatarId || null,
    fieldValues,
    fieldSources,
    onFieldsLoaded: (loadedFields) => {
      Object.entries(loadedFields).forEach(([fieldId, { value, isLocked }]) => {
        setFieldManual(fieldId, value);
        if (isLocked) setFieldLock(fieldId, true, true);
      });
    },
  });

  // ── Field extraction orchestrator ─────────────────────────────────────
  const { recentlyUpdatedChapterIds, fieldToBookChapterId } = useFieldExtractionOrchestrator({
    messages,
    allChapters,
    fieldValues,
    fieldSources,
    setMessageExtraction,
    enqueueFields,
  });

  // ── Chapter proceeding ────────────────────────────────────────────────
  const { handleProceed } = useChapterProceeding({
    allChapters,
    fieldValues,
    completeCurrentChapter,
    sendMessage,
  });

  // ── Precomputed chapter accordion data ────────────────────────────────
  const chapterAccordionData = useMemo(() =>
    allChapters?.map(bookChapter => {
      const key = BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[bookChapter.number];
      const chapterWithFields = key ? CHAPTER_FIELDS_MAP[key] : undefined;
      const mergedChapter = chapterWithFields
        ? { ...bookChapter, ...chapterWithFields, id: bookChapter.id, fields: chapterWithFields.fields || [] }
        : { ...bookChapter, fields: [], pillar: bookChapter.category };

      const chapterStatus: 'completed' | 'active' | 'future' =
        progress?.chapter_statuses?.[bookChapter.id] === 'completed' ? 'completed' : 'active';

      return { chapter: mergedChapter, status: chapterStatus, fieldValues, fieldSources };
    }) ?? [],
  [allChapters, progress, fieldValues, fieldSources]);

  return {
    // Chapter progress
    progress,
    currentChapter,
    allChapters,
    isLoadingChapter,
    isInitializing,
    initializeProgress,

    // Field extraction
    fieldValues,
    fieldSources,
    setFieldManual,
    clearFields,
    isFieldLocked,

    // Field review
    pendingCount,
    acceptAllFields,
    messageExtractions,
    setActiveReviewFieldId,

    // Field sync
    savedFieldCount,

    // Field extraction orchestrator
    recentlyUpdatedChapterIds,
    fieldToBookChapterId,

    // Chapter proceeding
    handleProceed,

    // Precomputed data
    chapterAccordionData,
  };
}
