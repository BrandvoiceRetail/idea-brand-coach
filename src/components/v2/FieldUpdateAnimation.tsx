/**
 * FieldUpdateAnimation Component
 *
 * Wraps field elements with framer-motion animations that trigger
 * when field values are updated. Provides visual feedback showing
 * that a field was just changed (highlight flash + subtle scale).
 *
 * Also implements progressive chapter visibility - chapters are
 * revealed as fields within them get filled.
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Props for FieldUpdateAnimation
 */
export interface FieldUpdateAnimationProps {
  /** Unique key for the field (used to detect changes) */
  fieldId: string;

  /** Current field value (animation triggers on change) */
  value: string | string[] | undefined;

  /** Children to wrap with animation */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

/**
 * FieldUpdateAnimation Component
 *
 * Wraps a field component and flashes a highlight when the value changes.
 *
 * @example
 * ```tsx
 * <FieldUpdateAnimation fieldId="brand-name" value={brandName}>
 *   <ChapterFieldSet field={field} value={brandName} ... />
 * </FieldUpdateAnimation>
 * ```
 */
export const FieldUpdateAnimation: React.FC<FieldUpdateAnimationProps> = ({
  fieldId,
  value,
  children,
  className,
}) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const previousValueRef = useRef(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousValueRef.current = value;
      return;
    }

    const serialized = Array.isArray(value) ? value.join(',') : value;
    const prevSerialized = Array.isArray(previousValueRef.current)
      ? previousValueRef.current.join(',')
      : previousValueRef.current;

    if (serialized !== prevSerialized) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 1500);
      previousValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <motion.div
      key={fieldId}
      animate={isHighlighted ? {
        scale: [1, 1.005, 1],
        transition: { duration: 0.3 },
      } : {}}
      className={cn(
        'relative rounded-lg transition-shadow duration-500',
        isHighlighted && 'shadow-[0_0_0_2px_rgba(34,197,94,0.3)] bg-green-500/5',
        className
      )}
    >
      {children}

      {/* Flash overlay */}
      <AnimatePresence>
        {isHighlighted && (
          <motion.div
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 rounded-lg bg-green-500/10 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Props for ProgressiveChapterReveal
 */
export interface ProgressiveChapterRevealProps {
  /** Whether this chapter should be visible */
  isVisible: boolean;

  /** Children (chapter content) */
  children: React.ReactNode;

  /** Additional CSS classes */
  className?: string;
}

/**
 * ProgressiveChapterReveal Component
 *
 * Animates chapters into view as they become relevant (fields get filled
 * in previous chapters). Provides a smooth reveal animation.
 *
 * @example
 * ```tsx
 * <ProgressiveChapterReveal isVisible={chapterIndex <= activeChapterIndex + 1}>
 *   <ChapterSectionAccordion ... />
 * </ProgressiveChapterReveal>
 * ```
 */
export const ProgressiveChapterReveal: React.FC<ProgressiveChapterRevealProps> = ({
  isVisible,
  children,
  className,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{
            duration: 0.4,
            ease: 'easeInOut',
            opacity: { duration: 0.3, delay: 0.1 },
          }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
