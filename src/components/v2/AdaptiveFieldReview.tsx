/**
 * AdaptiveFieldReview Component
 *
 * Unified component for reviewing extracted fields that adapts to device type:
 * - Mobile: Bottom sheet with swipe gestures (left=reject, right=accept, down=dismiss)
 * - Desktop: Sidebar panel with keyboard shortcuts (A=accept, R=reject, arrows=navigate)
 *
 * Provides smooth animations and transitions using framer-motion.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChapterFieldSet } from './ChapterFieldSet';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useSwipeGesture, SwipeEvent } from '@/hooks/useSwipeGesture';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Hand,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChapterField } from '@/config/chapterFields';
import { toast } from 'sonner';

/**
 * Field under review
 */
export interface ReviewField extends ChapterField {
  /** Current value to review */
  value: string | string[];

  /** Original value before edits */
  originalValue?: string | string[];

  /** Whether field has been modified */
  isDirty?: boolean;

  /** Field source (ai or manual) */
  source?: 'ai' | 'manual';

  /** Whether field is locked */
  isLocked?: boolean;
}

/**
 * Review action types
 */
export type ReviewAction = 'accept' | 'reject' | 'skip';

/**
 * Props for AdaptiveFieldReview
 */
export interface AdaptiveFieldReviewProps {
  /** Fields to review */
  fields: ReviewField[];

  /** Whether the review panel is open */
  isOpen: boolean;

  /** Callback to close the review panel */
  onClose: () => void;

  /** Callback when a field is accepted */
  onAccept?: (field: ReviewField, value: string | string[]) => void;

  /** Callback when a field is rejected */
  onReject?: (field: ReviewField) => void;

  /** Callback when field value is edited */
  onEdit?: (field: ReviewField, value: string | string[]) => void;

  /** Current field index being reviewed */
  currentIndex?: number;

  /** Callback when navigating between fields */
  onNavigate?: (index: number) => void;

  /** Whether to show keyboard shortcuts help */
  showHelp?: boolean;

  /** Custom trigger element (optional) */
  trigger?: React.ReactNode;
}

/**
 * Mobile bottom sheet variant
 */
const MobileFieldReview: React.FC<{
  field: ReviewField;
  nextField?: ReviewField;
  onAccept: (value: string | string[]) => void;
  onReject: () => void;
  onClose: () => void;
  onEdit: (value: string | string[]) => void;
  currentIndex: number;
  totalFields: number;
}> = ({
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

/**
 * Desktop sidebar variant
 */
const DesktopFieldReview: React.FC<{
  field: ReviewField;
  nextField?: ReviewField;
  previousField?: ReviewField;
  onAccept: (value: string | string[]) => void;
  onReject: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onEdit: (value: string | string[]) => void;
  currentIndex: number;
  totalFields: number;
  showHelp: boolean;
}> = ({
  field,
  nextField,
  previousField,
  onAccept,
  onReject,
  onNavigate,
  onEdit,
  currentIndex,
  totalFields,
  showHelp,
}) => {
  const [editedValue, setEditedValue] = useState(field.value);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent): void => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          onAccept(editedValue);
          break;
        case 'r':
          e.preventDefault();
          onReject();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (previousField) onNavigate('prev');
          break;
        case 'arrowright':
          e.preventDefault();
          if (nextField) onNavigate('next');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [editedValue, onAccept, onReject, onNavigate, previousField, nextField]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-green-600" />
          <span className="font-medium">Field Review</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {currentIndex + 1} / {totalFields}
        </Badge>
      </div>

      {/* Current field */}
      <div className="flex-1 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Current Field</h3>
            {field.source === 'ai' && (
              <Badge variant="secondary" className="text-xs">
                AI Extracted
              </Badge>
            )}
          </div>

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
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('prev')}
            disabled={!previousField}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('next')}
            disabled={!nextField}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Accept/Reject buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onReject}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            variant="default"
            onClick={() => onAccept(editedValue)}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
        </div>

        {/* Next field preview */}
        {nextField && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground">
              Next Field
            </h4>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium">{nextField.label}</div>
              {nextField.value && (
                <div className="text-sm text-muted-foreground mt-1 truncate">
                  {Array.isArray(nextField.value)
                    ? nextField.value.join(', ')
                    : nextField.value}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Keyboard shortcuts help */}
        {showHelp && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Keyboard className="h-3 w-3" />
              Keyboard Shortcuts
            </div>
            <div className="space-y-1 text-muted-foreground">
              <div>
                <kbd className="px-1 py-0.5 bg-background rounded text-xs">A</kbd> Accept
              </div>
              <div>
                <kbd className="px-1 py-0.5 bg-background rounded text-xs">R</kbd> Reject
              </div>
              <div>
                <kbd className="px-1 py-0.5 bg-background rounded text-xs">←</kbd>
                <kbd className="px-1 py-0.5 bg-background rounded text-xs ml-1">→</kbd> Navigate
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * AdaptiveFieldReview Component
 *
 * @example
 * ```tsx
 * <AdaptiveFieldReview
 *   fields={extractedFields}
 *   isOpen={reviewOpen}
 *   onClose={() => setReviewOpen(false)}
 *   onAccept={(field, value) => updateField(field.id, value)}
 *   onReject={(field) => rejectField(field.id)}
 * />
 * ```
 */
export const AdaptiveFieldReview: React.FC<AdaptiveFieldReviewProps> = ({
  fields,
  isOpen,
  onClose,
  onAccept,
  onReject,
  onEdit,
  currentIndex = 0,
  onNavigate,
  showHelp = true,
  trigger,
}) => {
  const { isMobile } = useDeviceType();
  const [internalIndex, setInternalIndex] = useState(currentIndex);

  // Sync internal index with prop
  useEffect(() => {
    setInternalIndex(currentIndex);
  }, [currentIndex]);

  const currentField = fields[internalIndex];
  const nextField = fields[internalIndex + 1];
  const previousField = fields[internalIndex - 1];

  const handleAccept = useCallback((value: string | string[]) => {
    onAccept?.(currentField, value);

    // Auto-advance to next field
    if (internalIndex < fields.length - 1) {
      const newIndex = internalIndex + 1;
      setInternalIndex(newIndex);
      onNavigate?.(newIndex);
    } else {
      // All fields reviewed
      toast.success('All fields reviewed!');
      onClose();
    }
  }, [currentField, internalIndex, fields.length, onAccept, onNavigate, onClose]);

  const handleReject = useCallback(() => {
    onReject?.(currentField);

    // Auto-advance to next field
    if (internalIndex < fields.length - 1) {
      const newIndex = internalIndex + 1;
      setInternalIndex(newIndex);
      onNavigate?.(newIndex);
    } else {
      // All fields reviewed
      toast.success('All fields reviewed!');
      onClose();
    }
  }, [currentField, internalIndex, fields.length, onReject, onNavigate, onClose]);

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    const newIndex = direction === 'next'
      ? Math.min(internalIndex + 1, fields.length - 1)
      : Math.max(internalIndex - 1, 0);

    setInternalIndex(newIndex);
    onNavigate?.(newIndex);
  }, [internalIndex, fields.length, onNavigate]);

  const handleEdit = useCallback((value: string | string[]) => {
    onEdit?.(currentField, value);
  }, [currentField, onEdit]);

  if (!currentField) {
    return null;
  }

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>Review Extracted Fields</SheetTitle>
            <SheetDescription>
              Swipe or tap to accept or reject extracted values
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 h-full pb-6">
            <MobileFieldReview
              field={currentField}
              nextField={nextField}
              onAccept={handleAccept}
              onReject={handleReject}
              onClose={onClose}
              onEdit={handleEdit}
              currentIndex={internalIndex}
              totalFields={fields.length}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Review Extracted Fields</SheetTitle>
          <SheetDescription>
            Review and edit AI-extracted field values
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 h-full pb-6">
          <DesktopFieldReview
            field={currentField}
            nextField={nextField}
            previousField={previousField}
            onAccept={handleAccept}
            onReject={handleReject}
            onNavigate={handleNavigate}
            onEdit={handleEdit}
            currentIndex={internalIndex}
            totalFields={fields.length}
            showHelp={showHelp}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};