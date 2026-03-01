/**
 * BookContextDisplay Component
 * Displays excerpts from the IDEA framework book with section references.
 * Provides a scrollable view of relevant book content organized by IDEA phases.
 */

import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';

/**
 * IDEA framework phases
 */
type IdeaPhase = 'Identify' | 'Discover' | 'Execute' | 'Analyze';

/**
 * Book excerpt data structure
 */
export interface BookExcerpt {
  /** IDEA framework phase/section this excerpt belongs to */
  section: IdeaPhase;
  /** The excerpt text from the book */
  text: string;
  /** Optional page reference (e.g., "p. 42" or just "42") */
  pageReference?: string | number;
  /** Optional chapter or subsection title */
  chapter?: string;
}

interface BookContextDisplayProps {
  /** Array of book excerpts to display */
  excerpts: BookExcerpt[];
  /** Optional title for the entire context display */
  title?: string;
  /** Optional description/subtitle */
  description?: string;
  /** Maximum height for the scrollable area (CSS value) */
  maxHeight?: string;
  /** Optional className for the container */
  className?: string;
  /** Whether to show section badges */
  showSectionBadges?: boolean;
  /** Whether to show page references */
  showPageReferences?: boolean;
}

/**
 * Color scheme for IDEA phases
 */
const PHASE_COLORS: Record<IdeaPhase, string> = {
  Identify: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Discover: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Execute: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  Analyze: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

/**
 * BookContextDisplay shows relevant IDEA framework book excerpts in a clean,
 * organized format. Useful for displaying contextual information alongside
 * coaching sessions or diagnostic results.
 *
 * @example
 * ```tsx
 * const excerpts = [
 *   {
 *     section: 'Identify',
 *     text: 'The first step is to identify your brand's core values...',
 *     pageReference: '23',
 *     chapter: 'Chapter 2: Brand Foundation',
 *   },
 *   {
 *     section: 'Discover',
 *     text: 'Discovery involves understanding your market position...',
 *     pageReference: 45,
 *   },
 * ];
 *
 * <BookContextDisplay
 *   title="Relevant Book Excerpts"
 *   description="Context from the IDEA framework"
 *   excerpts={excerpts}
 * />
 * ```
 */
export function BookContextDisplay({
  excerpts,
  title = 'IDEA Framework Context',
  description,
  maxHeight = '600px',
  className,
  showSectionBadges = true,
  showPageReferences = true,
}: BookContextDisplayProps): JSX.Element {
  if (excerpts.length === 0) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-sm text-muted-foreground">
            No book excerpts available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="px-6" style={{ maxHeight }}>
          <div className="space-y-4 pb-6">
            {excerpts.map((excerpt, index) => (
              <div key={index}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="space-y-2">
                  {/* Section badge and page reference */}
                  <div className="flex items-center justify-between gap-2">
                    {showSectionBadges && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'font-medium',
                          PHASE_COLORS[excerpt.section]
                        )}
                      >
                        {excerpt.section}
                      </Badge>
                    )}
                    {showPageReferences && excerpt.pageReference && (
                      <span className="text-xs text-muted-foreground">
                        {typeof excerpt.pageReference === 'number'
                          ? `p. ${excerpt.pageReference}`
                          : excerpt.pageReference}
                      </span>
                    )}
                  </div>

                  {/* Chapter title if provided */}
                  {excerpt.chapter && (
                    <div className="text-sm font-medium text-foreground/80">
                      {excerpt.chapter}
                    </div>
                  )}

                  {/* Excerpt text */}
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    {excerpt.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
