/**
 * FieldReviewContext — Compatibility Wrapper
 *
 * Manages field review state for the mobile-first field editing experience.
 * Composes two focused sub-contexts:
 *   - FieldQueueContext: pending fields queue, enqueue/dequeue, accept/reject
 *   - ExtractionMetaContext: message extraction tracking, metadata, auto-accept
 *
 * The original useFieldReview() hook still returns ALL 18 properties for
 * backward compatibility. New consumers should prefer useFieldQueue() or
 * useExtractionMeta() for focused access.
 *
 * Integrates with useFieldExtraction to provide a review layer between
 * AI extraction and field persistence.
 */

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { FieldQueueContext, useFieldQueue } from '@/contexts/FieldQueueContext';
import type { FieldQueueContextValue } from '@/contexts/FieldQueueContext';
import { ExtractionMetaContext, useExtractionMeta } from '@/contexts/ExtractionMetaContext';
import type { ExtractionMetaContextValue } from '@/contexts/ExtractionMetaContext';

// Re-export sub-context hooks for convenience
export { useFieldQueue } from '@/contexts/FieldQueueContext';
export { useExtractionMeta } from '@/contexts/ExtractionMetaContext';

// localStorage key for auto-accept preference
const AUTO_ACCEPT_STORAGE_KEY = 'field_review_auto_accept';

/**
 * A single extracted field pending review
 */
export interface PendingField {
  /** Unique field identifier */
  fieldId: string;
  /** Display label for the field */
  fieldLabel: string;
  /** Extracted value from AI */
  value: string | string[];
  /** Confidence score from extraction (0-1) */
  confidence?: number;
  /** Source message ID that produced this extraction */
  messageId: string;
  /** Timestamp when field was extracted */
  extractedAt: string;
}

/**
 * Extraction metadata attached to a chat message
 */
export interface MessageExtractionMeta {
  /** Message ID */
  messageId: string;
  /** Fields extracted from this message */
  extractedFields: Record<string, string | string[]>;
  /** Number of fields extracted */
  fieldCount: number;
  /** Whether all fields from this message have been accepted */
  allAccepted: boolean;
}

/**
 * Field review action taken by the user
 */
export type FieldReviewAction = 'accept' | 'reject' | 'edit';

/**
 * Combined context value exposed to consumers via useFieldReview() (backward compat).
 * This is the union of FieldQueueContextValue and ExtractionMetaContextValue,
 * totaling 15 unique properties (some overlap removed).
 */
export interface FieldReviewContextValue extends FieldQueueContextValue, ExtractionMetaContextValue {}

interface FieldReviewProviderProps {
  children: ReactNode;
}

/**
 * Load auto-accept preference from localStorage
 */
function getStoredAutoAccept(): boolean {
  try {
    const stored = localStorage.getItem(AUTO_ACCEPT_STORAGE_KEY);
    return stored === 'true';
  } catch {
    return false;
  }
}

/**
 * Save auto-accept preference to localStorage
 */
function saveAutoAccept(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_ACCEPT_STORAGE_KEY, String(enabled));
  } catch (error) {
    console.error('Failed to save auto-accept preference:', error);
  }
}

/**
 * FieldReviewProvider composes FieldQueueContext and ExtractionMetaContext.
 * All state lives here; sub-context values are derived and distributed.
 */
export function FieldReviewProvider({ children }: FieldReviewProviderProps): JSX.Element {
  // ── Queue state ──────────────────────────────────────────────────────
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const fieldAcceptHandlerRef = useRef<((fieldId: string, value: string | string[]) => void) | null>(null);
  const [activeReviewFieldId, setActiveReviewFieldId] = useState<string | null>(null);

  // ── Extraction meta state ────────────────────────────────────────────
  const [messageExtractions, setMessageExtractions] = useState<Record<string, MessageExtractionMeta>>({});
  const [autoAcceptEnabled, setAutoAcceptEnabledState] = useState<boolean>(getStoredAutoAccept);

  const pendingCount = pendingFields.length;

  // ── Extraction meta callbacks ────────────────────────────────────────
  const setAutoAcceptEnabled = useCallback((enabled: boolean): void => {
    setAutoAcceptEnabledState(enabled);
    saveAutoAccept(enabled);
  }, []);

  const setMessageExtraction = useCallback((meta: MessageExtractionMeta): void => {
    setMessageExtractions((current) => ({
      ...current,
      [meta.messageId]: meta,
    }));
  }, []);

  const markMessageAccepted = useCallback((messageId: string): void => {
    setMessageExtractions((current) => {
      const existing = current[messageId];
      if (!existing) return current;
      return {
        ...current,
        [messageId]: { ...existing, allAccepted: true },
      };
    });
  }, []);

  // ── Queue callbacks ──────────────────────────────────────────────────
  const registerFieldAcceptHandler = useCallback(
    (handler: (fieldId: string, value: string | string[]) => void): void => {
      fieldAcceptHandlerRef.current = handler;
    },
    []
  );

  const enqueueFields = useCallback(
    (fields: PendingField[]): void => {
      if (autoAcceptEnabled && fieldAcceptHandlerRef.current) {
        for (const field of fields) {
          fieldAcceptHandlerRef.current(field.fieldId, field.value);
        }
        return;
      }

      setPendingFields((current) => {
        const existingIds = new Set(fields.map((f) => f.fieldId));
        const filtered = current.filter((f) => !existingIds.has(f.fieldId));
        return [...filtered, ...fields];
      });
    },
    [autoAcceptEnabled]
  );

  const acceptField = useCallback(
    (fieldId: string): void => {
      const field = pendingFields.find((f) => f.fieldId === fieldId);
      if (!field) return;

      fieldAcceptHandlerRef.current?.(field.fieldId, field.value);
      setPendingFields((current) => current.filter((f) => f.fieldId !== fieldId));
    },
    [pendingFields]
  );

  const rejectField = useCallback((fieldId: string): void => {
    setPendingFields((current) => current.filter((f) => f.fieldId !== fieldId));
  }, []);

  const acceptAllFields = useCallback((): void => {
    if (fieldAcceptHandlerRef.current) {
      for (const field of pendingFields) {
        fieldAcceptHandlerRef.current(field.fieldId, field.value);
      }
    }
    setPendingFields([]);
  }, [pendingFields]);

  const rejectAllFields = useCallback((): void => {
    setPendingFields([]);
  }, []);

  // ── Build sub-context values ─────────────────────────────────────────
  const queueValue = useMemo<FieldQueueContextValue>(
    () => ({
      pendingFields,
      enqueueFields,
      acceptField,
      rejectField,
      acceptAllFields,
      rejectAllFields,
      pendingCount,
      registerFieldAcceptHandler,
      activeReviewFieldId,
      setActiveReviewFieldId,
    }),
    [
      pendingFields,
      enqueueFields,
      acceptField,
      rejectField,
      acceptAllFields,
      rejectAllFields,
      pendingCount,
      registerFieldAcceptHandler,
      activeReviewFieldId,
    ]
  );

  const extractionMetaValue = useMemo<ExtractionMetaContextValue>(
    () => ({
      messageExtractions,
      setMessageExtraction,
      autoAcceptEnabled,
      setAutoAcceptEnabled,
      markMessageAccepted,
    }),
    [
      messageExtractions,
      setMessageExtraction,
      autoAcceptEnabled,
      setAutoAcceptEnabled,
      markMessageAccepted,
    ]
  );

  return (
    <ExtractionMetaContext.Provider value={extractionMetaValue}>
      <FieldQueueContext.Provider value={queueValue}>
        {children}
      </FieldQueueContext.Provider>
    </ExtractionMetaContext.Provider>
  );
}

/**
 * Hook to access the full field review state and actions (backward compat).
 * Returns all 15 properties from both sub-contexts.
 *
 * New consumers should prefer useFieldQueue() or useExtractionMeta() for
 * focused access and reduced re-render surface.
 */
export function useFieldReview(): FieldReviewContextValue {
  const queue = useFieldQueue();
  const extractionMeta = useExtractionMeta();
  return useMemo(
    () => ({ ...queue, ...extractionMeta }),
    [queue, extractionMeta]
  );
}
