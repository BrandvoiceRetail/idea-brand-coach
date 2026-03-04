/**
 * useFieldExtraction Hook
 * React hook for parsing field extraction JSON from AI responses
 * and managing field values with manual override support
 */

import { useState, useCallback, useMemo } from 'react';

// Delimiter for field extraction JSON in AI responses
const FIELD_EXTRACTION_DELIMITER = '---FIELD_EXTRACTION_JSON---';

// Storage key prefix for field values
const STORAGE_KEY_PREFIX = 'v2_field_values_';

/**
 * Source of a field value
 * - ai: Extracted from AI response
 * - manual: User-edited value (blocks AI overwrites)
 */
export type FieldSource = 'ai' | 'manual';

/**
 * Field value with source tracking
 */
export interface FieldValue {
  value: string;
  source: FieldSource;
}

/**
 * Storage structure for field values
 */
export interface FieldValuesStore {
  [fieldKey: string]: FieldValue;
}

/**
 * Result of extractFields operation
 */
export interface ExtractFieldsResult {
  /** Clean display text with extraction block removed */
  displayText: string;
  /** Extracted field values (if any) */
  extractedFields: Record<string, string> | null;
  /** Whether extraction was successful */
  success: boolean;
}

/**
 * Return type for useFieldExtraction hook
 */
export interface UseFieldExtractionReturn {
  /** Current field values */
  fieldValues: FieldValuesStore;
  /** Extract fields from AI response */
  extractFields: (rawResponse: string) => ExtractFieldsResult;
  /** Set a field value manually (blocks AI overwrites) */
  setFieldManual: (fieldKey: string, value: string) => void;
  /** Get a single field value */
  getField: (fieldKey: string) => FieldValue | undefined;
  /** Clear all field values */
  clearFields: () => void;
}

/**
 * Get storage key for avatar-scoped field values
 */
function getStorageKey(avatarId: string): string {
  return `${STORAGE_KEY_PREFIX}${avatarId}`;
}

/**
 * Get field values from localStorage
 */
export function getStoredFieldValues(avatarId: string): FieldValuesStore {
  try {
    const key = getStorageKey(avatarId);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return {};
    }
    return JSON.parse(stored) as FieldValuesStore;
  } catch (error) {
    // Handle localStorage access errors or invalid JSON
    console.error('Failed to load field values from localStorage:', error);
    return {};
  }
}

/**
 * Save field values to localStorage
 */
export function saveStoredFieldValues(avatarId: string, values: FieldValuesStore): void {
  try {
    const key = getStorageKey(avatarId);
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    // Silently handle localStorage access errors
    console.error('Failed to save field values to localStorage:', error);
  }
}

/**
 * Clear field values from localStorage
 */
export function clearStoredFieldValues(avatarId: string): void {
  try {
    const key = getStorageKey(avatarId);
    localStorage.removeItem(key);
  } catch (error) {
    // Silently handle localStorage access errors
    console.error('Failed to clear field values from localStorage:', error);
  }
}

/**
 * Parse field extraction JSON from AI response
 * Returns clean display text and extracted fields (if any)
 */
export function parseFieldExtraction(rawResponse: string): ExtractFieldsResult {
  // Check if response contains extraction delimiters
  const startIndex = rawResponse.indexOf(FIELD_EXTRACTION_DELIMITER);
  if (startIndex === -1) {
    // No extraction block found - return original response
    return {
      displayText: rawResponse,
      extractedFields: null,
      success: true,
    };
  }

  // Find end delimiter
  const endIndex = rawResponse.indexOf(
    FIELD_EXTRACTION_DELIMITER,
    startIndex + FIELD_EXTRACTION_DELIMITER.length
  );

  if (endIndex === -1) {
    // Missing end delimiter - return original response
    console.error('Field extraction block missing end delimiter');
    return {
      displayText: rawResponse,
      extractedFields: null,
      success: false,
    };
  }

  // Extract JSON block
  const jsonStart = startIndex + FIELD_EXTRACTION_DELIMITER.length;
  const jsonBlock = rawResponse.substring(jsonStart, endIndex).trim();

  // Remove extraction block from display text
  const displayText = (
    rawResponse.substring(0, startIndex) +
    rawResponse.substring(endIndex + FIELD_EXTRACTION_DELIMITER.length)
  ).trim();

  // Parse JSON
  try {
    const extractedFields = JSON.parse(jsonBlock) as Record<string, string>;
    return {
      displayText,
      extractedFields,
      success: true,
    };
  } catch (error) {
    // Malformed JSON - log error and return original response
    console.error('Failed to parse field extraction JSON:', error);
    console.error('Invalid JSON block:', jsonBlock);
    return {
      displayText: rawResponse,
      extractedFields: null,
      success: false,
    };
  }
}

/**
 * Hook for managing field extraction from AI responses
 *
 * @param avatarId - Avatar ID for scoping field values to specific avatar
 *
 * @example
 * ```tsx
 * const { extractFields, setFieldManual, getField } = useFieldExtraction('avatar_123');
 *
 * // Parse AI response
 * const result = extractFields(aiResponse);
 * console.log(result.displayText); // Clean text without extraction block
 *
 * // Set manual override
 * setFieldManual('demographics.age', '25-34');
 *
 * // Get field value
 * const ageField = getField('demographics.age');
 * console.log(ageField?.value, ageField?.source); // '25-34', 'manual'
 * ```
 */
export function useFieldExtraction(avatarId: string): UseFieldExtractionReturn {
  // Initialize field values from localStorage
  const [fieldValues, setFieldValues] = useState<FieldValuesStore>(() => {
    return getStoredFieldValues(avatarId);
  });

  // Extract fields from AI response and update storage
  const extractFields = useCallback(
    (rawResponse: string): ExtractFieldsResult => {
      const result = parseFieldExtraction(rawResponse);

      if (result.success && result.extractedFields) {
        // Update field values, but don't overwrite manual values
        setFieldValues((current) => {
          const updated = { ...current };
          let hasChanges = false;

          for (const [fieldKey, fieldValue] of Object.entries(result.extractedFields!)) {
            const existingField = current[fieldKey];

            // Only update if field doesn't exist or is from AI (not manual)
            if (!existingField || existingField.source === 'ai') {
              updated[fieldKey] = {
                value: fieldValue,
                source: 'ai',
              };
              hasChanges = true;
            }
          }

          // Save to localStorage if there were changes
          if (hasChanges) {
            saveStoredFieldValues(avatarId, updated);
          }

          return hasChanges ? updated : current;
        });
      }

      return result;
    },
    [avatarId]
  );

  // Set a field value manually (blocks AI overwrites)
  const setFieldManual = useCallback(
    (fieldKey: string, value: string): void => {
      setFieldValues((current) => {
        const updated = {
          ...current,
          [fieldKey]: {
            value,
            source: 'manual' as FieldSource,
          },
        };

        // Save to localStorage
        saveStoredFieldValues(avatarId, updated);

        return updated;
      });
    },
    [avatarId]
  );

  // Get a single field value
  const getField = useCallback(
    (fieldKey: string): FieldValue | undefined => {
      return fieldValues[fieldKey];
    },
    [fieldValues]
  );

  // Clear all field values
  const clearFields = useCallback((): void => {
    setFieldValues({});
    clearStoredFieldValues(avatarId);
  }, [avatarId]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      fieldValues,
      extractFields,
      setFieldManual,
      getField,
      clearFields,
    }),
    [fieldValues, extractFields, setFieldManual, getField, clearFields]
  );
}
