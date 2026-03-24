/**
 * ExtractionMetaContext
 *
 * Focused context for message extraction tracking, metadata, and auto-accept
 * preferences. Tracks which messages have had fields extracted and whether
 * those extractions have been accepted.
 *
 * Extracted from FieldReviewContext as part of the context-splitting refactor
 * (Task 2.3). Consumers that only need extraction metadata should prefer
 * `useExtractionMeta()` over the full `useFieldReview()`.
 */

import { createContext, useContext } from 'react';
import type { MessageExtractionMeta } from '@/contexts/FieldReviewContext';

/**
 * Context value for extraction metadata operations (5 properties)
 */
export interface ExtractionMetaContextValue {
  /** Extraction metadata indexed by message ID */
  messageExtractions: Record<string, MessageExtractionMeta>;
  /** Record extraction metadata for a message */
  setMessageExtraction: (meta: MessageExtractionMeta) => void;
  /** Whether auto-accept is enabled */
  autoAcceptEnabled: boolean;
  /** Toggle auto-accept preference */
  setAutoAcceptEnabled: (enabled: boolean) => void;
  /** Mark a message's extractions as fully accepted */
  markMessageAccepted: (messageId: string) => void;
}

export const ExtractionMetaContext = createContext<ExtractionMetaContextValue | undefined>(undefined);

/**
 * Hook to access extraction metadata state and actions.
 * Must be used within a FieldReviewProvider.
 *
 * Prefer this over useFieldReview() when you only need extraction metadata.
 */
export function useExtractionMeta(): ExtractionMetaContextValue {
  const context = useContext(ExtractionMetaContext);
  if (!context) {
    throw new Error('useExtractionMeta must be used within a FieldReviewProvider');
  }
  return context;
}
