/**
 * useChapterProceeding Hook
 *
 * Encapsulates chapter advancement logic with field validation.
 * Validates that all required fields are filled before allowing
 * chapter completion and sends system messages to the AI coach.
 *
 * Extracted from BrandCoachV2.tsx to reduce component complexity.
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CHAPTER_FIELDS_MAP, BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY } from '@/config/chapterFields';
import type { Chapter as BookChapter, ChapterId } from '@/types/chapter';
import type { ChatMessageCreate } from '@/types/chat';

// ============================================================================
// Types
// ============================================================================

interface UseChapterProceedingConfig {
  /** All book chapters from useChapterProgress */
  allChapters: BookChapter[];
  /** Current field values keyed by field ID */
  fieldValues: Record<string, string | string[]>;
  /** Pending AI-extracted values (ghost text) keyed by field ID */
  pendingValues: Record<string, string | string[]>;
  /** Persist a field value */
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  /** Marks the current chapter complete and advances progress */
  completeCurrentChapter: () => Promise<void>;
  /** Sends a chat message (used for system messages to the AI coach) */
  sendMessage: (message: ChatMessageCreate) => Promise<void>;
  /** Flash a field in the accordion to draw attention */
  flashField?: (fieldId: string) => void;
}

interface UseChapterProceedingReturn {
  /** Handle the "Proceed to Next Section" action for a given chapter */
  handleProceed: (chapterId: ChapterId) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useChapterProceeding({
  allChapters,
  fieldValues,
  pendingValues,
  setFieldManual,
  completeCurrentChapter,
  sendMessage,
  flashField,
}: UseChapterProceedingConfig): UseChapterProceedingReturn {
  const { toast } = useToast();

  const handleProceed = useCallback(async (chapterId: ChapterId): Promise<void> => {
    try {
      // 1. Resolve chapter fields
      const bookChapter = allChapters.find(ch => ch.id === chapterId);
      const fieldsKey = bookChapter ? BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY[bookChapter.number] : undefined;
      const currentChapterFields = fieldsKey ? (CHAPTER_FIELDS_MAP[fieldsKey]?.fields ?? []) : [];

      // 2. Auto-accept pending ghost text for any empty fields in this chapter
      let autoAccepted = 0;
      for (const field of currentChapterFields) {
        const value = fieldValues[field.id];
        const isEmpty = !value || String(value).trim() === '';
        if (isEmpty && pendingValues[field.id]) {
          setFieldManual(field.id, pendingValues[field.id]);
          autoAccepted++;
        }
      }

      // 3. Re-check for empty fields after auto-accept
      const emptyFields = currentChapterFields.filter(field => {
        const value = fieldValues[field.id] ?? (pendingValues[field.id] || undefined);
        return !value || String(value).trim() === '';
      });

      if (emptyFields.length > 0) {
        const fieldNames = emptyFields.slice(0, 5).map(f => f.label).join(', ');
        const extra = emptyFields.length > 5 ? ` and ${emptyFields.length - 5} more` : '';
        toast({
          title: `Cannot complete — ${emptyFields.length} field${emptyFields.length > 1 ? 's' : ''} still empty`,
          description: `Missing: ${fieldNames}${extra}. Chat with Trevor to fill them in.`,
          variant: 'destructive',
        });

        // Flash the first empty field to draw attention
        if (flashField) {
          flashField(emptyFields[0].id);
        }
        return;
      }

      // 2. Mark chapter complete and advance to next
      await completeCurrentChapter();

      // 3. Get next chapter
      const currentIndex = allChapters.findIndex(ch => ch.id === chapterId);
      const nextChapter = allChapters[currentIndex + 1];

      if (!nextChapter) {
        // Last chapter completed
        await sendMessage({
          content: '[SYSTEM] User has completed all chapters. Please congratulate them and summarize their brand journey.',
          role: 'user',
          metadata: { isSystemMessage: true },
        });
        return;
      }

      // 4. Send Trevor a system message acknowledging chapter completion
      await sendMessage({
        content: `[SYSTEM] User has marked Chapter ${currentIndex + 1}: ${allChapters[currentIndex].title} as complete. Great progress on their brand journey!`,
        role: 'user',
        metadata: {
          isSystemMessage: true,
        },
      });
    } catch (error) {
      console.error('Error advancing chapter:', error);
      toast({
        title: 'Error',
        description: 'Failed to advance to next chapter',
        variant: 'destructive',
      });
    }
  }, [allChapters, fieldValues, pendingValues, setFieldManual, completeCurrentChapter, sendMessage, flashField, toast]);

  return { handleProceed };
}
