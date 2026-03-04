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

    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(result.current).toHaveProperty('getField');
    expect(result.current).toHaveProperty('clearFields');
  });

  it('should initialize with empty field values', () => {
    const { result } = renderHook(() => useFieldExtraction(testAvatarId));

    expect(result.current.fieldValues).toEqual({});
  });

  it('should initialize with stored field values from localStorage', () => {
    const storedValues: FieldValuesStore = {
      'demographics.age': { value: '25-34', source: 'manual' },
      'demographics.gender': { value: 'Female', source: 'ai' },
    };

    mockLocalStorage[`v2_field_values_${testAvatarId}`] = JSON.stringify(storedValues);

    const { result } = renderHook(() => useFieldExtraction(testAvatarId));

    expect(result.current.fieldValues).toEqual(storedValues);
  });

  describe('extractFields', () => {
    it('should extract fields from AI response with delimiters', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const aiResponse = `Here is some text.
---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34", "demographics.gender": "Female"}
---FIELD_EXTRACTION_JSON---
More text here.`;

      let extractResult;
      act(() => {
        extractResult = result.current.extractFields(aiResponse);
      });

      expect(extractResult).toEqual({
        displayText: 'Here is some text.\n\nMore text here.',
        extractedFields: {
          'demographics.age': '25-34',
          'demographics.gender': 'Female',
        },
        success: true,
      });

      expect(result.current.fieldValues).toEqual({
        'demographics.age': { value: '25-34', source: 'ai' },
        'demographics.gender': { value: 'Female', source: 'ai' },
      });
    });

    it('should return original response when no delimiters found', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const plainResponse = 'Just plain text without extraction.';

      let extractResult;
      act(() => {
        extractResult = result.current.extractFields(plainResponse);
      });

      expect(extractResult).toEqual({
        displayText: plainResponse,
        extractedFields: null,
        success: true,
      });

      expect(result.current.fieldValues).toEqual({});
    });

    it('should not overwrite manual field values with AI values', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // Set a manual value first
      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '35-44',
        source: 'manual',
      });

      // Try to overwrite with AI extraction
      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34", "demographics.gender": "Female"}
---FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      // Manual value should be preserved, new AI value should be added
      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '35-44',
        source: 'manual',
      });
      expect(result.current.fieldValues['demographics.gender']).toEqual({
        value: 'Female',
        source: 'ai',
      });
    });

    it('should overwrite AI field values with new AI values', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // First AI extraction
      const firstResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34"}
---FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(firstResponse);
      });

      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '25-34',
        source: 'ai',
      });

      // Second AI extraction with different value
      const secondResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "35-44"}
---FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(secondResponse);
      });

      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '35-44',
        source: 'ai',
      });
    });

    it('should handle malformed JSON gracefully', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const malformedResponse = `---FIELD_EXTRACTION_JSON---
{invalid json here}
---FIELD_EXTRACTION_JSON---`;

      let extractResult;
      act(() => {
        extractResult = result.current.extractFields(malformedResponse);
      });

      expect(extractResult).toEqual({
        displayText: malformedResponse,
        extractedFields: null,
        success: false,
      });

      expect(console.error).toHaveBeenCalledWith(
        'Failed to parse field extraction JSON:',
        expect.any(Error)
      );
    });

    it('should handle missing end delimiter', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const incompleteResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34"}`;

      let extractResult;
      act(() => {
        extractResult = result.current.extractFields(incompleteResponse);
      });

      expect(extractResult).toEqual({
        displayText: incompleteResponse,
        extractedFields: null,
        success: false,
      });

      expect(console.error).toHaveBeenCalledWith(
        'Field extraction block missing end delimiter'
      );
    });

    it('should save extracted fields to localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34"}
---FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        JSON.stringify({
          'demographics.age': { value: '25-34', source: 'ai' },
        })
      );
    });
  });

  describe('setFieldManual', () => {
    it('should set a field value with manual source', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '35-44',
        source: 'manual',
      });
    });

    it('should overwrite existing AI value with manual value', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // First set AI value
      const aiResponse = `---FIELD_EXTRACTION_JSON---
{"demographics.age": "25-34"}
---FIELD_EXTRACTION_JSON---`;

      act(() => {
        result.current.extractFields(aiResponse);
      });

      expect(result.current.fieldValues['demographics.age'].source).toBe('ai');

      // Overwrite with manual value
      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      expect(result.current.fieldValues['demographics.age']).toEqual({
        value: '35-44',
        source: 'manual',
      });
    });

    it('should save manual field to localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`,
        JSON.stringify({
          'demographics.age': { value: '35-44', source: 'manual' },
        })
      );
    });
  });

  describe('getField', () => {
    it('should return field value if it exists', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      const field = result.current.getField('demographics.age');

      expect(field).toEqual({
        value: '35-44',
        source: 'manual',
      });
    });

    it('should return undefined for non-existent field', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      const field = result.current.getField('nonexistent.field');

      expect(field).toBeUndefined();
    });
  });

  describe('clearFields', () => {
    it('should clear all field values from state', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      // Set some fields
      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
        result.current.setFieldManual('demographics.gender', 'Male');
      });

      expect(Object.keys(result.current.fieldValues).length).toBe(2);

      // Clear fields
      act(() => {
        result.current.clearFields();
      });

      expect(result.current.fieldValues).toEqual({});
    });

    it('should clear field values from localStorage', () => {
      const { result } = renderHook(() => useFieldExtraction(testAvatarId));

      act(() => {
        result.current.setFieldManual('demographics.age', '35-44');
      });

      act(() => {
        result.current.clearFields();
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        `v2_field_values_${testAvatarId}`
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
        result1.current.setFieldManual('demographics.age', '25-34');
        result2.current.setFieldManual('demographics.age', '35-44');
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${avatar1}`,
        expect.any(String)
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        `v2_field_values_${avatar2}`,
        expect.any(String)
      );

      expect(result1.current.fieldValues['demographics.age'].value).toBe('25-34');
      expect(result2.current.fieldValues['demographics.age'].value).toBe('35-44');
    });
  });
});

describe('parseFieldExtraction', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse valid field extraction JSON', () => {
    const input = `Text before
---FIELD_EXTRACTION_JSON---
{"field1": "value1", "field2": "value2"}
---FIELD_EXTRACTION_JSON---
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
{"field1": "value1"}`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: input,
      extractedFields: null,
      success: false,
    });
    expect(console.error).toHaveBeenCalledWith(
      'Field extraction block missing end delimiter'
    );
  });

  it('should handle malformed JSON', () => {
    const input = `---FIELD_EXTRACTION_JSON---
{invalid json}
---FIELD_EXTRACTION_JSON---`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: input,
      extractedFields: null,
      success: false,
    });
    expect(console.error).toHaveBeenCalledWith(
      'Failed to parse field extraction JSON:',
      expect.any(Error)
    );
  });

  it('should handle empty JSON object', () => {
    const input = `---FIELD_EXTRACTION_JSON---
{}
---FIELD_EXTRACTION_JSON---`;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: '',
      extractedFields: {},
      success: true,
    });
  });

  it('should trim whitespace from JSON block and display text', () => {
    const input = `  Text before
---FIELD_EXTRACTION_JSON---
  {"field1": "value1"}
---FIELD_EXTRACTION_JSON---
  Text after  `;

    const result = parseFieldExtraction(input);

    expect(result).toEqual({
      displayText: 'Text before\n\n  Text after',
      extractedFields: {
        field1: 'value1',
      },
      success: true,
    });
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
        'demographics.age': { value: '25-34', source: 'manual' },
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
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load field values from localStorage:',
        expect.any(Error)
      );
    });

    it('should handle localStorage access errors', () => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => {
          throw new Error('localStorage not available');
        }),
      });

      const result = getStoredFieldValues(testAvatarId);

      expect(result).toEqual({});
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load field values from localStorage:',
        expect.any(Error)
      );
    });
  });

  describe('saveStoredFieldValues', () => {
    it('should save field values to localStorage', () => {
      const values: FieldValuesStore = {
        'demographics.age': { value: '25-34', source: 'manual' },
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
        'demographics.age': { value: '25-34', source: 'manual' },
      };

      // Should not throw
      expect(() => saveStoredFieldValues(testAvatarId, values)).not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save field values to localStorage:',
        expect.any(Error)
      );
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

      expect(console.error).toHaveBeenCalledWith(
        'Failed to clear field values from localStorage:',
        expect.any(Error)
      );
    });
  });
});
