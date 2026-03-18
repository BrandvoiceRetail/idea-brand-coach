/**
 * FieldReviewContext
 *
 * Manages field review state for the mobile-first field editing experience.
 * Tracks pending review queue, extraction metadata per message, auto-accept
 * logic, and batch field acceptance.
 *
 * Integrates with useFieldExtraction to provide a review layer between
 * AI extraction and field persistence.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import type { FieldSource } from '@/hooks/useFieldExtraction';

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
 * Context value exposed to consumers
 */
export interface FieldReviewContextValue {
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
  /** Extraction metadata indexed by message ID */
  messageExtractions: Record<string, MessageExtractionMeta>;
  /** Record extraction metadata for a message */
  setMessageExtraction: (meta: MessageExtractionMeta) => void;
  /** Whether auto-accept is enabled */
  autoAcceptEnabled: boolean;
  /** Toggle auto-accept preference */
  setAutoAcceptEnabled: (enabled: boolean) => void;
  /** Callback fired when a field is accepted — consumers wire this to setFieldManual */
  onFieldAccepted: ((fieldId: string, value: string | string[]) => void) | null;
  /** Register the field acceptance handler */
  registerFieldAcceptHandler: (handler: (fieldId: string, value: string | string[]) => void) => void;
  /** Currently selected field for detailed review (null if none) */
  activeReviewFieldId: string | null;
  /** Open detailed review for a specific field */
  setActiveReviewFieldId: (fieldId: string | null) => void;
  /** Mark a message's extractions as fully accepted */
  markMessageAccepted: (messageId: string) => void;
}

const FieldReviewContext = createContext<FieldReviewContextValue | undefined>(undefined);

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

export function FieldReviewProvider({ children }: FieldReviewProviderProps): JSX.Element {
  const [pendingFields, setPendingFields] = useState<PendingField[]>([]);
  const [messageExtractions, setMessageExtractions] = useState<Record<string, MessageExtractionMeta>>({});
  const [autoAcceptEnabled, setAutoAcceptEnabledState] = useState<boolean>(getStoredAutoAccept);
  const [fieldAcceptHandler, setFieldAcceptHandler] = useState<
    ((fieldId: string, value: string | string[]) => void) | null
  >(null);
  const [activeReviewFieldId, setActiveReviewFieldId] = useState<string | null>(null);

  const pendingCount = pendingFields.length;

  const setAutoAcceptEnabled = useCallback((enabled: boolean): void => {
    setAutoAcceptEnabledState(enabled);
    saveAutoAccept(enabled);
  }, []);

  const registerFieldAcceptHandler = useCallback(
    (handler: (fieldId: string, value: string | string[]) => void): void => {
      setFieldAcceptHandler(() => handler);
    },
    []
  );

  const enqueueFields = useCallback(
    (fields: PendingField[]): void => {
      if (autoAcceptEnabled && fieldAcceptHandler) {
        // Auto-accept: apply fields immediately without queuing
        for (const field of fields) {
          fieldAcceptHandler(field.fieldId, field.value);
        }
        return;
      }

      setPendingFields((current) => {
        // Deduplicate by fieldId — newer extraction replaces older
        const existingIds = new Set(fields.map((f) => f.fieldId));
        const filtered = current.filter((f) => !existingIds.has(f.fieldId));
        return [...filtered, ...fields];
      });
    },
    [autoAcceptEnabled, fieldAcceptHandler]
  );

  const acceptField = useCallback(
    (fieldId: string): void => {
      const field = pendingFields.find((f) => f.fieldId === fieldId);
      if (!field) return;

      if (fieldAcceptHandler) {
        fieldAcceptHandler(field.fieldId, field.value);
      }

      setPendingFields((current) => current.filter((f) => f.fieldId !== fieldId));
    },
    [pendingFields, fieldAcceptHandler]
  );

  const rejectField = useCallback((fieldId: string): void => {
    setPendingFields((current) => current.filter((f) => f.fieldId !== fieldId));
  }, []);

  const acceptAllFields = useCallback((): void => {
    if (fieldAcceptHandler) {
      for (const field of pendingFields) {
        fieldAcceptHandler(field.fieldId, field.value);
      }
    }
    setPendingFields([]);
  }, [pendingFields, fieldAcceptHandler]);

  const rejectAllFields = useCallback((): void => {
    setPendingFields([]);
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

  const value = useMemo<FieldReviewContextValue>(
    () => ({
      pendingFields,
      enqueueFields,
      acceptField,
      rejectField,
      acceptAllFields,
      rejectAllFields,
      pendingCount,
      messageExtractions,
      setMessageExtraction,
      autoAcceptEnabled,
      setAutoAcceptEnabled,
      onFieldAccepted: fieldAcceptHandler,
      registerFieldAcceptHandler,
      activeReviewFieldId,
      setActiveReviewFieldId,
      markMessageAccepted,
    }),
    [
      pendingFields,
      enqueueFields,
      acceptField,
      rejectField,
      acceptAllFields,
      rejectAllFields,
      pendingCount,
      messageExtractions,
      setMessageExtraction,
      autoAcceptEnabled,
      setAutoAcceptEnabled,
      fieldAcceptHandler,
      registerFieldAcceptHandler,
      activeReviewFieldId,
      markMessageAccepted,
    ]
  );

  return (
    <FieldReviewContext.Provider value={value}>
      {children}
    </FieldReviewContext.Provider>
  );
}

/**
 * Hook to access field review state and actions.
 * Must be used within a FieldReviewProvider.
 */
export function useFieldReview(): FieldReviewContextValue {
  const context = useContext(FieldReviewContext);
  if (!context) {
    throw new Error('useFieldReview must be used within a FieldReviewProvider');
  }
  return context;
}
