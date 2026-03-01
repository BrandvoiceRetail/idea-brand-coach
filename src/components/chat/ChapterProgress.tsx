/**
 * ChapterProgress Component
 * Displays current chapter position with visual progress indicator
 * Shows "Chapter X of 11" with chapter title, description, and progress bar
 */

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chapter } from '@/types/chapter';

interface ChapterProgressProps {
  /** Current chapter data */
  currentChapter: Chapter;
  /** Total number of chapters (always 11 for IDEA framework) */
  totalChapters?: number;
  /** Number of completed chapters */
  completedChapters?: number;
  /** Optional className for styling */
  className?: string;
  /** Show description text */
  showDescription?: boolean;
  /** Compact mode (smaller text, no description) */
  compact?: boolean;
}

export function ChapterProgress({
  currentChapter,
  totalChapters = 11,
  completedChapters = 0,
  className,
  showDescription = false,
  compact = false,
}: ChapterProgressProps): JSX.Element {
  // Calculate progress percentage based on completed chapters
  const progressPercentage = (completedChapters / totalChapters) * 100;

  // Get category color for visual distinction
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      introduction: 'text-blue-600 dark:text-blue-400',
      insight: 'text-purple-600 dark:text-purple-400',
      distinctive: 'text-pink-600 dark:text-pink-400',
      empathetic: 'text-green-600 dark:text-green-400',
      authentic: 'text-amber-600 dark:text-amber-400',
      integration: 'text-indigo-600 dark:text-indigo-400',
    };
    return colors[category] || 'text-primary';
  };

  const categoryColor = getCategoryColor(currentChapter.category);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <BookOpen className={cn('h-4 w-4 shrink-0', categoryColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">
              Chapter {currentChapter.number} of {totalChapters}
            </span>
            <span className="text-sm text-muted-foreground truncate">
              {currentChapter.title}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-1.5 mt-1" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with icon and chapter position */}
      <div className="flex items-center gap-2">
        <BookOpen className={cn('h-5 w-5 shrink-0', categoryColor)} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-semibold">
              Chapter {currentChapter.number} of {totalChapters}
            </h3>
            <span className={cn('text-xs font-medium uppercase tracking-wide', categoryColor)}>
              {currentChapter.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentChapter.title}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <Progress value={progressPercentage} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completedChapters} of {totalChapters} chapters completed
          </span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
      </div>

      {/* Optional description */}
      {showDescription && currentChapter.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {currentChapter.description}
        </p>
      )}
    </div>
  );
}
