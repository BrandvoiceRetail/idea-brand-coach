/**
 * useChapterProgress Hook
 * React hook for managing chapter progress through the IDEA framework book
 *
 * @param sessionId - The chat session ID to track progress for
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import {
  ChapterId,
  ChapterProgress,
  ChapterStatus,
  Chapter,
  DEFAULT_BOOK_STRUCTURE,
  UseChapterProgressReturn,
} from '@/types/chapter';
import { useToast } from '@/hooks/use-toast';

interface UseChapterProgressOptions {
  sessionId?: string;
}

export const useChapterProgress = (options: UseChapterProgressOptions = {}): UseChapterProgressReturn => {
  const { sessionId } = options;
  const { chatService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // All available chapters from the book structure
  const allChapters = useMemo(() => DEFAULT_BOOK_STRUCTURE.chapters, []);

  // Query: Get current session to access chapter metadata
  const {
    data: session,
    isLoading: isLoadingSession,
    error: sessionError,
  } = useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      return chatService.getSession(sessionId);
    },
    enabled: !!sessionId,
    retry: 1,
  });

  // Initialize chapter progress from session metadata or create default
  const progress = useMemo((): ChapterProgress | null => {
    if (!session || !sessionId) return null;

    // If session has existing chapter progress in metadata, use it
    if (session.chapter_metadata) {
      // Build progress from session metadata
      // Try to get chapter_id from metadata first (for backward compatibility)
      const currentChapterId = session.chapter_metadata?.chapter_id || session.chapter_id || 'chapter-01-introduction';
      const currentChapterNumber = allChapters.find(ch => ch.id === currentChapterId)?.number || 1;

      // Restore chapter statuses from saved metadata, defaulting to not_started
      const savedStatuses = session.chapter_metadata?.chapter_statuses;
      const chapterStatuses: Record<ChapterId, ChapterStatus> = {} as Record<ChapterId, ChapterStatus>;
      allChapters.forEach(ch => {
        chapterStatuses[ch.id] = savedStatuses?.[ch.id] || 'not_started';
      });

      // Count completed chapters
      const completedCount = Object.values(chapterStatuses).filter(s => s === 'completed').length;

      return {
        session_id: sessionId,
        user_id: session.user_id,
        current_chapter_id: currentChapterId,
        current_chapter_number: currentChapterNumber,
        chapter_statuses: chapterStatuses,
        completed_chapters: completedCount,
        total_chapters: 11,
        started_at: session.created_at,
        updated_at: session.updated_at,
        completed_at: null,
      };
    }

    // Create default progress starting at chapter 1
    const chapterStatuses: Record<ChapterId, ChapterStatus> = {} as Record<ChapterId, ChapterStatus>;
    allChapters.forEach(ch => {
      chapterStatuses[ch.id] = 'not_started';
    });

    return {
      session_id: sessionId,
      user_id: session.user_id,
      current_chapter_id: 'chapter-01-introduction',
      current_chapter_number: 1,
      chapter_statuses: chapterStatuses,
      completed_chapters: 0,
      total_chapters: 11,
      started_at: session.created_at,
      updated_at: session.updated_at,
      completed_at: null,
    };
  }, [session, sessionId, allChapters]);

  // Get current chapter object
  const currentChapter = useMemo((): Chapter | null => {
    if (!progress) return null;
    return allChapters.find(ch => ch.id === progress.current_chapter_id) || null;
  }, [progress, allChapters]);

  // Mutation: Update session with new chapter progress
  const updateProgressMutation = useMutation({
    mutationKey: ['chat', 'updateChapterProgress', sessionId],
    mutationFn: async ({ chapterId, statuses }: { chapterId: ChapterId; statuses?: Record<ChapterId, ChapterStatus> }) => {
      if (!sessionId) throw new Error('No session ID provided');

      const chapter = allChapters.find(ch => ch.id === chapterId);
      if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

      // Update session with new chapter
      return chatService.updateSession(sessionId, {
        chapter_id: chapterId,
        chapter_metadata: {
          chapter_id: chapterId,
          chapter_number: chapter.number,
          chapter_title: chapter.title,
          chapter_category: chapter.category,
          chapter_statuses: statuses,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'session', sessionId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Updating Progress',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Navigate to a specific chapter
  const navigateToChapter = useCallback(async (chapterId: ChapterId): Promise<void> => {
    if (!progress) return;

    await updateProgressMutation.mutateAsync({
      chapterId,
      statuses: progress.chapter_statuses,
    });

    toast({
      title: 'Chapter Changed',
      description: `Now on: ${allChapters.find(ch => ch.id === chapterId)?.title}`,
    });
  }, [progress, updateProgressMutation, toast, allChapters]);

  // Mark current chapter as completed and move to next
  const completeCurrentChapter = useCallback(async (): Promise<void> => {
    if (!progress || !currentChapter) return;

    // Mark current chapter as completed
    const updatedStatuses = {
      ...progress.chapter_statuses,
      [currentChapter.id]: 'completed' as ChapterStatus,
    };

    // Get next chapter
    const currentIndex = allChapters.findIndex(ch => ch.id === currentChapter.id);
    const nextChapter = allChapters[currentIndex + 1];

    if (nextChapter) {
      // Move to next chapter
      await updateProgressMutation.mutateAsync({
        chapterId: nextChapter.id,
        statuses: updatedStatuses,
      });

      toast({
        title: 'Chapter Completed!',
        description: `Moving to: ${nextChapter.title}`,
      });
    } else {
      // Last chapter - just mark complete
      await updateProgressMutation.mutateAsync({
        chapterId: currentChapter.id,
        statuses: updatedStatuses,
      });

      toast({
        title: 'All Chapters Completed!',
        description: 'Congratulations on completing the IDEA Framework book!',
      });
    }
  }, [progress, currentChapter, allChapters, updateProgressMutation, toast]);

  // Mark a specific chapter as completed
  const markChapterComplete = useCallback(async (chapterId: ChapterId): Promise<void> => {
    if (!progress) return;

    const updatedStatuses = {
      ...progress.chapter_statuses,
      [chapterId]: 'completed' as ChapterStatus,
    };

    await updateProgressMutation.mutateAsync({
      chapterId: progress.current_chapter_id,
      statuses: updatedStatuses,
    });

    toast({
      title: 'Chapter Marked Complete',
      description: `${allChapters.find(ch => ch.id === chapterId)?.title} is now completed.`,
    });
  }, [progress, updateProgressMutation, toast, allChapters]);

  // Reset progress to start
  const resetProgress = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    const firstChapter = allChapters[0];
    const resetStatuses: Record<ChapterId, ChapterStatus> = {} as Record<ChapterId, ChapterStatus>;
    allChapters.forEach(ch => {
      resetStatuses[ch.id] = 'not_started';
    });

    await updateProgressMutation.mutateAsync({
      chapterId: firstChapter.id,
      statuses: resetStatuses,
    });

    toast({
      title: 'Progress Reset',
      description: 'Starting over from the beginning.',
    });
  }, [sessionId, allChapters, updateProgressMutation, toast]);

  // Get chapter by ID
  const getChapterById = useCallback((chapterId: ChapterId): Chapter | undefined => {
    return allChapters.find(ch => ch.id === chapterId);
  }, [allChapters]);

  // Get next chapter
  const getNextChapter = useCallback((): Chapter | null => {
    if (!currentChapter) return null;
    const currentIndex = allChapters.findIndex(ch => ch.id === currentChapter.id);
    return allChapters[currentIndex + 1] || null;
  }, [currentChapter, allChapters]);

  // Get previous chapter
  const getPreviousChapter = useCallback((): Chapter | null => {
    if (!currentChapter) return null;
    const currentIndex = allChapters.findIndex(ch => ch.id === currentChapter.id);
    return currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  }, [currentChapter, allChapters]);

  // Check if a chapter is completed
  const isChapterCompleted = useCallback((chapterId: ChapterId): boolean => {
    if (!progress) return false;
    return progress.chapter_statuses[chapterId] === 'completed';
  }, [progress]);

  return {
    // Data
    progress,
    currentChapter,
    allChapters,

    // Loading states
    isLoading: isLoadingSession,

    // Error
    error: sessionError as Error | null,

    // Mutations
    navigateToChapter,
    completeCurrentChapter,
    markChapterComplete,
    resetProgress,

    // Utilities
    getChapterById,
    getNextChapter,
    getPreviousChapter,
    isChapterCompleted,
  };
};
