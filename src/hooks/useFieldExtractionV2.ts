/**
 * useFieldExtractionV2 Hook
 *
 * Wrapper around useFieldExtraction that provides a simpler interface
 * for the V2 Brand Coach, handling field extraction from AI responses
 * and automatic updates to field values.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useFieldExtraction as useBaseFieldExtraction } from './useFieldExtraction';

/**
 * Field source indicator
 */
export type FieldSource = 'ai' | 'manual';

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
  /** Set a field value manually */
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  /** Number of extracted fields */
  extractedCount: number;
  /** Clear all field values */
  clearFields: () => void;
}

/**
 * V2 Field Extraction Hook
 *
 * Provides field extraction from AI responses with automatic updates
 * to field values displayed in the UI.
 *
 * @param avatarId - Avatar ID for scoping field values
 * @returns Field extraction utilities and current values
 */
export function useFieldExtractionV2(avatarId: string | null): UseFieldExtractionV2Return {
  // Use the base extraction hook
  const baseHook = useBaseFieldExtraction(avatarId || 'default');

  // Track extracted field count
  const [extractedCount, setExtractedCount] = useState(0);

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

  // Update extracted count
  useEffect(() => {
    const aiFieldCount = Object.values(fieldSources).filter(s => s === 'ai').length;
    setExtractedCount(aiFieldCount);
  }, [fieldSources]);

  // Wrapper for extractFields that returns clean text
  const extractFields = useCallback((rawResponse: string): string => {
    const result = baseHook.extractFields(rawResponse);

    if (result.success && result.extractedFields) {
      const fieldCount = Object.keys(result.extractedFields).length;
      console.log(`[Field Extraction] Extracted ${fieldCount} fields from AI response`);

      // Log each extracted field for debugging
      Object.entries(result.extractedFields).forEach(([fieldId, value]) => {
        console.log(`  - ${fieldId}: "${value}"`);
      });
    }

    return result.displayText;
  }, [baseHook]);

  // Wrapper for setFieldManual that handles arrays
  const setFieldManual = useCallback((fieldId: string, value: string | string[]) => {
    const stringValue = Array.isArray(value) ? value.join('\n') : value;
    baseHook.setFieldManual(fieldId, stringValue);
  }, [baseHook]);

  return {
    extractFields,
    fieldValues,
    fieldSources,
    setFieldManual,
    extractedCount,
    clearFields: baseHook.clearFields,
  };
}