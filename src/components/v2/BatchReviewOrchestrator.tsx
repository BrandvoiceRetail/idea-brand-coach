/**
 * BatchReviewOrchestrator Component
 *
 * Connects the extraction queue to AdaptiveFieldReview. Adds batch-specific
 * UI around the adaptive review: an AcceptAllToggle, a progress indicator
 * ("N of M"), and an "Accept All N" footer button.
 *
 * When `alwaysAccept` is true the component renders nothing — the parent
 * handles auto-accept without showing a modal.
 */

import { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCheck } from 'lucide-react';
import { AdaptiveFieldReview } from './AdaptiveFieldReview';
import { AcceptAllToggle } from './AcceptAllToggle';
import type { ReviewField } from './AdaptiveFieldReview';
import type { PendingField } from '@/hooks/v2/useExtractionQueue';

// ============================================================================
// Types
// ============================================================================

export interface BatchReviewOrchestratorProps {
  /** Pending fields awaiting review */
  queue: PendingField[];
  /** Index of the field currently being reviewed */
  currentIndex: number;
  /** Whether the review modal is open */
  isOpen: boolean;
  /** Callback when a field is accepted (optionally with an edited value) */
  onAccept: (fieldId: string, value?: string | string[]) => void;
  /** Callback when a field is rejected */
  onReject: (fieldId: string) => void;
  /** Callback to accept all remaining fields */
  onAcceptAll: () => void;
  /** Callback to close the review modal */
  onClose: () => void;
  /** Whether auto-accept is enabled */
  alwaysAccept: boolean;
  /** Callback to toggle auto-accept preference */
  onToggleAlwaysAccept: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a PendingField to the ReviewField format expected by
 * AdaptiveFieldReview and its sub-components.
 */
function toReviewField(pending: PendingField): ReviewField {
  return {
    id: pending.fieldId,
    label: pending.label,
    type: Array.isArray(pending.value) ? 'array' : 'text',
    placeholder: '',
    required: false,
    value: pending.value,
    source: 'ai',
    confidence: pending.confidence,
  };
}

// ============================================================================
// Component
// ============================================================================

export function BatchReviewOrchestrator({
  queue,
  currentIndex,
  isOpen,
  onAccept,
  onReject,
  onAcceptAll,
  onClose,
  alwaysAccept,
  onToggleAlwaysAccept,
}: BatchReviewOrchestratorProps): JSX.Element | null {
  const reviewFields = useMemo<ReviewField[]>(
    () => queue.map(toReviewField),
    [queue],
  );

  const handleAccept = useCallback(
    (field: ReviewField, value: string | string[]): void => {
      onAccept(field.id, value);
    },
    [onAccept],
  );

  const handleReject = useCallback(
    (field: ReviewField): void => {
      onReject(field.id);
    },
    [onReject],
  );

  // When auto-accept is on the parent commits fields directly — no modal.
  if (alwaysAccept || queue.length === 0) {
    return null;
  }

  const remaining = queue.length;

  return (
    <>
      {/* Batch controls bar — rendered above/outside the review sheet */}
      {isOpen && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2">
          <AcceptAllToggle isOn={alwaysAccept} onToggle={onToggleAlwaysAccept} />

          <span className="text-xs tabular-nums text-muted-foreground">
            {currentIndex + 1} of {remaining}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={onAcceptAll}
          >
            <CheckCheck className="mr-1 h-4 w-4" />
            Accept All {remaining}
          </Button>
        </div>
      )}

      {/* Adaptive review sheet (handles its own mobile/desktop layout) */}
      <AdaptiveFieldReview
        fields={reviewFields}
        isOpen={isOpen}
        onClose={onClose}
        onAccept={handleAccept}
        onReject={handleReject}
        currentIndex={currentIndex}
      />
    </>
  );
}
