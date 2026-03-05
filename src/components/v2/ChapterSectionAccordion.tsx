import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChapterFieldSet } from "./ChapterFieldSet";
import type { Chapter, ChapterStatus, FieldSource } from "@/config/chapterFields";

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
export const ChapterSectionAccordion = React.forwardRef<HTMLDivElement, ChapterSectionAccordionProps>(
  ({ chapters, activeChapterId, onFieldChange, onProceed, onFieldFocus, className }, ref) => {
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
    const renderChapterFields = (chapterData: ChapterData): JSX.Element => {
      const { chapter, fieldValues, fieldSources } = chapterData;

      // Safety check: ensure fields exist
      const fields = chapter.fields || [];

      return (
        <div className="space-y-6">
          {fields.map((field) => (
            <ChapterFieldSet
              key={field.id}
              field={field}
              value={fieldValues[field.id]}
              source={fieldSources?.[field.id]}
              onChange={(fieldId, value) => onFieldChange(chapter.id, fieldId, value)}
              onFocus={() => onFieldFocus?.(field.id)}
              disabled={chapterData.status !== 'active'}
            />
          ))}

          {chapterData.status === 'active' && (
            <div className="pt-4 border-t">
              <Button
                onClick={() => onProceed(chapter.id)}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Mark Chapter Complete
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
     * Render empty state for chapters without fields
     */
    const renderEmptyState = (): JSX.Element => {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Chat with Trevor to populate fields for this chapter</span>
        </div>
      );
    };

    /**
     * Determine accordion value (which items are open)
     * Open all chapters by default for easy access
     */
    const [accordionValue, setAccordionValue] = React.useState<string[]>(
      chapters.map(ch => ch.chapter.id)
    );

    // Update accordion value when chapters change
    React.useEffect(() => {
      // Keep all chapters expanded by default
      setAccordionValue(chapters.map(ch => ch.chapter.id));
    }, [chapters]);

    return (
      <div ref={ref} className={cn("w-full", className)}>
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          {chapters.map((chapterData) => {
            const { chapter, status } = chapterData;
            const isDisabled = false; // All chapters are now accessible

            return (
              <AccordionItem
                key={chapter.id}
                value={chapter.id}
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
                </AccordionTrigger>

                <AccordionContent className="pt-4 pb-6">
                  {status === 'completed' ? renderCompletedSummary(chapterData) : renderChapterFields(chapterData)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    );
  }
);

ChapterSectionAccordion.displayName = "ChapterSectionAccordion";
