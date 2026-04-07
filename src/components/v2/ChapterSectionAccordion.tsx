import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChapterFieldSet } from "./ChapterFieldSet";
import type { Chapter, ChapterStatus, FieldSource } from "@/config/chapterFields";

/**
 * Imperative handle for programmatic accordion control
 */
export interface ChapterAccordionHandle {
  /** Expand a specific chapter (closing others) and scroll it into view */
  focusChapter: (chapterId: string) => void;
  /** Open the chapter containing fieldId and scroll it into view */
  focusField: (fieldId: string) => void;
  /** Briefly flash a field element green to draw attention */
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

  /** Pending AI-extracted values awaiting Tab-to-accept, keyed by fieldId */
  pendingValues?: Record<string, string | string[]>;
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

  /** Callback when a field receives focus (for conversational guidance) */
  onFieldFocus?: (fieldId: string) => void;

  /** Additional CSS class names */
  className?: string;
}

/**
 * ChapterSectionAccordion Component
 *
 * Renders all 11 IDEA framework chapters in an accordion format with:
 * - All chapters always editable (no locked/completed state)
 * - Green checkmark icon when a chapter has content (5+ words)
 * - Active chapter auto-expanded
 *
 * @example
 * ```tsx
 * <ChapterSectionAccordion
 *   chapters={chaptersWithData}
 *   activeChapterId="brand-foundation"
 *   onFieldChange={(chapterId, fieldId, value) => updateField(chapterId, fieldId, value)}
 * />
 * ```
 */
export const ChapterSectionAccordion = React.forwardRef<ChapterAccordionHandle, ChapterSectionAccordionProps>(
  ({ chapters, activeChapterId, recentlyUpdatedChapterIds, onFieldChange, onFieldFocus, className }, ref) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
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
     * Render chapter content indicator based on field fill state
     */
    const renderContentBadge = (chapterData: ChapterData): JSX.Element | null => {
      const { chapter, fieldValues: vals } = chapterData;
      if (!chapter.fields || !Array.isArray(chapter.fields)) return null;
      const filled = chapter.fields.filter(f => {
        const v = vals[f.id];
        return v && String(v).trim() !== '';
      }).length;
      const total = chapter.fields.length;
      if (filled === 0) return null;
      return (
        <Badge
          variant={filled === total ? 'secondary' : 'outline'}
          className="ml-2 text-xs"
        >
          {filled}/{total}
        </Badge>
      );
    };

    /**
     * Render chapter fields — always editable
     */
    const renderChapterFields = (chapterData: ChapterData): JSX.Element => {
      const { chapter, fieldValues, fieldSources, pendingValues } = chapterData;

      // Safety check: ensure fields exist
      const fields = chapter.fields || [];

      return (
        <div className="space-y-6">
          {fields.map((field) => (
            <div key={field.id} data-field-id={field.id}>
              <ChapterFieldSet
                field={field}
                value={fieldValues[field.id]}
                pendingValue={pendingValues?.[field.id]}
                source={fieldSources?.[field.id]}
                onChange={(fieldId, value) => onFieldChange(chapter.id, fieldId, value)}
                onFocus={() => onFieldFocus?.(field.id)}
              />
            </div>
          ))}
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

    // Build a map from fieldId → chapterId for quick lookup
    const fieldToChapterMap = React.useMemo(() => {
      const map: Record<string, string> = {};
      chapters.forEach(({ chapter }) => {
        (chapter.fields || []).forEach((f) => { map[f.id] = chapter.id; });
      });
      return map;
    }, [chapters]);

    // Expose imperative handle for programmatic chapter navigation
    React.useImperativeHandle(ref, () => ({
      focusChapter: (chapterId: string) => {
        setAccordionValue([chapterId]);
        setTimeout(() => {
          const el = internalRef.current?.querySelector(`[data-chapter-id="${chapterId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      },

      focusField: (fieldId: string) => {
        const chapterId = fieldToChapterMap[fieldId];
        if (!chapterId) return;

        // Open the chapter if not already open
        setAccordionValue(prev =>
          prev.includes(chapterId) ? prev : [...prev, chapterId]
        );

        // Wait for accordion to expand, then scroll to the field
        setTimeout(() => {
          const el = internalRef.current?.querySelector(`[data-field-id="${fieldId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      },

      flashField: (fieldId: string) => {
        const el = internalRef.current?.querySelector(`[data-field-id="${fieldId}"]`) as HTMLElement | null;
        if (!el) return;

        el.style.transition = 'background-color 0.3s ease';
        el.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
        el.style.borderRadius = '8px';

        setTimeout(() => {
          el.style.backgroundColor = 'transparent';
          setTimeout(() => {
            el.style.transition = '';
            el.style.borderRadius = '';
          }, 300);
        }, 1200);
      },
    }));

    return (
      <div ref={internalRef} className={cn("w-full", className)}>
        <Accordion
          type="multiple"
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          {chapters.map((chapterData) => {
            const { chapter } = chapterData;
            const isOpen = accordionValue.includes(chapter.id);
            const complete = isChapterComplete(chapterData);

            return (
              <AccordionItem
                key={chapter.id}
                value={chapter.id}
                data-chapter-id={chapter.id}
                className="border-b"
              >
                <AccordionTrigger className="hover:no-underline">
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
                          {renderContentBadge(chapterData)}
                        </div>
                        <span className="text-sm text-muted-foreground font-normal mt-1">
                          {chapter.description}
                        </span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pt-4 pb-6">
                  {renderChapterFields(chapterData)}
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
