/**
 * ChapterNavigation Component
 * Displays the 11-chapter IDEA framework progression with navigation controls
 * Allows users to skip/revisit any chapter in the book-guided workflow
 */

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Chapter, ChapterId, ChapterStatus } from '@/types/chapter';
import { DEFAULT_BOOK_STRUCTURE } from '@/types/chapter';
import { cn } from '@/lib/utils';

interface ChapterNavigationProps {
  /** Currently active chapter ID */
  currentChapterId: ChapterId | undefined;

  /** Chapter completion statuses */
  chapterStatuses?: Record<ChapterId, ChapterStatus>;

  /** Handler for chapter selection */
  onSelectChapter: (chapterId: ChapterId) => void;

  /** Loading state */
  isLoading?: boolean;
}

/**
 * Get color class for chapter category
 */
function getCategoryColor(category: string): string {
  switch (category) {
    case 'introduction':
      return 'text-blue-600 dark:text-blue-400';
    case 'insight':
      return 'text-purple-600 dark:text-purple-400';
    case 'distinctive':
      return 'text-orange-600 dark:text-orange-400';
    case 'empathetic':
      return 'text-green-600 dark:text-green-400';
    case 'authentic':
      return 'text-pink-600 dark:text-pink-400';
    case 'integration':
      return 'text-indigo-600 dark:text-indigo-400';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get status icon for chapter
 */
function getStatusIcon(status: ChapterStatus | undefined): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'in_progress':
      return <Circle className="h-4 w-4 text-blue-600 dark:text-blue-400 fill-current" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Format estimated time for display
 */
function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Group chapters by category
 */
function groupChaptersByCategory(chapters: Chapter[]): Record<string, Chapter[]> {
  return chapters.reduce((acc, chapter) => {
    const category = chapter.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(chapter);
    return acc;
  }, {} as Record<string, Chapter[]>);
}

/**
 * Get category display name
 */
function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'introduction':
      return 'Introduction';
    case 'insight':
      return 'Insight';
    case 'distinctive':
      return 'Distinctive';
    case 'empathetic':
      return 'Empathetic';
    case 'authentic':
      return 'Authentic';
    case 'integration':
      return 'Integration';
    default:
      return category;
  }
}

export function ChapterNavigation({
  currentChapterId,
  chapterStatuses = {},
  onSelectChapter,
  isLoading = false,
}: ChapterNavigationProps): JSX.Element {
  const chapters = DEFAULT_BOOK_STRUCTURE.chapters;
  const groupedChapters = groupChaptersByCategory(chapters);

  // Category order for display
  const categoryOrder = ['introduction', 'insight', 'distinctive', 'empathetic', 'authentic', 'integration'];

  const handleChapterClick = (chapterId: ChapterId): void => {
    onSelectChapter(chapterId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, chapterId: ChapterId): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectChapter(chapterId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Book Chapters</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {DEFAULT_BOOK_STRUCTURE.title}
        </p>
      </div>

      {/* Chapters list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading chapters...</div>
            </div>
          ) : (
            categoryOrder.map((category) => {
              const categoryChapters = groupedChapters[category];
              if (!categoryChapters || categoryChapters.length === 0) return null;

              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="mb-3">
                    <h3 className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      getCategoryColor(category)
                    )}>
                      {getCategoryDisplayName(category)}
                    </h3>
                    <Separator className="mt-2" />
                  </div>

                  {/* Chapters in this category */}
                  <div className="space-y-2">
                    {categoryChapters.map((chapter) => {
                      const isActive = currentChapterId === chapter.id;
                      const status = chapterStatuses[chapter.id];

                      return (
                        <div
                          key={chapter.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleChapterClick(chapter.id)}
                          onKeyDown={(e) => handleKeyDown(e, chapter.id)}
                          className={cn(
                            'group relative p-3 rounded-lg transition-all cursor-pointer',
                            'hover:bg-accent/50 hover:shadow-sm',
                            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            isActive && 'bg-accent shadow-sm border border-accent-foreground/10'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Status icon */}
                            <div className="mt-0.5 shrink-0">
                              {getStatusIcon(status)}
                            </div>

                            {/* Chapter content */}
                            <div className="flex-1 min-w-0">
                              {/* Chapter number and title */}
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                      'text-xs font-medium',
                                      getCategoryColor(category)
                                    )}>
                                      Chapter {chapter.number}
                                    </span>
                                    {isActive && (
                                      <span className="text-xs text-muted-foreground">
                                        (Current)
                                      </span>
                                    )}
                                  </div>
                                  <h4 className={cn(
                                    'text-sm font-semibold leading-tight',
                                    isActive ? 'text-foreground' : 'text-foreground/90'
                                  )}>
                                    {chapter.title}
                                  </h4>
                                </div>

                                {/* Chevron indicator */}
                                <ChevronRight className={cn(
                                  'h-4 w-4 shrink-0 transition-opacity',
                                  'opacity-0 group-hover:opacity-100',
                                  isActive && 'opacity-100'
                                )} />
                              </div>

                              {/* Chapter description */}
                              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                                {chapter.description}
                              </p>

                              {/* Chapter metadata */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatTime(chapter.estimated_time)}</span>
                                </div>
                                <span>•</span>
                                <span>{chapter.key_questions.length} key questions</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer with progress summary */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Progress</span>
          <span className="font-medium">
            {Object.values(chapterStatuses).filter(s => s === 'completed').length} of {chapters.length} completed
          </span>
        </div>
      </div>
    </div>
  );
}
