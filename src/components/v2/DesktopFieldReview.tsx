/**
 * DesktopFieldReview Component
 *
 * Desktop-optimized field review sidebar with keyboard shortcuts:
 * - A = Accept current field
 * - R = Reject current field
 * - Arrow Left/Right = Navigate between fields
 *
 * Includes navigation buttons, next-field preview, and keyboard shortcut help.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChapterFieldSet } from './ChapterFieldSet';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewField } from './AdaptiveFieldReview';

/**
 * Props for DesktopFieldReview
 */
export interface DesktopFieldReviewProps {
  /** Current field being reviewed */
  field: ReviewField;

  /** Next field in the queue (for preview) */
  nextField?: ReviewField;

  /** Previous field in the queue (for navigation) */
  previousField?: ReviewField;

  /** Callback when field value is accepted */
  onAccept: (value: string | string[]) => void;

  /** Callback when field is rejected */
  onReject: () => void;

  /** Callback to navigate between fields */
  onNavigate: (direction: 'prev' | 'next') => void;

  /** Callback when field value is edited */
  onEdit: (value: string | string[]) => void;

  /** Current field index (zero-based) */
  currentIndex: number;

  /** Total number of fields to review */
  totalFields: number;

  /** Whether to show keyboard shortcuts help */
  showHelp: boolean;
}

/**
 * Desktop sidebar variant for field review with keyboard shortcuts.
 */
export const DesktopFieldReview: React.FC<DesktopFieldReviewProps> = ({
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

  // Reset edited value when the active field changes
  useEffect(() => {
    setEditedValue(field.value);
  }, [field.id]);

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
            <div className="flex items-center gap-1.5">
              {field.source === 'ai' && (
                <Badge variant="secondary" className="text-xs">
                  AI Extracted
                </Badge>
              )}
              {field.confidence != null && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    field.confidence < 0.7
                      ? 'text-amber-600 border-amber-500/30'
                      : ''
                  )}
                >
                  {Math.round(field.confidence * 100)}%
                </Badge>
              )}
            </div>
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
