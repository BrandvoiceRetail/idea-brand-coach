import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChapterFieldSet } from "./ChapterFieldSet";
import { FieldFlashHighlight } from "./FieldFlashHighlight";
import type { FieldFlashHandle } from "./FieldFlashHighlight";
import type { Chapter, ChapterStatus, FieldSource } from "@/config/chapterFields";

/**
 * Display labels for IDEA framework pillars, used as grouping headers
 */
const PILLAR_LABELS: Record<Chapter['pillar'], string> = {
  foundation: 'FOUNDATION',
  insight: 'INSIGHT',
  distinctive: 'DISTINCTIVE',
  empathy: 'EMPATHY',
  authentic: 'AUTHENTIC',
};

/**
 * Imperative handle for programmatic accordion control
 */
export interface ChapterAccordionHandle {
  /** Expand a specific chapter (closing others) and scroll it into view */
  focusChapter: (chapterId: string) => void;
  /** Open the chapter containing this field and scroll the field into view */
  focusField: (fieldId: string) => void;
  /** Trigger the green flash animation on a specific field */
  flashField: (fieldId: string) => void;
}

/**
 * Chapter data with runtime values and status
 */
export interface ChapterData {
  /** The chapter configuration */
  chapter: Chapter;

  /** Current completion status */
  status: ChapterStatus;

  /** Field values for this chapter */
  fieldValues: Record<string, string | string[] | undefined>;

  /** Field source indicators */
  fieldSources?: Record<string, FieldSource>;
}

/**
 * Props for ChapterSectionAccordion component
 */
export interface ChapterSectionAccordionProps {
  /** Array of chapters with their data and status */
  chapters: ChapterData[];

  /** Currently active chapter ID */
  activeChapterId?: string;

  /** Chapter IDs that should be expanded because a field was recently updated by AI */
  recentlyUpdatedChapterIds?: string[];

  /** Callback when a field value changes */
  onFieldChange: (chapterId: string, fieldId: string, value: string | string[]) => void;

  /** Callback when "Proceed to Next Section" is clicked */
  onProceed: (chapterId: string) => void;

  /** Callback when a field receives focus (for conversational guidance) */
  onFieldFocus?: (fieldId: string) => void;

  /** Additional CSS class names */
  className?: string;
}

/**
 * ChapterSectionAccordion Component
 *
 * Renders all 11 IDEA framework chapters in an accordion format with:
 * - Active chapter auto-expanded showing editable fields
 * - Completed chapters collapsed with summary (first captured value)
 * - Future chapters disabled/locked
 * - "Proceed to Next Section" button for active chapter
 *
 * @example
 * ```tsx
 * <ChapterSectionAccordion
 *   chapters={chaptersWithData}
 *   activeChapterId="brand-foundation"
 *   onFieldChange={(chapterId, fieldId, value) => updateField(chapterId, fieldId, value)}
 *   onProceed={(chapterId) => moveToNextChapter(chapterId)}
 * />
 * ```
 */
export const ChapterSectionAccordion = React.forwardRef<ChapterAccordionHandle, ChapterSectionAccordionProps>(
  ({ chapters, activeChapterId, recentlyUpdatedChapterIds, onFieldChange, onProceed, onFieldFocus, className }, ref) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
    const flashRefsMap = React.useRef<Map<string, FieldFlashHandle>>(new Map());

    /**
     * Find the chapter ID that contains a given field ID
     */
    const findChapterForField = React.useCallback((fieldId: string): string | undefined => {
      for (const chapterData of chapters) {
        const fields = chapterData.chapter.fields || [];
        if (fields.some(f => f.id === fieldId)) {
          return chapterData.chapter.id;
        }
      }
      return undefined;
    }, [chapters]);

    /**
     * A chapter is "complete" if its fields contain at least 5 words total
     */
    const isChapterComplete = (chapterData: ChapterData): boolean => {
      const { chapter, fieldValues } = chapterData;
      if (!chapter.fields || !Array.isArray(chapter.fields)) return false;
      let wordCount = 0;
      for (const field of chapter.fields) {
        const value = fieldValues[field.id];
        if (!value) continue;
        const text = Array.isArray(value) ? value.join(' ') : String(value);
        wordCount += text.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount >= 5) return true;
      }
      return false;
    };

    /**
     * Get the first captured value from a chapter for summary display
     */
    const getChapterSummary = (chapterData: ChapterData): string => {
      const { chapter, fieldValues } = chapterData;

      // Safety check: ensure fields exist
      if (!chapter.fields || !Array.isArray(chapter.fields)) {
        return 'No data captured';
      }

      // Find the first field with a value
      for (const field of chapter.fields) {
        const value = fieldValues[field.id];
        if (value) {
          if (Array.isArray(value)) {
            return value[0] || 'No data captured';
          }
          // Truncate long text values
          const stringValue = String(value);
          return stringValue.length > 100
            ? `${stringValue.substring(0, 100)}...`
            : stringValue;
        }
      }

      return 'No data captured';
    };

    /**
     * Render chapter status badge
     */
    const renderStatusBadge = (status: ChapterStatus): JSX.Element | null => {
      switch (status) {
        case 'completed':
          return (
            <Badge variant="secondary" className="ml-2">
              Completed
            </Badge>
          );
        case 'active':
          return (
            <Badge variant="default" className="ml-2 bg-gradient-primary">
              Active
            </Badge>
          );
        case 'future':
          // This case shouldn't happen anymore, but keeping for safety
          return null;
        default:
          return null;
      }
    };

    /**
     * Render chapter fields for active chapter
     */
    /**
     * Callback ref factory for registering/unregistering FieldFlashHighlight handles
     */
    const createFlashCallbackRef = React.useCallback(
      (fieldId: string) => (handle: FieldFlashHandle | null): void => {
        if (handle) {
          flashRefsMap.current.set(fieldId, handle);
        } else {
          flashRefsMap.current.delete(fieldId);
        }
      },
      []
    );

    const renderChapterFields = (chapterData: ChapterData): JSX.Element => {
      const { chapter, fieldValues, fieldSources } = chapterData;

      // Safety check: ensure fields exist
      const fields = chapter.fields || [];

      return (
        <div className="space-y-6">
          {fields.map((field) => (
            <FieldFlashHighlight
              key={field.id}
              ref={createFlashCallbackRef(field.id)}
              fieldId={field.id}
            >
              <ChapterFieldSet
                field={field}
                value={fieldValues[field.id]}
                source={fieldSources?.[field.id]}
                onChange={(fieldId, value) => onFieldChange(chapter.id, fieldId, value)}
                onFocus={() => onFieldFocus?.(field.id)}
                disabled={chapterData.status !== 'active'}
              />
            </FieldFlashHighlight>
          ))}

          {chapterData.status === 'active' && (
            <div className="pt-4 border-t">
              <Button
                onClick={() => onProceed(chapter.id)}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Complete & Continue
              </Button>
            </div>
          )}
        </div>
      );
    };

    /**
     * Render completed chapter summary
     */
    const renderCompletedSummary = (chapterData: ChapterData): JSX.Element => {
      const summary = getChapterSummary(chapterData);

      return (
        <div className="text-sm text-muted-foreground italic">
          {summary}
        </div>
      );
    };

    /**
     * Accordion open state — only the active chapter is open by default.
     * Additional chapters open when: user clicks them, activeChapterId advances,
     * or the AI updates a field within them.
     */
    const [accordionValue, setAccordionValue] = React.useState<string[]>(
      activeChapterId ? [activeChapterId] : chapters.slice(0, 1).map(ch => ch.chapter.id)
    );

    // Expand the newly active chapter when the user advances (without closing others)
    React.useEffect(() => {
      if (activeChapterId) {
        setAccordionValue(prev =>
          prev.includes(activeChapterId) ? prev : [...prev, activeChapterId]
        );
      }
    }, [activeChapterId]);

    // Expand chapters that contain recently AI-updated fields
    React.useEffect(() => {
      if (recentlyUpdatedChapterIds && recentlyUpdatedChapterIds.length > 0) {
        setAccordionValue(prev => {
          const next = [...prev];
          recentlyUpdatedChapterIds.forEach(id => {
            if (!next.includes(id)) next.push(id);
          });
          return next;
        });
      }
    }, [recentlyUpdatedChapterIds]);

    // Expose imperative handle for programmatic chapter navigation and field focus
    React.useImperativeHandle(ref, () => ({
      focusChapter: (chapterId: string): void => {
        setAccordionValue([chapterId]);
        setTimeout(() => {
          const el = internalRef.current?.querySelector(`[data-chapter-id="${chapterId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      },
      focusField: (fieldId: string): void => {
        const chapterId = findChapterForField(fieldId);
        if (!chapterId) return;

        // Ensure the chapter is open
        setAccordionValue(prev =>
          prev.includes(chapterId) ? prev : [...prev, chapterId]
        );

        // Wait for accordion to expand, then scroll to the field
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`field-${fieldId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        });
      },
      flashField: (fieldId: string): void => {
        const handle = flashRefsMap.current.get(fieldId);
        handle?.flash();
      },
    }));

    /**
     * Group chapters by pillar in order, preserving chapter order within each group.
     * Returns an array of [pillar, chapters[]] tuples for rendering with headers.
     */
    const groupedByPillar = React.useMemo((): [Chapter['pillar'], ChapterData[]][] => {
      const groups = new Map<Chapter['pillar'], ChapterData[]>();
      for (const chapterData of chapters) {
        const { pillar } = chapterData.chapter;
        if (!groups.has(pillar)) groups.set(pillar, []);
        groups.get(pillar)!.push(chapterData);
      }
      return Array.from(groups.entries());
    }, [chapters]);

    return (
      <div ref={internalRef} className={cn("w-full", className)}>
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          {groupedByPillar.map(([pillar, pillarChapters]) => (
            <div key={pillar}>
              <div className="px-1 pt-4 pb-2 first:pt-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {PILLAR_LABELS[pillar]}
                </span>
              </div>
              {pillarChapters.map((chapterData) => {
                const { chapter, status } = chapterData;
                const isDisabled = false; // All chapters are now accessible
                const isOpen = accordionValue.includes(chapter.id);
                const complete = isChapterComplete(chapterData);

                return (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    data-chapter-id={chapter.id}
                    className={cn(
                      "border-b",
                      isDisabled && "opacity-50"
                    )}
                  >
                    <AccordionTrigger
                      className={cn(
                        "hover:no-underline",
                        isDisabled && "cursor-not-allowed"
                      )}
                      disabled={isDisabled}
                    >
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          {!isOpen && (
                            complete
                              ? <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                              : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                          )}
                          <div className="flex flex-col items-start">
                            <div className="flex items-center">
                              <span className="font-semibold">{chapter.title}</span>
                              {renderStatusBadge(status)}
                            </div>
                            <span className="text-sm text-muted-foreground font-normal mt-1">
                              {chapter.description}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pt-4 pb-6">
                      {status === 'completed' ? renderCompletedSummary(chapterData) : renderChapterFields(chapterData)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </div>
          ))}
        </Accordion>
      </div>
    );
  }
);

ChapterSectionAccordion.displayName = "ChapterSectionAccordion";
