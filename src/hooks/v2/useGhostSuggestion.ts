/**
 * useGhostSuggestion Hook
 *
 * Client-side computation of the next ghost-text suggestion based on
 * which fields are empty in the current chapter. No API call required —
 * uses a static prompt map for instant results.
 *
 * Priority:
 * 1. First empty field in current chapter
 * 2. If current chapter is complete, suggest moving to the next incomplete chapter
 * 3. null when all 35 fields are filled
 */

import { useMemo } from 'react';
import { FIELD_SUGGESTION_PROMPTS } from '@/data/fieldSuggestionPrompts';
import { CHAPTER_FIELDS_MAP } from '@/config/chapterFields';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal chapter shape needed by this hook.
 * Compatible with both the CHAPTER_FIELDS_MAP config chapters and
 * the Chapter type from src/types/chapter.ts.
 */
interface ChapterLike {
  id: string;
  title: string;
  fields: Array<{ id: string }>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build an ordered array of ChapterLike objects from CHAPTER_FIELDS_MAP config.
 * Memoised at module level since the config is static.
 */
function buildChapterList(): ChapterLike[] {
  return Object.values(CHAPTER_FIELDS_MAP)
    .sort((a, b) => a.order - b.order)
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      fields: chapter.fields.map((f) => ({ id: f.id })),
    }));
}

const ALL_CHAPTERS: ChapterLike[] = buildChapterList();

/**
 * Check whether a field has a meaningful value.
 */
function fieldIsFilled(
  fieldId: string,
  fieldValues: Record<string, string | string[]>,
): boolean {
  const value = fieldValues[fieldId];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== '';
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Returns a conversational prompt targeting the next empty field, or suggests
 * the next chapter, or null when all 35 fields are filled.
 *
 * @param currentChapterId - The `id` of the chapter the user is currently viewing
 *                           (e.g. "brand-foundation"). Pass null when unknown.
 * @param fieldValues      - Current field values keyed by fieldId.
 */
export function useGhostSuggestion(
  currentChapterId: string | null,
  fieldValues: Record<string, string | string[]>,
): string | null {
  return useMemo(() => {
    // 1. Try the current chapter first
    if (currentChapterId) {
      const chapter = ALL_CHAPTERS.find((ch) => ch.id === currentChapterId);
      if (chapter) {
        for (const field of chapter.fields) {
          if (!fieldIsFilled(field.id, fieldValues)) {
            return FIELD_SUGGESTION_PROMPTS[field.id] ?? null;
          }
        }
      }
    }

    // 2. Current chapter is complete (or unknown) — find next incomplete chapter
    for (const chapter of ALL_CHAPTERS) {
      // Skip the current chapter since we already checked it
      if (chapter.id === currentChapterId) continue;

      for (const field of chapter.fields) {
        if (!fieldIsFilled(field.id, fieldValues)) {
          return FIELD_SUGGESTION_PROMPTS[field.id] ?? null;
        }
      }
    }

    // 3. All 35 fields are filled
    return null;
  }, [currentChapterId, fieldValues]);
}
