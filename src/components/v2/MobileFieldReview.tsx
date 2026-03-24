/**
 * MobileFieldReview Component
 *
 * Mobile-optimized field review with swipe gestures:
 * - Swipe left to reject
 * - Swipe right to accept
 * - Swipe down to dismiss
 *
 * Includes progress indicator, swipe hints, and fallback action buttons.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChapterFieldSet } from './ChapterFieldSet';
import { useSwipeGesture, SwipeEvent } from '@/hooks/useSwipeGesture';
import {
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Hand,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewField } from './AdaptiveFieldReview';

/**
 * Props for MobileFieldReview
 */
export interface MobileFieldReviewProps {
  /** Current field being reviewed */
  field: ReviewField;

  /** Next field in the queue (for preview) */
  nextField?: ReviewField;

  /** Callback when field value is accepted */
  onAccept: (value: string | string[]) => void;

  /** Callback when field is rejected */
  onReject: () => void;

  /** Callback to close the review panel */
  onClose: () => void;

  /** Callback when field value is edited */
  onEdit: (value: string | string[]) => void;

  /** Current field index (zero-based) */
  currentIndex: number;

  /** Total number of fields to review */
  totalFields: number;
}

/**
 * Mobile bottom sheet variant for field review with swipe gestures.
 */
export const MobileFieldReview: React.FC<MobileFieldReviewProps> = ({
  field,
  nextField,
  onAccept,
  onReject,
  onClose,
  onEdit,
  currentIndex,
  totalFields,
}) => {
  const [editedValue, setEditedValue] = useState(field.value);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handleSwipe = useCallback((event: SwipeEvent) => {
    switch (event.direction) {
      case 'left':
        setSwipeDirection('left');
        setTimeout(() => {
          onReject();
          setSwipeDirection(null);
        }, 200);
        break;
      case 'right':
        setSwipeDirection('right');
        setTimeout(() => {
          onAccept(editedValue);
          setSwipeDirection(null);
        }, 200);
        break;
      case 'down':
        if (event.distance > 100) {
          onClose();
        }
        break;
    }
  }, [editedValue, onAccept, onReject, onClose]);

  const swipe = useSwipeGesture({
    onSwipe: handleSwipe,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="secondary" className="text-xs">
          {currentIndex + 1} of {totalFields}
        </Badge>
        <div className="flex gap-1">
          {Array.from({ length: totalFields }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 w-8 rounded-full transition-colors',
                i === currentIndex
                  ? 'bg-primary'
                  : i < currentIndex
                  ? 'bg-primary/50'
                  : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Field content with swipe animation */}
      <motion.div
        {...swipe.handlers}
        animate={{
          x: swipeDirection === 'left' ? -100 : swipeDirection === 'right' ? 100 : 0,
          opacity: swipeDirection ? 0.5 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="flex-1 space-y-4"
      >
        <ChapterFieldSet
          field={field}
          value={editedValue}
          source={field.source}
          onChange={(_, value) => {
            setEditedValue(value);
            onEdit(value);
          }}
          isLocked={field.isLocked}
        />

        {/* Swipe hints */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-6">
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-3 w-3" />
            <span>Reject</span>
          </div>
          <div className="flex items-center gap-2">
            <Hand className="h-4 w-4" />
            <span>Swipe to review</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Accept</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </motion.div>

      {/* Action buttons as fallback */}
      <div className="flex gap-2 mt-6 pt-4 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-1" />
          Reject
        </Button>
        <Button
          size="sm"
          onClick={() => onAccept(editedValue)}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-1" />
          Accept
        </Button>
      </div>

      {/* Next field preview */}
      {nextField && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground mb-1">Up next:</div>
          <div className="font-medium text-sm">{nextField.label}</div>
        </div>
      )}
    </div>
  );
};
