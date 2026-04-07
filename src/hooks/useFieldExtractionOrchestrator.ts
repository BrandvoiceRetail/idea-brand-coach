/**
 * useFieldExtractionOrchestrator Hook
 *
 * Orchestrates field extraction from assistant messages and tracks
 * which chapters need to auto-expand when AI updates their fields.
 *
 * AI-extracted fields are NOT auto-saved. Instead they are enqueued for
 * user review via useExtractionQueue. Fields are only persisted when the
 * user accepts them (handled by the parent/composer). Manual field edits
 * bypass this hook entirely — they are saved directly in the form layer.
 *
 * Extracted from BrandCoachV2.tsx to reduce component complexity.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { Chapter as BookChapter } from '@/types/chapter';
import type { ChatMessage } from '@/types/chat';
import type { FieldSource } from '@/hooks/useFieldExtraction';
import type { PendingField } from '@/hooks/v2/useExtractionQueue';
import type { MessageExtractionMeta } from '@/contexts/FieldReviewContext';

// ============================================================================
// Types
// ============================================================================

/** Shape of a single extracted field in message metadata (from the edge function). */
interface MetaExtractedField {
  identifier: string;
  value: unknown;
  confidence: number;
  source: 'user_stated' | 'user_confirmed' | 'inferred_strong' | 'document';
  context?: string;
}

interface UseFieldExtractionOrchestratorConfig {
  /** Chat messages from the current session */
  messages: ChatMessage[];
  /** All book chapters from useChapterProgress */
  allChapters: BookChapter[];
  /** Current field values keyed by field ID */
  fieldValues: Record<string, string | string[]>;
  /** Source of each field (ai or manual) */
  fieldSources: Record<string, FieldSource>;
  /** Callback to set extraction metadata on a message */
  setMessageExtraction: (meta: MessageExtractionMeta) => void;
  /** Callback to enqueue fields for review (AI extractions only) */
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

  // Build a reverse lookup: fieldId -> { label, chapterKey, chapterTitle }
  // Used to enrich PendingField objects with human-readable labels and chapter info.
  const fieldMetaLookup = useMemo<Record<string, { label: string; chapterKey: string; chapterTitle: string }>>(() => {
    const map: Record<string, { label: string; chapterKey: string; chapterTitle: string }> = {};
    for (const [chapterKey, chapter] of Object.entries(CHAPTER_FIELDS_MAP)) {
      for (const field of chapter.fields) {
        map[field.id] = {
          label: field.label,
          chapterKey,
          chapterTitle: chapter.title,
        };
      }
    }
    return map;
  }, []);

  // Side-effect: extract fields from NEW assistant messages and enqueue for review.
  // Fields arrive via msg.metadata.extractedFields (from Claude tool calls).
  // AI-extracted fields are NOT auto-saved — they enter the review queue instead.
  useEffect(() => {
    messages.forEach((msg) => {
      const metaFields = (msg.metadata as Record<string, unknown>)?.extractedFields as
        | MetaExtractedField[]
        | undefined;

      if (
        msg.role !== 'assistant' ||
        processedMessageIds.current.has(msg.id) ||
        !metaFields?.length
      ) return;

      processedMessageIds.current.add(msg.id);

      // Build a flat map for MessageExtractionMeta (fieldId -> display value)
      const extractedFieldsMap: Record<string, string | string[]> = {};
      for (const field of metaFields) {
        extractedFieldsMap[field.identifier] = Array.isArray(field.value)
          ? (field.value as string[])
          : String(field.value);
      }

      if (Object.keys(extractedFieldsMap).length === 0) return;

      // Track extraction metadata on the message (for badge rendering)
      const meta: MessageExtractionMeta = {
        messageId: msg.id,
        extractedFields: extractedFieldsMap,
        fieldCount: Object.keys(extractedFieldsMap).length,
        allAccepted: false,
      };
      setMessageExtraction(meta);

      // Build PendingField objects with full metadata for the review queue
      const pending: PendingField[] = metaFields.map((rawField) => {
        const fieldId = rawField.identifier;
        const fieldMeta = fieldMetaLookup[fieldId];
        const bookChapterId = fieldToBookChapterId[fieldId] || '';

        const value: string | string[] = Array.isArray(rawField.value)
          ? (rawField.value as string[])
          : String(rawField.value);

        return {
          fieldId,
          label: fieldMeta?.label || fieldId,
          value,
          confidence: rawField.confidence,
          source: rawField.source,
          context: rawField.context,
          chapterId: bookChapterId,
          chapterTitle: fieldMeta?.chapterTitle || '',
          messageId: msg.id,
        };
      });

      enqueueFields(pending);
    });
  }, [messages, setMessageExtraction, enqueueFields, fieldMetaLookup, fieldToBookChapterId]);

  return {
    recentlyUpdatedChapterIds,
    fieldToBookChapterId,
  };
}
