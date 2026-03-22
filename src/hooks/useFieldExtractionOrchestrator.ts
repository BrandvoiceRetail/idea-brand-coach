/**
 * useFieldExtractionOrchestrator Hook
 *
 * Orchestrates field extraction from assistant messages and tracks
 * which chapters need to auto-expand when AI updates their fields.
 *
 * Extracted from BrandCoachV2.tsx to reduce component complexity.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { Chapter as BookChapter } from '@/types/chapter';
import type { ChatMessage } from '@/types/chat';
import type { FieldSource } from '@/hooks/useFieldExtraction';
import type { PendingField, MessageExtractionMeta } from '@/contexts/FieldReviewContext';

// ============================================================================
// Types
// ============================================================================

interface UseFieldExtractionOrchestratorConfig {
  /** Chat messages from the current session */
  messages: ChatMessage[];
  /** All book chapters from useChapterProgress */
  allChapters: BookChapter[];
  /** Current field values keyed by field ID */
  fieldValues: Record<string, string | string[]>;
  /** Source of each field (ai or manual) */
  fieldSources: Record<string, FieldSource>;
  /** Callback to persist a field value */
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  /** Callback to set extraction metadata on a message */
  setMessageExtraction: (meta: MessageExtractionMeta) => void;
  /** Callback to enqueue fields for review */
  enqueueFields: (fields: PendingField[]) => void;
}

interface UseFieldExtractionOrchestratorReturn {
  /** Chapter IDs that were recently updated by AI field extraction */
  recentlyUpdatedChapterIds: string[];
  /** Reverse lookup: fieldId -> book chapter ID */
  fieldToBookChapterId: Record<string, string>;
}

// ============================================================================
// Hook
// ============================================================================

export function useFieldExtractionOrchestrator({
  messages,
  allChapters,
  fieldValues,
  fieldSources,
  setFieldManual,
  setMessageExtraction,
  enqueueFields,
}: UseFieldExtractionOrchestratorConfig): UseFieldExtractionOrchestratorReturn {
  // Track which chapter IDs should auto-expand because the AI just updated a field inside them.
  const [recentlyUpdatedChapterIds, setRecentlyUpdatedChapterIds] = useState<string[]>([]);
  const prevFieldValuesRef = useRef<Record<string, string | string[]>>({});
  const isFirstFieldLoadRef = useRef(true);

  // Track which message IDs have already had side effects (extractFields, enqueueFields, etc.)
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Reverse lookup: fieldId -> book chapter ID (e.g. 'brandPurpose' -> 'chapter-01-introduction')
  const fieldToBookChapterId = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    allChapters.forEach(bookChapter => {
      const key = BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[bookChapter.number];
      if (key && CHAPTER_FIELDS_MAP[key]) {
        CHAPTER_FIELDS_MAP[key].fields.forEach(field => {
          map[field.id] = bookChapter.id;
        });
      }
    });
    return map;
  }, [allChapters]);

  // Detect AI field changes and expand the relevant chapters
  useEffect(() => {
    if (isFirstFieldLoadRef.current) {
      isFirstFieldLoadRef.current = false;
      prevFieldValuesRef.current = { ...fieldValues };
      return;
    }
    const prev = prevFieldValuesRef.current;
    const updatedChapterIds = new Set<string>();
    Object.entries(fieldValues).forEach(([fieldId, value]) => {
      if (
        fieldSources[fieldId] === 'ai' &&
        JSON.stringify(value) !== JSON.stringify(prev[fieldId])
      ) {
        const chapterId = fieldToBookChapterId[fieldId];
        if (chapterId) updatedChapterIds.add(chapterId);
      }
    });
    if (updatedChapterIds.size > 0) {
      setRecentlyUpdatedChapterIds(Array.from(updatedChapterIds));
    }
    prevFieldValuesRef.current = { ...fieldValues };
  }, [fieldValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // Side-effect: extract fields from NEW assistant messages only
  // Fields arrive via msg.metadata.extractedFields (from OpenAI tool calls)
  useEffect(() => {
    messages.forEach((msg) => {
      const metaFields = (msg.metadata as Record<string, unknown>)?.extractedFields as
        | Array<{ identifier: string; value: unknown }>
        | undefined;

      if (
        msg.role !== 'assistant' ||
        processedMessageIds.current.has(msg.id) ||
        !metaFields?.length
      ) return;

      processedMessageIds.current.add(msg.id);

      // Build field values from structured metadata (no delimiter parsing needed)
      const extractedFields: Record<string, string> = {};
      for (const field of metaFields) {
        extractedFields[field.identifier] = Array.isArray(field.value)
          ? field.value.join('\n')
          : String(field.value);
      }

      // Apply extracted fields to state
      for (const [fieldId, value] of Object.entries(extractedFields)) {
        setFieldManual(fieldId, value);
      }

      if (Object.keys(extractedFields).length > 0) {
        const meta: MessageExtractionMeta = {
          messageId: msg.id,
          extractedFields,
          fieldCount: Object.keys(extractedFields).length,
          allAccepted: false,
        };
        setMessageExtraction(meta);

        // Build pending fields for the review queue
        const pending: PendingField[] = Object.entries(extractedFields).map(([fieldId, value]) => {
          let fieldLabel = fieldId;
          for (const chapter of Object.values(CHAPTER_FIELDS_MAP)) {
            const field = chapter.fields?.find((f: { id: string }) => f.id === fieldId);
            if (field) {
              fieldLabel = field.label;
              break;
            }
          }

          return {
            fieldId,
            fieldLabel,
            value,
            messageId: msg.id,
            extractedAt: msg.created_at,
          };
        });

        enqueueFields(pending);
      }
    });
  }, [messages, setFieldManual, setMessageExtraction, enqueueFields]);

  return {
    recentlyUpdatedChapterIds,
    fieldToBookChapterId,
  };
}
