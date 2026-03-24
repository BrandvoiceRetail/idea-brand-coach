/**
 * FieldQueueContext
 *
 * Focused context for the pending field review queue. Manages enqueue/dequeue
 * operations, accept/reject actions, and the currently active review field.
 *
 * Extracted from FieldReviewContext as part of the context-splitting refactor
 * (Task 2.3). Consumers that only need queue operations should prefer
 * `useFieldQueue()` over the full `useFieldReview()`.
 */

import { createContext, useContext } from 'react';
import type { PendingField } from '@/contexts/FieldReviewContext';

/**
 * Context value for field queue operations (10 properties)
 */
export interface FieldQueueContextValue {
  /** Queue of fields pending review */
  pendingFields: PendingField[];
  /** Add fields to the pending review queue */
  enqueueFields: (fields: PendingField[]) => void;
  /** Accept a single field (removes from queue) */
  acceptField: (fieldId: string) => void;
  /** Reject a single field (removes from queue without applying) */
  rejectField: (fieldId: string) => void;
  /** Accept all pending fields at once */
  acceptAllFields: () => void;
  /** Reject all pending fields at once */
  rejectAllFields: () => void;
  /** Number of fields awaiting review */
  pendingCount: number;
  /** Register the field acceptance handler */
  registerFieldAcceptHandler: (handler: (fieldId: string, value: string | string[]) => void) => void;
  /** Currently selected field for detailed review (null if none) */
  activeReviewFieldId: string | null;
  /** Open detailed review for a specific field */
  setActiveReviewFieldId: (fieldId: string | null) => void;
}

export const FieldQueueContext = createContext<FieldQueueContextValue | undefined>(undefined);

/**
 * Hook to access field queue state and actions.
 * Must be used within a FieldReviewProvider.
 *
 * Prefer this over useFieldReview() when you only need queue operations.
 */
export function useFieldQueue(): FieldQueueContextValue {
  const context = useContext(FieldQueueContext);
  if (!context) {
    throw new Error('useFieldQueue must be used within a FieldReviewProvider');
  }
  return context;
}
