import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFieldExtraction,
  parseFieldExtraction,
  getStoredFieldValues,
  saveStoredFieldValues,
  clearStoredFieldValues,
  type FieldValuesStore,
} from '../useFieldExtraction';

describe('useFieldExtraction', () => {
  const mockLocalStorage: Record<string, string> = {};
  const testAvatarId = 'test-avatar-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
      }),
    });

    // Mock console.error and console.warn to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  it('should provide all hook methods and properties', () => {
    const { result } = renderHook(() => useFieldExtraction(testAvatarId));

    expect(result.current).toHaveProperty('fieldValues');
    expect(result.current).toHaveProperty('extractFields');
    expect(result.current).toHaveProperty('setFieldManual');
    expect(result.current).toHaveProperty('clearFields');
    expect(result.current).toHaveProperty('fieldSources');
    expect(result.current).toHaveProperty('fieldMetadata');
    expect(result.current).toHaveProperty('setFieldLock');
    expect(result.current).toHaveProperty('isFieldLocked');
  });

  it('should initialize with empty field values', () => {
    const { result } = renderHook(() => useFieldExtraction(testAvatarId));

    expect(result.current.fieldValues).toEqual({});
  });

  it('should initialize with stored field values from localStorage', () => {
    const storedValues: FieldValuesStore = {
      brandPurpose: { value: 'To inspire', source: 'manual', timestamp: '2026-01-01T00:00:00.000Z' },
      brandVision: { value: 'A better world', source: 'ai', timestamp: '2026-01-01T00:00:00.000Z' },
    };

    mockLocalStorage[`v2_field_values_${testAvatarId}`] = JSON.stringify(storedValues);

    const { result } = renderHook(() => useFieldExtraction(testAvatarId));

    // fieldValues exposes flat values (not the raw store)
    expect(result.current.fieldValues).toEqual({
      brandPurpose: 'To inspire',
      brandVision: 'A better world',
    });
  });

  describe('extractFields', () => {
    it('should extract fields from AI response with delimiters and return display text', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const aiResponse = `Here is some text.
---FIELD_EXTRACTION_JSON---
{"brandPurpose": "To inspire", "brandVision": "A better world"}
---END_FIELD_EXTRACTION_JSON---
More text here.`;

      let displayText: string | undefined;
      act(() => {
        displayText = result.current.extractFields(aiResponse);
      });

      // extractFields returns display text (string), not an object
      expect(displayText).toBe('Here is some text.\n\nMore text here.');

      // Field values are flat strings
      expect(result.current.fieldValues['brandPurpose']).toBe('To inspire');
      expect(result.current.fieldValues['brandVision']).toBe('A better world');
    });

    it('should return original response when no delimiters found', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const plainResponse = 'Just plain text without extraction.';

      let displayText: string | undefined;
      act(() => {
        displayText = result.current.extractFields(plainResponse);
      });

      expect(displayText).toBe(plainResponse);
      expect(result.current.fieldValues).toEqual({});
    });

    it('should overwrite existing AI field values with new AI values', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // First AI extraction
      const firstResponse = `---FIELD_EXTRACTION_JSON---
{"brandPurpose": "First purpose"}
---END_FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(firstResponse);
      });

      expect(result.current.fieldValues['brandPurpose']).toBe('First purpose');
      expect(result.current.fieldSources['brandPurpose']).toBe('ai');

      // Second AI extraction with different value
      const secondResponse = `---FIELD_EXTRACTION_JSON---
{"brandPurpose": "Updated purpose"}
---END_FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(secondResponse);
      });

      expect(result.current.fieldValues['brandPurpose']).toBe('Updated purpose');
    });

    it('should handle malformed JSON gracefully', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const malformedResponse = `---FIELD_EXTRACTION_JSON---
{invalid json here}
---END_FIELD_EXTRACTION_JSON---`;

      let displayText: string | undefined;
      act(() => {
        displayText = result.current.extractFields(malformedResponse);
      });

      // Display text is empty (before-content was empty)
      expect(displayText).toBe('');
      expect(result.current.fieldValues).toEqual({});
    });

    it('should handle missing end delimiter via truncation recovery', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const incompleteResponse = `---FIELD_EXTRACTION_JSON---
{"fields": [{"identifier": "brandPurpose", "value": "Recovered purpose", "confidence": 0.9}]}`;

      let displayText: string | undefined;
      act(() => {
        displayText = result.current.extractFields(incompleteResponse);
      });

      // Should recover via json-repair strategy
      expect(displayText).toBe('');
      expect(result.current.fieldValues['brandPurpose']).toBe('Recovered purpose');
    });

    it('should save extracted fields to localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"brandPurpose": "To inspire"}
---END_FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        expect.stringContaining('"brandPurpose"')
      );
    });

    it('should not overwrite locked fields', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // Set a manual value and lock it
      act(() => {
        result.current.setFieldManual('brandPurpose', 'My locked purpose');
        result.current.setFieldLock('brandPurpose', true);
      });

      // Try to overwrite with AI extraction
      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"brandPurpose": "AI override attempt"}
---END_FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      // Locked value should be preserved
      expect(result.current.fieldValues['brandPurpose']).toBe('My locked purpose');
    });
  });

  describe('setFieldManual', () => {
    it('should set a field value with manual source', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('brandPurpose', 'My brand purpose');
      });

      expect(result.current.fieldValues['brandPurpose']).toBe('My brand purpose');
      expect(result.current.fieldSources['brandPurpose']).toBe('manual');
    });

    it('should overwrite existing AI value with manual value', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // First set AI value
      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"brandPurpose": "AI purpose"}
---END_FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      expect(result.current.fieldSources['brandPurpose']).toBe('ai');

      // Overwrite with manual value
      act(() => {
        result.current.setFieldManual('brandPurpose', 'Manual override');
      });

      expect(result.current.fieldValues['brandPurpose']).toBe('Manual override');
      expect(result.current.fieldSources['brandPurpose']).toBe('manual');
    });

    it('should save manual field to localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('brandPurpose', 'My brand purpose');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        expect.stringContaining('"brandPurpose"')
      );
    });

    it('should join array values with newline', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('brandValues', ['Innovation', 'Integrity', 'Excellence']);
      });

      expect(result.current.fieldValues['brandValues']).toBe('Innovation\nIntegrity\nExcellence');
    });
  });

  describe('fieldMetadata', () => {
    it('should return field value if it exists via fieldMetadata', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('brandPurpose', 'My purpose');
      });

      const meta = result.current.fieldMetadata['brandPurpose'];

      expect(meta.value).toBe('My purpose');
      expect(meta.source).toBe('manual');
      expect(meta.isLocked).toBe(false);
    });

    it('should return undefined for non-existent field in fieldMetadata', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const meta = result.current.fieldMetadata['nonexistent'];

      expect(meta).toBeUndefined();
    });
  });

  describe('clearFields', () => {
    it('should clear all field values from state', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // Set some fields
      act(() => {
        result.current.setFieldManual('brandPurpose', 'Purpose 1');
        result.current.setFieldManual('brandVision', 'Vision 1');
      });

      expect(Object.keys(result.current.fieldValues).length).toBe(2);

      // Clear fields
      act(() => {
        result.current.clearFields();
      });

      expect(result.current.fieldValues).toEqual({});
    });

    it('should persist cleared state to localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('brandPurpose', 'Purpose');
      });

      act(() => {
        result.current.clearFields();
      });

      // clearFields calls saveFieldValues with {} which calls setItem with '{}'
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        '{}'
      );
    });
  });

  describe('avatar scoping', () => {
    it('should use different storage keys for different avatars', () => {
      const avatar1 = 'avatar-1';
      const avatar2 = 'avatar-2';

      const { result: result1 } = renderHook(() => useFieldExtraction(avatar1));
      const { result: result2 } = renderHook(() => useFieldExtraction(avatar2));

      act(() => {
        result1.current.setFieldManual('brandPurpose', 'Avatar 1 purpose');
      });

      act(() => {
        result2.current.setFieldManual('brandPurpose', 'Avatar 2 purpose');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${avatar1}`,
        expect.any(String)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${avatar2}`,
        expect.any(String)
      );

      expect(result1.current.fieldValues['brandPurpose']).toBe('Avatar 1 purpose');
      expect(result2.current.fieldValues['brandPurpose']).toBe('Avatar 2 purpose');
    });
  });
});

describe('parseFieldExtraction', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse valid field extraction JSON', () => {
    const input = `Text before
---FIELD_EXTRACTION_JSON---
{"field1": "value1", "field2": "value2"}
---END_FIELD_EXTRACTION_JSON---
Text after`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: 'Text before\n\nText after',
      extractedFields: {
        field1: 'value1',
        field2: 'value2',
      },
      success: true,
    });
  });

  it('should return original text when no delimiters found', () => {
    const input = 'Plain text without delimiters';

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: input,
      extractedFields: null,
      success: true,
    });
  });

  it('should handle missing end delimiter', () => {
    const input = `---FIELD_EXTRACTION_JSON---
{"fields": [{"identifier": "field1", "value": "value1", "confidence": 0.9}]}`;

    const result = parseFieldExtraction(input);

    // Should recover from truncation
    expect(result).toEqual({
      displayText: '', // JSON removed from display
      extractedFields: { field1: 'value1' },
      success: true,
    });
  });

  it('should handle malformed JSON', () => {
    const input = `---FIELD_EXTRACTION_JSON---
{invalid json}
---END_FIELD_EXTRACTION_JSON---`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: '',
      extractedFields: null,
      success: false,
    });
  });

  it('should handle empty JSON object', () => {
    const input = `---FIELD_EXTRACTION_JSON---
{}
---END_FIELD_EXTRACTION_JSON---`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: '',
      extractedFields: null, // Empty object means no fields extracted
      success: false,
    });
  });

  it('should trim whitespace from JSON block and display text', () => {
    const input = `  Text before
---FIELD_EXTRACTION_JSON---
  {"field1": "value1"}
---END_FIELD_EXTRACTION_JSON---
  Text after  `;

    const result = parseFieldExtraction(input);

    expect(result.extractedFields).toEqual({ field1: 'value1' });
    expect(result.success).toBe(true);
    // beforeContent is trimmed from the start
    expect(result.displayText).toContain('Text before');
  });
});

describe('localStorage utility functions', () => {
  const mockLocalStorage: Record<string, string> = {};
  const testAvatarId = 'test-avatar-123';

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
    });

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  describe('getStoredFieldValues', () => {
    it('should return stored field values', () => {
      const storedValues: FieldValuesStore = {
        brandPurpose: { value: 'To inspire', source: 'manual', timestamp: '2026-01-01T00:00:00.000Z' },
      };

      mockLocalStorage[`v2_field_values_${testAvatarId}`] = JSON.stringify(storedValues);

      const result = getStoredFieldValues(testAvatarId);

      expect(result).toEqual(storedValues);
    });

    it('should return empty object when no values stored', () => {
      const result = getStoredFieldValues(testAvatarId);

      expect(result).toEqual({});
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage[`v2_field_values_${testAvatarId}`] = 'invalid json';

      const result = getStoredFieldValues(testAvatarId);

      expect(result).toEqual({});
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle localStorage access errors', () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
      });

      const result = getStoredFieldValues(testAvatarId);

      expect(result).toEqual({});
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('saveStoredFieldValues', () => {
    it('should save field values to localStorage', () => {
      const values: FieldValuesStore = {
        brandPurpose: { value: 'To inspire', source: 'manual', timestamp: '2026-01-01T00:00:00.000Z' },
      };

      saveStoredFieldValues(testAvatarId, values);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        JSON.stringify(values)
      );
    });

    it('should handle localStorage access errors gracefully', () => {
      vi.stubGlobal('localStorage', {
        setItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
      });

      const values: FieldValuesStore = {
        brandPurpose: { value: 'To inspire', source: 'manual', timestamp: '2026-01-01T00:00:00.000Z' },
      };

      // Should not throw
      expect(() => saveStoredFieldValues(testAvatarId, values)).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('clearStoredFieldValues', () => {
    it('should remove field values from localStorage', () => {
      clearStoredFieldValues(testAvatarId);

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`
      );
    });

    it('should handle localStorage access errors gracefully', () => {
      vi.stubGlobal('localStorage', {
        removeItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
      });

      // Should not throw
      expect(() => clearStoredFieldValues(testAvatarId)).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
