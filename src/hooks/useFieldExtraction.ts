/**
 * useFieldExtraction Hook - Unified Version
 *
 * Complete field extraction system with ALL features in one place:
 * - Robust JSON parsing with truncation recovery
 * - Field locking to prevent AI overwrites
 * - Manual field editing with source tracking
 * - Automatic persistence to localStorage
 * - Toast notifications for user feedback
 *
 * No more V1 vs V2 confusion - this is THE field extraction hook!
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Constants
// ============================================================================

const FIELD_EXTRACTION_START = '---FIELD_EXTRACTION_JSON---';
const FIELD_EXTRACTION_END = '---FIELD_EXTRACTION_JSON---';
const FIELD_EXTRACTION_END_ALT = '---END_FIELD_EXTRACTION_JSON---';
const STORAGE_KEY_PREFIX = 'v2_field_values_';
const LOCK_STORAGE_PREFIX = 'v2_field_locks_';
const MIN_CONFIDENCE = 0.7;

// ============================================================================
// Types - Complete type system for all features
// ============================================================================

export type FieldSource = 'ai' | 'manual';

export interface FieldValue {
  value: string;
  source: FieldSource;
  timestamp: string;
}

export type FieldValuesStore = Record<string, FieldValue>;

/**
 * Complete field metadata including lock state
 */
export interface FieldMetadata {
  value: string | string[];
  source: FieldSource;
  isLocked: boolean;
  timestamp?: string;
}

/**
 * Extraction block found in response
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
 * Recovery strategy result
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

/**
 * Complete unified hook return type with ALL features
 */
export interface UseFieldExtractionReturn {
  // Core extraction
  extractFields: (rawResponse: string) => string;

  // Field values and metadata
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
  fieldMetadata: Record<string, FieldMetadata>;

  // Field manipulation
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  clearFields: () => void;

  // Field locking (no longer in separate V2!)
  setFieldLock: (fieldId: string, locked: boolean) => void;
  isFieldLocked: (fieldId: string) => boolean;

  // Stats
  extractedCount: number;
}

// ============================================================================
// Delimiter Detection - Find extraction boundaries
// ============================================================================

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

  // Check both delimiter formats
  let endIndex = rawResponse.indexOf(
    FIELD_EXTRACTION_END,
    startIndex + FIELD_EXTRACTION_START.length
  );
  let endDelimiterLength = FIELD_EXTRACTION_END.length;

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
// JSON Parsing - Convert JSON to fields
// ============================================================================

function parseFieldArray(data: any): Record<string, string> {
  const fields: Record<string, string> = {};

  // Handle { fields: [{identifier, value, confidence}] }
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
  // Handle legacy flat format
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

function isValidField(field: any): boolean {
  if (!field.identifier || !field.value) return false;
  if (field.confidence !== undefined && field.confidence < MIN_CONFIDENCE) return false;
  return true;
}

function normalizeFieldValue(value: any): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

function logFieldExtraction(identifier: string, confidence?: number): void {
  const confidenceInfo = confidence ? ` (confidence: ${confidence})` : '';
  console.log(`[Field Extraction] Extracted: ${identifier}${confidenceInfo}`);
}

// ============================================================================
// Complete Extraction - Handle well-formed JSON
// ============================================================================

function parseCompleteExtraction(extraction: ExtractionBlock): ExtractFieldsResult {
  const displayText = buildDisplayText(extraction);

  try {
    const parsed = JSON.parse(extraction.jsonContent);
    const fields = parseFieldArray(parsed);

    if (Object.keys(fields).length > 0) {
      console.log(`[Field Extraction] Success: ${Object.keys(fields).length} fields extracted`);
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
    console.error('[Field Extraction] Parse error:', {
      error: (error as Error).message,
      jsonLength: extraction.jsonContent.length,
      preview: extraction.jsonContent.substring(0, 100) + '...'
    });
    return {
      displayText,
      extractedFields: null,
      success: false
    };
  }
}

function buildDisplayText(extraction: ExtractionBlock): string {
  const parts = [extraction.beforeContent, extraction.afterContent].filter(Boolean);
  return parts.join('\n\n').trim();
}

// ============================================================================
// Truncation Recovery - Handle incomplete JSON
// ============================================================================

function recoverFromTruncation(extraction: ExtractionBlock): ExtractFieldsResult {
  console.warn('[Field Extraction] Attempting truncation recovery');

  // Try each recovery strategy
  const recoveryStrategies = [
    () => recoverViaJsonRepair(extraction.jsonContent),
    () => recoverViaRegex(extraction.jsonContent)
  ];

  for (const strategy of recoveryStrategies) {
    const result = strategy();
    if (result.method !== 'failed' && Object.keys(result.fields).length > 0) {
      console.warn(`[Field Extraction] Recovery succeeded:`, {
        method: result.method,
        fieldCount: Object.keys(result.fields).length,
        confidence: result.confidence
      });
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

function recoverViaRegex(jsonContent: string): RecoveryResult {
  const fields: Record<string, string> = {};

  // Extract standard field objects
  const fieldPattern = /\{\s*"identifier"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
  let match;

  while ((match = fieldPattern.exec(jsonContent)) !== null) {
    const [, identifier, value] = match;
    if (identifier && value) {
      fields[identifier] = value;
    }
  }

  // Extract array values
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

function extractArrayValues(arrayContent: string): string[] {
  const matches = arrayContent.match(/"([^"]+)"/g) || [];
  return matches.map(s => s.replace(/"/g, ''));
}

function attemptJsonRepair(jsonContent: string): string | null {
  const content = jsonContent.trim();

  if (content.includes('"fields"') && content.includes('[')) {
    const lastCompleteField = content.lastIndexOf('},');

    if (lastCompleteField > 0) {
      const repaired = content.substring(0, lastCompleteField + 1) + ']}';

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
// Main Parsing Function - Orchestrator
// ============================================================================

/**
 * Parse field extraction from AI response
 */
export function parseFieldExtraction(rawResponse: string): ExtractFieldsResult {
  const extraction = findExtractionBlock(rawResponse);

  if (!extraction.found) {
    return {
      displayText: rawResponse,
      extractedFields: null,
      success: true
    };
  }

  if (extraction.hasEndDelimiter) {
    return parseCompleteExtraction(extraction);
  }

  return recoverFromTruncation(extraction);
}

// ============================================================================
// Storage Functions - Persistence for values and locks
// ============================================================================

function loadFieldValues(avatarId: string): FieldValuesStore {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return {};

    const parsed = JSON.parse(stored);

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

function saveFieldValues(avatarId: string, values: FieldValuesStore): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error('[Field Storage] Save failed:', error);
  }
}

function loadFieldLocks(avatarId: string): Set<string> {
  try {
    const key = `${LOCK_STORAGE_PREFIX}${avatarId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return new Set();

    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error('[Field Locks] Load failed:', error);
    return new Set();
  }
}

function saveFieldLocks(avatarId: string, locks: Set<string>): void {
  try {
    const key = `${LOCK_STORAGE_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify([...locks]));
  } catch (error) {
    console.error('[Field Locks] Save failed:', error);
  }
}

// ============================================================================
// THE ONE HOOK - Complete unified interface
// ============================================================================

/**
 * THE Field Extraction Hook - All features in one place!
 *
 * No more V1 vs V2 confusion. This hook has everything:
 * - Robust extraction with recovery strategies
 * - Field locking to prevent AI overwrites
 * - Manual editing with source tracking
 * - Automatic persistence
 * - Toast notifications
 *
 * @param avatarId - Avatar ID for scoping (null = 'default')
 */
export function useFieldExtraction(avatarId: string | null): UseFieldExtractionReturn {
  const resolvedAvatarId = avatarId || 'default';

  // Field values with source tracking
  const [fieldValues, setFieldValues] = useState<FieldValuesStore>(() => {
    return loadFieldValues(resolvedAvatarId);
  });

  // Locked fields that can't be overwritten by AI
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => {
    return loadFieldLocks(resolvedAvatarId);
  });

  // Count of AI-extracted fields
  const [extractedCount, setExtractedCount] = useState(0);

  // Transform to flat values for components
  const flatFieldValues = useMemo(() => {
    const values: Record<string, string | string[]> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      values[key] = field.value;
    });
    return values;
  }, [fieldValues]);

  // Extract sources for display
  const fieldSources = useMemo(() => {
    const sources: Record<string, FieldSource> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      sources[key] = field.source;
    });
    return sources;
  }, [fieldValues]);

  // Build complete metadata
  const fieldMetadata = useMemo(() => {
    const metadata: Record<string, FieldMetadata> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      metadata[key] = {
        value: field.value,
        source: field.source,
        isLocked: lockedFields.has(key),
        timestamp: field.timestamp
      };
    });
    return metadata;
  }, [fieldValues, lockedFields]);

  // Update extracted count when sources change
  useEffect(() => {
    const aiFieldCount = Object.values(fieldSources).filter(s => s === 'ai').length;
    setExtractedCount(aiFieldCount);
  }, [fieldSources]);

  // Extract and process fields from AI response
  const extractFields = useCallback((rawResponse: string): string => {
    const result = parseFieldExtraction(rawResponse);

    if (result.success && result.extractedFields) {
      const updates: FieldValuesStore = { ...fieldValues };
      const skippedFields: string[] = [];
      const appliedFields: string[] = [];

      // Process each extracted field
      for (const [fieldId, value] of Object.entries(result.extractedFields)) {
        // Skip if field is locked
        if (lockedFields.has(fieldId)) {
          skippedFields.push(fieldId);
          console.log(`[Field Extraction] Skipped locked field: ${fieldId}`);
        } else if (!updates[fieldId] || updates[fieldId].value !== value) {
          // Update if new or different
          updates[fieldId] = {
            value,
            source: 'ai',
            timestamp: new Date().toISOString()
          };
          appliedFields.push(fieldId);
        }
      }

      // Apply updates if any
      if (appliedFields.length > 0) {
        setFieldValues(updates);
        saveFieldValues(resolvedAvatarId, updates);
      }

      // Show user feedback via toasts
      if (appliedFields.length > 0 && skippedFields.length > 0) {
        toast.success(
          `Updated ${appliedFields.length} field${appliedFields.length !== 1 ? 's' : ''}. ` +
          `${skippedFields.length} locked field${skippedFields.length !== 1 ? 's' : ''} protected.`
        );
      } else if (appliedFields.length > 0) {
        toast.success(
          `Extracted ${appliedFields.length} field${appliedFields.length !== 1 ? 's' : ''} from response.`
        );
      } else if (skippedFields.length > 0) {
        toast.info(
          `All ${skippedFields.length} extracted field${skippedFields.length !== 1 ? 's were' : ' was'} locked. No updates made.`
        );
      }
    }

    return result.displayText;
  }, [fieldValues, lockedFields, resolvedAvatarId]);

  // Set field value manually
  const setFieldManual = useCallback((fieldId: string, value: string | string[]): void => {
    const normalizedValue = Array.isArray(value) ? value.join('\n') : value;

    const updates = {
      ...fieldValues,
      [fieldId]: {
        value: normalizedValue,
        source: 'manual' as FieldSource,
        timestamp: new Date().toISOString()
      }
    };

    setFieldValues(updates);
    saveFieldValues(resolvedAvatarId, updates);
  }, [fieldValues, resolvedAvatarId]);

  // Lock or unlock a field
  const setFieldLock = useCallback((fieldId: string, locked: boolean): void => {
    const updated = new Set(lockedFields);

    if (locked) {
      updated.add(fieldId);
      toast.info(`Field locked: AI won't overwrite this value`);
    } else {
      updated.delete(fieldId);
      toast.info(`Field unlocked: AI can update this value`);
    }

    setLockedFields(updated);
    saveFieldLocks(resolvedAvatarId, updated);
  }, [lockedFields, resolvedAvatarId]);

  // Check if field is locked
  const isFieldLocked = useCallback((fieldId: string): boolean => {
    return lockedFields.has(fieldId);
  }, [lockedFields]);

  // Clear all fields
  const clearFields = useCallback((): void => {
    setFieldValues({});
    saveFieldValues(resolvedAvatarId, {});
    console.log('[Field Extraction] Cleared all fields');
  }, [resolvedAvatarId]);

  // Sync when avatar changes
  useEffect(() => {
    const values = loadFieldValues(resolvedAvatarId);
    const locks = loadFieldLocks(resolvedAvatarId);
    setFieldValues(values);
    setLockedFields(locks);
  }, [resolvedAvatarId]);

  return {
    extractFields,
    fieldValues: flatFieldValues,
    fieldSources,
    fieldMetadata,
    setFieldManual,
    clearFields,
    setFieldLock,
    isFieldLocked,
    extractedCount
  };
}

// ============================================================================
// Backward Compatibility - Can be removed after migration
// ============================================================================

/**
 * @deprecated Use useFieldExtraction instead - V2 is now unified into main hook
 */
export const useFieldExtractionV2 = useFieldExtraction;