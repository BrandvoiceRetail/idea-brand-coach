/**
 * AdaptiveFieldReview Component
 *
 * Unified component for reviewing extracted fields that adapts to device type:
 * - Mobile: Bottom sheet with swipe gestures (left=reject, right=accept, down=dismiss)
 * - Desktop: Sidebar panel with keyboard shortcuts (A=accept, R=reject, arrows=navigate)
 *
 * Delegates rendering to MobileFieldReview and DesktopFieldReview sub-components.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useDeviceType } from '@/hooks/useDeviceType';
import { MobileFieldReview } from './MobileFieldReview';
import { DesktopFieldReview } from './DesktopFieldReview';
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

  /** Confidence score (0-1) from AI extraction */
  confidence?: number;
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
 * AdaptiveFieldReview Component
 *
 * Thin orchestrator that picks mobile vs desktop variant based on device type,
 * manages navigation state, and wraps the appropriate sub-component in a Sheet.
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
