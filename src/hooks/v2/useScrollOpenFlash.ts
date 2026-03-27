import { useCallback, useEffect, useRef } from "react";
import type { ChapterAccordionHandle } from "@/components/v2/ChapterSectionAccordion";

/**
 * Configuration for the useScrollOpenFlash hook
 */
interface UseScrollOpenFlashConfig {
  accordionRef: React.RefObject<ChapterAccordionHandle>;
}

/**
 * Return value from the useScrollOpenFlash hook
 */
interface UseScrollOpenFlashReturn {
  /** Scroll to a field, open its accordion chapter, and flash it green */
  triggerFlash: (fieldId: string) => void;
  /** Sequentially scroll-open-flash multiple fields with staggered timing */
  triggerBatchFlash: (fieldIds: string[], staggerMs?: number) => void;
}

/** Delay (ms) between focusField and flashField to allow scroll to complete */
const SCROLL_TO_FLASH_DELAY = 300;

/**
 * useScrollOpenFlash
 *
 * Orchestrates the scroll-open-flash sequence for accepted AI field extractions.
 * For a given field ID it:
 *   1. Opens the parent chapter accordion and scrolls the field into view
 *   2. After a short delay (allowing scroll to settle), triggers the green flash
 *
 * Also supports batch mode where multiple fields are flashed in sequence with
 * a configurable stagger interval.
 *
 * @example
 * ```tsx
 * const accordionRef = useRef<ChapterAccordionHandle>(null);
 * const { triggerFlash, triggerBatchFlash } = useScrollOpenFlash({ accordionRef });
 *
 * // Single field
 * triggerFlash("brand-purpose");
 *
 * // Batch with 200ms stagger (default)
 * triggerBatchFlash(["brand-purpose", "brand-values", "brand-voice"]);
 * ```
 */
export function useScrollOpenFlash(
  config: UseScrollOpenFlashConfig
): UseScrollOpenFlashReturn {
  const { accordionRef } = config;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * Clear all pending timers to prevent memory leaks and stale callbacks
   */
  const clearTimers = useCallback((): void => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return (): void => {
      clearTimers();
    };
  }, [clearTimers]);

  /**
   * Scroll to a single field, open its chapter, and flash it green.
   */
  const triggerFlash = useCallback(
    (fieldId: string): void => {
      const handle = accordionRef.current;
      if (!handle) return;

      // Step 1: Open the chapter and scroll to the field
      handle.focusField(fieldId);

      // Step 2: After scroll settles, trigger the green flash
      const timer = setTimeout(() => {
        handle.flashField(fieldId);
      }, SCROLL_TO_FLASH_DELAY);

      timersRef.current.push(timer);
    },
    [accordionRef]
  );

  /**
   * Sequentially flash multiple fields with staggered timing.
   * Each field is delayed by `staggerMs` relative to the previous one.
   */
  const triggerBatchFlash = useCallback(
    (fieldIds: string[], staggerMs: number = 200): void => {
      // Clear any previously queued batch to avoid overlapping sequences
      clearTimers();

      fieldIds.forEach((fieldId, index) => {
        const delay = index * staggerMs;

        const timer = setTimeout(() => {
          triggerFlash(fieldId);
        }, delay);

        timersRef.current.push(timer);
      });
    },
    [triggerFlash, clearTimers]
  );

  return { triggerFlash, triggerBatchFlash };
}
