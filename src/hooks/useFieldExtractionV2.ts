/**
 * useFieldExtractionV2 Hook
 *
 * Wrapper around useFieldExtraction that provides a simpler interface
 * for the V2 Brand Coach, handling field extraction from AI responses
 * and automatic updates to field values.
 *
 * Includes field lock system to protect fields from AI overwrites.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { useFieldExtraction as useBaseFieldExtraction } from './useFieldExtraction';

// Storage key prefix for field locks
const LOCK_STORAGE_PREFIX = 'v2_field_locks_';

/**
 * Field source indicator
 */
export type FieldSource = 'ai' | 'manual';

/**
 * Metadata for a single field, including lock state
 */
export interface FieldMetadata {
  /** Current value of the field */
  value: string | string[];
  /** Source of the value (ai or manual) */
  source: FieldSource;
  /** Whether the field is locked from AI extraction overwrites */
  isLocked: boolean;
}

/**
 * Simplified return type for V2 components
 */
export interface UseFieldExtractionV2Return {
  /** Extract fields from AI response and update values */
  extractFields: (rawResponse: string) => string;
  /** Current field values (flat object) */
  fieldValues: Record<string, string | string[]>;
  /** Field sources (ai or manual) */
  fieldSources: Record<string, FieldSource>;
  /** Field metadata including lock state */
  fieldMetadata: Record<string, FieldMetadata>;
  /** Set a field value manually */
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  /** Number of extracted fields */
  extractedCount: number;
  /** Clear all field values */
  clearFields: () => void;
  /** Lock or unlock a field from AI extraction */
  setFieldLock: (fieldId: string, locked: boolean) => void;
  /** Check if a field is locked */
  isFieldLocked: (fieldId: string) => boolean;
}

/**
 * Get the localStorage key for field locks scoped to an avatar
 */
function getLockStorageKey(avatarId: string): string {
  return `${LOCK_STORAGE_PREFIX}${avatarId}`;
}

/**
 * Load locked field IDs from localStorage
 */
function getStoredLocks(avatarId: string): Set<string> {
  try {
    const key = getLockStorageKey(avatarId);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return new Set();
    }
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error('Failed to load field locks from localStorage:', error);
    return new Set();
  }
}

/**
 * Save locked field IDs to localStorage
 */
function saveStoredLocks(avatarId: string, locks: Set<string>): void {
  try {
    const key = getLockStorageKey(avatarId);
    localStorage.setItem(key, JSON.stringify([...locks]));
  } catch (error) {
    console.error('Failed to save field locks to localStorage:', error);
  }
}

/**
 * V2 Field Extraction Hook
 *
 * Provides field extraction from AI responses with automatic updates
 * to field values displayed in the UI. Supports field locking to
 * prevent AI overwrites on specific fields.
 *
 * @param avatarId - Avatar ID for scoping field values
 * @returns Field extraction utilities and current values
 */
export function useFieldExtractionV2(avatarId: string | null): UseFieldExtractionV2Return {
  const resolvedAvatarId = avatarId || 'default';

  // Use the base extraction hook
  const baseHook = useBaseFieldExtraction(resolvedAvatarId);

  // Track extracted field count
  const [extractedCount, setExtractedCount] = useState(0);

  // Track locked fields
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => {
    return getStoredLocks(resolvedAvatarId);
  });

  // Transform fieldValues from FieldValue objects to flat values
  const fieldValues = useMemo(() => {
    const values: Record<string, string | string[]> = {};

    Object.entries(baseHook.fieldValues).forEach(([key, fieldValue]) => {
      values[key] = fieldValue.value;
    });

    return values;
  }, [baseHook.fieldValues]);

  // Extract field sources
  const fieldSources = useMemo(() => {
    const sources: Record<string, FieldSource> = {};

    Object.entries(baseHook.fieldValues).forEach(([key, fieldValue]) => {
      sources[key] = fieldValue.source;
    });

    return sources;
  }, [baseHook.fieldValues]);

  // Build field metadata combining values, sources, and lock state
  const fieldMetadata = useMemo(() => {
    const metadata: Record<string, FieldMetadata> = {};

    Object.entries(baseHook.fieldValues).forEach(([key, fieldValue]) => {
      metadata[key] = {
        value: fieldValue.value,
        source: fieldValue.source,
        isLocked: lockedFields.has(key),
      };
    });

    return metadata;
  }, [baseHook.fieldValues, lockedFields]);

  // Update extracted count
  useEffect(() => {
    const aiFieldCount = Object.values(fieldSources).filter(s => s === 'ai').length;
    setExtractedCount(aiFieldCount);
  }, [fieldSources]);

  // Lock or unlock a field
  const setFieldLock = useCallback((fieldId: string, locked: boolean): void => {
    setLockedFields((current) => {
      const updated = new Set(current);
      if (locked) {
        updated.add(fieldId);
      } else {
        updated.delete(fieldId);
      }
      saveStoredLocks(resolvedAvatarId, updated);
      return updated;
    });
  }, [resolvedAvatarId]);

  // Check if a field is locked
  const isFieldLocked = useCallback((fieldId: string): boolean => {
    return lockedFields.has(fieldId);
  }, [lockedFields]);

  // Wrapper for extractFields that pre-filters locked fields before the base hook sees them
  const extractFields = useCallback((rawResponse: string): string => {
    // Pre-filter: remove locked fields from the extraction JSON before base hook processes it
    let filteredResponse = rawResponse;
    if (lockedFields.size > 0) {
      filteredResponse = rawResponse.replace(
        /---FIELD_EXTRACTION_JSON---([\s\S]*?)---(?:END_)?FIELD_EXTRACTION_JSON---/g,
        (match, jsonBlock) => {
          try {
            const parsed = JSON.parse(jsonBlock.trim());
            if (parsed.fields && Array.isArray(parsed.fields)) {
              const skipped = parsed.fields.filter((f: { identifier: string }) => lockedFields.has(f.identifier));
              const applied = parsed.fields.filter((f: { identifier: string }) => !lockedFields.has(f.identifier));

              if (skipped.length > 0) {
                console.log(`[Field Extraction] Skipping ${skipped.length} locked fields:`, skipped.map((f: { identifier: string }) => f.identifier));
                if (applied.length > 0) {
                  toast.success(`Updated ${applied.length} field(s). ${skipped.length} locked field(s) skipped.`);
                } else {
                  toast.info(`All extracted fields were locked. No fields updated.`);
                }
              }

              parsed.fields = applied;
              return `---FIELD_EXTRACTION_JSON---\n${JSON.stringify(parsed, null, 2)}\n---END_FIELD_EXTRACTION_JSON---`;
            }
          } catch (e) {
            // If parsing fails, pass through unchanged
          }
          return match;
        }
      );
    }

    const result = baseHook.extractFields(filteredResponse);
    return result.displayText;
  }, [baseHook, lockedFields]);

  // Wrapper for setFieldManual that handles arrays
  const setFieldManual = useCallback((fieldId: string, value: string | string[]) => {
    const stringValue = Array.isArray(value) ? value.join('\n') : value;
    baseHook.setFieldManual(fieldId, stringValue);
  }, [baseHook]);

  return {
    extractFields,
    fieldValues,
    fieldSources,
    fieldMetadata,
    setFieldManual,
    extractedCount,
    clearFields: baseHook.clearFields,
    setFieldLock,
    isFieldLocked,
  };
}
