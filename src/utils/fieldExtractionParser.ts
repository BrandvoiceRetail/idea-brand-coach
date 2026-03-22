/**
 * Field Extraction Parser Utilities
 *
 * Pure parsing functions extracted from useFieldExtraction hook.
 * These have no React dependencies and can be tested in isolation.
 */

// ============================================================================
// Constants
// ============================================================================

export const FIELD_EXTRACTION_START = '---FIELD_EXTRACTION_JSON---';
export const FIELD_EXTRACTION_END = '---END_FIELD_EXTRACTION_JSON---';
export const MIN_CONFIDENCE = 0.7;

// ============================================================================
// Types
// ============================================================================

export interface ExtractionBlock {
  found: boolean;
  startIndex: number;
  endIndex: number;
  hasEndDelimiter: boolean;
  jsonContent: string;
  beforeContent: string;
  afterContent: string;
  endDelimiterLength: number;
}

export interface RecoveryResult {
  fields: Record<string, string>;
  method: 'json-repair' | 'regex-extraction' | 'failed';
  confidence: number;
}

export interface ExtractFieldsResult {
  displayText: string;
  extractedFields: Record<string, string> | null;
  success: boolean;
}

// ============================================================================
// Delimiter Detection
// ============================================================================

export function findExtractionBlock(rawResponse: string): ExtractionBlock {
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
      endDelimiterLength: 0,
    };
  }

  const endIndex = rawResponse.indexOf(
    FIELD_EXTRACTION_END,
    startIndex + FIELD_EXTRACTION_START.length
  );
  const endDelimiterLength = FIELD_EXTRACTION_END.length;

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
    endDelimiterLength,
  };
}

// ============================================================================
// JSON Parsing
// ============================================================================

export function parseFieldArray(data: unknown): Record<string, string> {
  const fields: Record<string, string> = {};

  if (typeof data !== 'object' || data === null) return fields;

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.fields)) {
    for (const field of obj.fields) {
      if (!isValidField(field)) continue;
      const f = field as Record<string, unknown>;
      const value = normalizeFieldValue(f.value);
      if (value) {
        fields[f.identifier as string] = value;
        logFieldExtraction(f.identifier as string, f.confidence as number | undefined);
      }
    }
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const normalized = normalizeFieldValue(value);
      if (normalized) {
        fields[key] = normalized;
      }
    });
  }

  return fields;
}

export function isValidField(field: unknown): boolean {
  if (typeof field !== 'object' || field === null) return false;
  const f = field as Record<string, unknown>;
  if (!f.identifier || !f.value) return false;
  if (f.confidence !== undefined && (f.confidence as number) < MIN_CONFIDENCE) return false;
  return true;
}

export function normalizeFieldValue(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
}

export function logFieldExtraction(identifier: string, confidence?: number): void {
  const confidenceInfo = confidence ? ` (confidence: ${confidence})` : '';
  console.log(`[Field Extraction] Extracted: ${identifier}${confidenceInfo}`);
}

// ============================================================================
// Complete Extraction
// ============================================================================

export function buildDisplayText(extraction: ExtractionBlock): string {
  const parts = [extraction.beforeContent, extraction.afterContent].filter(Boolean);
  return parts.join('\n\n').trim();
}

export function parseCompleteExtraction(extraction: ExtractionBlock): ExtractFieldsResult {
  const displayText = buildDisplayText(extraction);

  try {
    const parsed = JSON.parse(extraction.jsonContent);
    const fields = parseFieldArray(parsed);

    if (Object.keys(fields).length > 0) {
      console.log(`[Field Extraction] Success: ${Object.keys(fields).length} fields extracted`);
      return { displayText, extractedFields: fields, success: true };
    }

    return { displayText, extractedFields: null, success: false };
  } catch (error) {
    console.error('[Field Extraction] Parse error:', {
      error: (error as Error).message,
      jsonLength: extraction.jsonContent.length,
      preview: extraction.jsonContent.substring(0, 100) + '...',
    });
    return { displayText, extractedFields: null, success: false };
  }
}

// ============================================================================
// Truncation Recovery
// ============================================================================

export function createFallbackResponse(extraction: ExtractionBlock): ExtractFieldsResult {
  console.error('[Field Extraction] All recovery strategies failed');
  const displayText =
    extraction.beforeContent ||
    "I've analyzed your document and found valuable brand elements. " +
      'The extraction data was too large to process completely, but your information has been reviewed.';
  return { displayText, extractedFields: null, success: false };
}

export function extractArrayValues(arrayContent: string): string[] {
  const matches = arrayContent.match(/"([^"]+)"/g) || [];
  return matches.map(s => s.replace(/"/g, ''));
}

export function attemptJsonRepair(jsonContent: string): string | null {
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

export function recoverViaJsonRepair(jsonContent: string): RecoveryResult {
  const repaired = attemptJsonRepair(jsonContent);
  if (!repaired) return { fields: {}, method: 'failed', confidence: 0 };

  try {
    const parsed = JSON.parse(repaired);
    const fields = parseFieldArray(parsed);
    return { fields, method: 'json-repair', confidence: 0.8 };
  } catch {
    return { fields: {}, method: 'failed', confidence: 0 };
  }
}

export function recoverViaRegex(jsonContent: string): RecoveryResult {
  const fields: Record<string, string> = {};

  const fieldPattern = /\{\s*"identifier"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
  let match;
  while ((match = fieldPattern.exec(jsonContent)) !== null) {
    const [, identifier, value] = match;
    if (identifier && value) fields[identifier] = value;
  }

  const arrayPattern = /\{\s*"identifier"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*\[([^\]]+)\]/g;
  while ((match = arrayPattern.exec(jsonContent)) !== null) {
    const [, identifier, arrayContent] = match;
    if (identifier && arrayContent) {
      const values = extractArrayValues(arrayContent);
      if (values.length > 0) fields[identifier] = values.join(', ');
    }
  }

  return {
    fields,
    method: Object.keys(fields).length > 0 ? 'regex-extraction' : 'failed',
    confidence: 0.6,
  };
}

export function recoverFromTruncation(extraction: ExtractionBlock): ExtractFieldsResult {
  console.warn('[Field Extraction] Attempting truncation recovery');

  const recoveryStrategies = [
    () => recoverViaJsonRepair(extraction.jsonContent),
    () => recoverViaRegex(extraction.jsonContent),
  ];

  for (const strategy of recoveryStrategies) {
    const result = strategy();
    if (result.method !== 'failed' && Object.keys(result.fields).length > 0) {
      console.warn('[Field Extraction] Recovery succeeded:', {
        method: result.method,
        fieldCount: Object.keys(result.fields).length,
        confidence: result.confidence,
      });
      return {
        displayText: extraction.beforeContent,
        extractedFields: result.fields,
        success: true,
      };
    }
  }

  return createFallbackResponse(extraction);
}

// ============================================================================
// Main Parsing Function
// ============================================================================

/**
 * Parse field extraction from AI response
 */
export function parseFieldExtraction(rawResponse: string): ExtractFieldsResult {
  const extraction = findExtractionBlock(rawResponse);

  if (!extraction.found) {
    return { displayText: rawResponse, extractedFields: null, success: true };
  }

  if (extraction.hasEndDelimiter) {
    return parseCompleteExtraction(extraction);
  }

  return recoverFromTruncation(extraction);
}
