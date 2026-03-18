/**
 * useFieldExtractionRefactored Hook
 *
 * Refactored version following best practices guide:
 * - Small, focused functions (Single Responsibility)
 * - Clear separation of concerns
 * - Rich error context
 * - Testable components
 * - Strong type safety
 */

import { useState, useCallback, useMemo } from 'react';

// ============================================================================
// Constants
// ============================================================================

const FIELD_EXTRACTION_START = '---FIELD_EXTRACTION_JSON---';
const FIELD_EXTRACTION_END = '---FIELD_EXTRACTION_JSON---';
const FIELD_EXTRACTION_END_ALT = '---END_FIELD_EXTRACTION_JSON---';
const STORAGE_KEY_PREFIX = 'v2_field_values_';
const MIN_CONFIDENCE = 0.7;

// ============================================================================
// Types - Strong typing for better maintainability
// ============================================================================

export type FieldSource = 'ai' | 'manual';

export interface FieldValue {
  value: string;
  source: FieldSource;
  timestamp: string;
}

export type FieldValuesStore = Record<string, FieldValue>;

/**
 * Extraction block found in response - clear data structure
 */
interface ExtractionBlock {
  found: boolean;
  startIndex: number;
  endIndex: number;
  hasEndDelimiter: boolean;
  jsonContent: string;
  beforeContent: string;
  afterContent: string;
  endDelimiterLength: number;
}

/**
 * Field data from JSON - supports both formats
 */
interface FieldData {
  identifier: string;
  value: string | string[];
  confidence?: number;
  source?: string;
  context?: string;
}

/**
 * Recovery strategy result - tracks how fields were recovered
 */
interface RecoveryResult {
  fields: Record<string, string>;
  method: 'json-repair' | 'regex-extraction' | 'failed';
  confidence: number;
}

export interface ExtractFieldsResult {
  displayText: string;
  extractedFields: Record<string, string> | null;
  success: boolean;
}

export interface UseFieldExtractionReturn {
  extractFields: (rawResponse: string) => ExtractFieldsResult;
  fieldValues: FieldValuesStore;
  setFieldManual: (fieldId: string, value: string) => void;
  getField: (fieldId: string) => FieldValue | undefined;
  getFlatFieldValues: () => Record<string, string>;
  clearFields: () => void;
}

// ============================================================================
// Delimiter Detection - Single Responsibility: Find extraction boundaries
// ============================================================================

/**
 * Find extraction block in response text
 * ~20 lines - focused on delimiter detection only
 */
function findExtractionBlock(rawResponse: string): ExtractionBlock {
  const startIndex = rawResponse.indexOf(FIELD_EXTRACTION_START);

  if (startIndex === -1) {
    return {
      found: false,
      startIndex: -1,
      endIndex: -1,
      hasEndDelimiter: false,
      jsonContent: '',
      beforeContent: rawResponse,
      afterContent: '',
      endDelimiterLength: 0
    };
  }

  // Check for standard end delimiter
  let endIndex = rawResponse.indexOf(
    FIELD_EXTRACTION_END,
    startIndex + FIELD_EXTRACTION_START.length
  );
  let endDelimiterLength = FIELD_EXTRACTION_END.length;

  // Check for alternative end delimiter
  if (endIndex === -1) {
    endIndex = rawResponse.indexOf(
      FIELD_EXTRACTION_END_ALT,
      startIndex + FIELD_EXTRACTION_START.length
    );
    if (endIndex !== -1) {
      endDelimiterLength = FIELD_EXTRACTION_END_ALT.length;
    }
  }

  const jsonStart = startIndex + FIELD_EXTRACTION_START.length;
  const hasEndDelimiter = endIndex !== -1;

  return {
    found: true,
    startIndex,
    endIndex,
    hasEndDelimiter,
    jsonContent: hasEndDelimiter
      ? rawResponse.substring(jsonStart, endIndex).trim()
      : rawResponse.substring(jsonStart).trim(),
    beforeContent: rawResponse.substring(0, startIndex).trim(),
    afterContent: hasEndDelimiter
      ? rawResponse.substring(endIndex + endDelimiterLength).trim()
      : '',
    endDelimiterLength
  };
}

// ============================================================================
// JSON Parsing - Single Responsibility: Convert JSON to fields
// ============================================================================

/**
 * Parse field array from JSON data
 * ~25 lines - focused on data transformation only
 */
function parseFieldArray(data: any): Record<string, string> {
  const fields: Record<string, string> = {};

  // New format: { fields: [{identifier, value, confidence}] }
  if (data.fields && Array.isArray(data.fields)) {
    for (const field of data.fields) {
      if (!isValidField(field)) continue;

      const value = normalizeFieldValue(field.value);
      if (value) {
        fields[field.identifier] = value;
        logFieldExtraction(field.identifier, field.confidence);
      }
    }
  }
  // Legacy format: direct object
  else if (typeof data === 'object' && data !== null) {
    Object.entries(data).forEach(([key, value]) => {
      const normalized = normalizeFieldValue(value);
      if (normalized) {
        fields[key] = normalized;
      }
    });
  }

  return fields;
}

/**
 * Validate field meets extraction criteria
 * ~10 lines - single check
 */
function isValidField(field: any): boolean {
  if (!field.identifier || !field.value) return false;
  if (field.confidence !== undefined && field.confidence < MIN_CONFIDENCE) return false;
  return true;
}

/**
 * Normalize field value to string
 * ~10 lines - single transformation
 */
function normalizeFieldValue(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

/**
 * Log field extraction for debugging
 * ~5 lines - single purpose logging
 */
function logFieldExtraction(identifier: string, confidence?: number): void {
  const confidenceInfo = confidence ? ` (confidence: ${confidence})` : '';
  console.log(`[Field Extraction] Extracted: ${identifier}${confidenceInfo}`);
}

// ============================================================================
// Complete Extraction - Single Responsibility: Handle well-formed JSON
// ============================================================================

/**
 * Parse complete extraction with proper JSON
 * ~20 lines - focused on success path
 */
function parseCompleteExtraction(extraction: ExtractionBlock): ExtractFieldsResult {
  const displayText = buildDisplayText(extraction);

  try {
    const parsed = JSON.parse(extraction.jsonContent);
    const fields = parseFieldArray(parsed);

    if (Object.keys(fields).length > 0) {
      logExtractionSuccess(Object.keys(fields).length);
      return {
        displayText,
        extractedFields: fields,
        success: true
      };
    }

    return {
      displayText,
      extractedFields: null,
      success: false
    };
  } catch (error) {
    logExtractionError(error, extraction.jsonContent);
    return {
      displayText,
      extractedFields: null,
      success: false
    };
  }
}

/**
 * Build clean display text from extraction
 * ~5 lines - single text operation
 */
function buildDisplayText(extraction: ExtractionBlock): string {
  const parts = [extraction.beforeContent, extraction.afterContent].filter(Boolean);
  return parts.join('\n\n').trim();
}

// ============================================================================
// Truncation Recovery - Single Responsibility: Handle incomplete JSON
// ============================================================================

/**
 * Recover fields from truncated extraction
 * ~20 lines - orchestrates recovery strategies
 */
function recoverFromTruncation(extraction: ExtractionBlock): ExtractFieldsResult {
  console.warn('[Field Extraction] Attempting truncation recovery');

  // Try each recovery strategy in order
  const recoveryStrategies = [
    () => recoverViaJsonRepair(extraction.jsonContent),
    () => recoverViaRegex(extraction.jsonContent)
  ];

  for (const strategy of recoveryStrategies) {
    const result = strategy();
    if (result.method !== 'failed' && Object.keys(result.fields).length > 0) {
      logRecoverySuccess(result);
      return {
        displayText: extraction.beforeContent,
        extractedFields: result.fields,
        success: true
      };
    }
  }

  // All strategies failed
  return createFallbackResponse(extraction);
}

/**
 * Try to repair and parse truncated JSON
 * ~20 lines - focused on JSON repair
 */
function recoverViaJsonRepair(jsonContent: string): RecoveryResult {
  const repaired = attemptJsonRepair(jsonContent);

  if (!repaired) {
    return { fields: {}, method: 'failed', confidence: 0 };
  }

  try {
    const parsed = JSON.parse(repaired);
    const fields = parseFieldArray(parsed);

    return {
      fields,
      method: 'json-repair',
      confidence: 0.8
    };
  } catch {
    return { fields: {}, method: 'failed', confidence: 0 };
  }
}

/**
 * Extract fields using regex patterns
 * ~25 lines - focused on regex extraction
 */
function recoverViaRegex(jsonContent: string): RecoveryResult {
  const fields: Record<string, string> = {};

  // Pattern for standard field objects
  const fieldPattern = /\{\s*"identifier"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
  let match;

  while ((match = fieldPattern.exec(jsonContent)) !== null) {
    const [, identifier, value] = match;
    if (identifier && value) {
      fields[identifier] = value;
    }
  }

  // Pattern for array values
  const arrayPattern = /\{\s*"identifier"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*\[([^\]]+)\]/g;

  while ((match = arrayPattern.exec(jsonContent)) !== null) {
    const [, identifier, arrayContent] = match;
    if (identifier && arrayContent) {
      const values = extractArrayValues(arrayContent);
      if (values.length > 0) {
        fields[identifier] = values.join(', ');
      }
    }
  }

  return {
    fields,
    method: Object.keys(fields).length > 0 ? 'regex-extraction' : 'failed',
    confidence: 0.6
  };
}

/**
 * Extract array values from string
 * ~10 lines - single extraction purpose
 */
function extractArrayValues(arrayContent: string): string[] {
  const matches = arrayContent.match(/"([^"]+)"/g) || [];
  return matches.map(s => s.replace(/"/g, ''));
}

/**
 * Attempt to repair truncated JSON
 * ~15 lines - focused on repair logic
 */
function attemptJsonRepair(jsonContent: string): string | null {
  const content = jsonContent.trim();

  // Check for truncated fields array
  if (content.includes('"fields"') && content.includes('[')) {
    const lastCompleteField = content.lastIndexOf('},');

    if (lastCompleteField > 0) {
      const repaired = content.substring(0, lastCompleteField + 1) + ']}';

      // Validate repair
      try {
        JSON.parse(repaired);
        return repaired;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Create fallback response when recovery fails
 * ~10 lines - single fallback creation
 */
function createFallbackResponse(extraction: ExtractionBlock): ExtractFieldsResult {
  console.error('[Field Extraction] All recovery strategies failed');

  const displayText = extraction.beforeContent ||
    'I\'ve analyzed your document and found valuable brand elements. ' +
    'The extraction data was too large to process completely, but your information has been reviewed.';

  return {
    displayText,
    extractedFields: null,
    success: false
  };
}

// ============================================================================
// Logging Utilities - Single Responsibility: Diagnostic output
// ============================================================================

/**
 * Log successful extraction
 */
function logExtractionSuccess(fieldCount: number): void {
  console.log(`[Field Extraction] Success: ${fieldCount} fields extracted`);
}

/**
 * Log extraction error with context
 */
function logExtractionError(error: any, jsonContent: string): void {
  console.error('[Field Extraction] Parse error:', {
    error: error.message,
    jsonLength: jsonContent.length,
    preview: jsonContent.substring(0, 100) + '...'
  });
}

/**
 * Log successful recovery
 */
function logRecoverySuccess(result: RecoveryResult): void {
  console.warn(`[Field Extraction] Recovery succeeded:`, {
    method: result.method,
    fieldCount: Object.keys(result.fields).length,
    confidence: result.confidence
  });
}

// ============================================================================
// Main Orchestrator - Single Responsibility: Coordinate extraction flow
// ============================================================================

/**
 * Main extraction function - orchestrates the process
 * ~15 lines - pure orchestration
 */
export function parseFieldExtraction(rawResponse: string): ExtractFieldsResult {
  // Step 1: Find extraction boundaries
  const extraction = findExtractionBlock(rawResponse);

  // Step 2: No extraction found
  if (!extraction.found) {
    return {
      displayText: rawResponse,
      extractedFields: null,
      success: true
    };
  }

  // Step 3: Complete extraction
  if (extraction.hasEndDelimiter) {
    return parseCompleteExtraction(extraction);
  }

  // Step 4: Truncated extraction
  return recoverFromTruncation(extraction);
}

// ============================================================================
// Storage Functions - Single Responsibility: Persistence
// ============================================================================

/**
 * Load field values from localStorage
 * ~15 lines - focused on retrieval
 */
function loadFieldValues(avatarId: string): FieldValuesStore {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return {};

    const parsed = JSON.parse(stored);

    // Validate structure
    if (typeof parsed !== 'object') {
      console.warn('[Field Storage] Invalid stored data, resetting');
      return {};
    }

    return parsed as FieldValuesStore;
  } catch (error) {
    console.error('[Field Storage] Load failed:', error);
    return {};
  }
}

/**
 * Save field values to localStorage
 * ~10 lines - focused on persistence
 */
function saveFieldValues(avatarId: string, values: FieldValuesStore): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error('[Field Storage] Save failed:', error);
  }
}

// ============================================================================
// React Hook - Main interface
// ============================================================================

/**
 * Hook for managing field extraction from AI responses
 *
 * Following best practices:
 * - Small, focused internal functions
 * - Clear separation of concerns
 * - Rich error context in logging
 * - Strong type safety throughout
 */
export function useFieldExtraction(avatarId: string): UseFieldExtractionReturn {
  const [fieldValues, setFieldValues] = useState<FieldValuesStore>(() => {
    return loadFieldValues(avatarId);
  });

  const extractFields = useCallback((rawResponse: string): ExtractFieldsResult => {
    const result = parseFieldExtraction(rawResponse);

    if (result.success && result.extractedFields) {
      updateFieldValues(result.extractedFields, 'ai');
    }

    return result;
  }, [avatarId]);

  const updateFieldValues = useCallback((
    fields: Record<string, string>,
    source: FieldSource
  ): void => {
    const updates: FieldValuesStore = { ...fieldValues };
    let hasUpdates = false;

    for (const [fieldId, value] of Object.entries(fields)) {
      if (!updates[fieldId] || updates[fieldId].value !== value) {
        updates[fieldId] = {
          value,
          source,
          timestamp: new Date().toISOString()
        };
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      setFieldValues(updates);
      saveFieldValues(avatarId, updates);
    }
  }, [avatarId, fieldValues]);

  const setFieldManual = useCallback((fieldId: string, value: string): void => {
    updateFieldValues({ [fieldId]: value }, 'manual');
  }, [updateFieldValues]);

  const getField = useCallback((fieldId: string): FieldValue | undefined => {
    return fieldValues[fieldId];
  }, [fieldValues]);

  const getFlatFieldValues = useCallback((): Record<string, string> => {
    const flat: Record<string, string> = {};
    for (const [id, field] of Object.entries(fieldValues)) {
      flat[id] = field.value;
    }
    return flat;
  }, [fieldValues]);

  const clearFields = useCallback((): void => {
    setFieldValues({});
    saveFieldValues(avatarId, {});
    console.log('[Field Extraction] Cleared all fields');
  }, [avatarId]);

  // Sync on avatar change
  useMemo(() => {
    const stored = loadFieldValues(avatarId);
    setFieldValues(stored);
  }, [avatarId]);

  return {
    extractFields,
    fieldValues,
    setFieldManual,
    getField,
    getFlatFieldValues,
    clearFields
  };
}