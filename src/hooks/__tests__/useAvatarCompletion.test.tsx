import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAvatarCompletion, getCompletionLabel, getCompletionVariant } from '../useAvatarCompletion';
import { usePersistedField } from '../usePersistedField';
import type { SyncStatus } from '@/lib/knowledge-base/interfaces';

// Mock usePersistedField hook
vi.mock('../usePersistedField');

// Type for mocked field return value
interface MockPersistedFieldReturn {
  value: string;
  onChange: (value: string) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

describe('useAvatarCompletion', () => {
  // Helper to create mock field return value
  const createMockField = (value: string): MockPersistedFieldReturn => ({
    value,
    onChange: vi.fn(),
    syncStatus: 'synced',
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Avatar', () => {
    beforeEach(() => {
      // Mock all fields as empty
      vi.mocked(usePersistedField).mockReturnValue(createMockField(''));
    });

    it('should return 0% completion when all fields are empty', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.percentage).toBe(0);
      expect(result.current.filledFields).toBe(0);
      expect(result.current.totalFields).toBe(14);
    });

    it('should return 0% for all sections when empty', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.sectionCompletions?.demographics).toBe(0);
      expect(result.current.sectionCompletions?.psychographics).toBe(0);
      expect(result.current.sectionCompletions?.behavior).toBe(0);
      expect(result.current.sectionCompletions?.voice).toBe(0);
    });
  });

  describe('Partial Completion - Demographics', () => {
    beforeEach(() => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          'John Smith',     // avatar_name
          '35-44',          // age
          '',               // income (empty)
          '',               // location (empty)
          '',               // lifestyle (empty)
          '[]',             // values (empty array)
          '[]',             // fears (empty array)
          '[]',             // desires (empty array)
          '[]',             // triggers (empty array)
          '',               // intent (empty)
          '[]',             // decisionFactors (empty array)
          '',               // shoppingStyle (empty)
          '',               // priceConsciousness (empty)
          '',               // voiceOfCustomer (empty)
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });
    });

    it('should calculate partial demographics completion', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 2 out of 5 demographics fields filled (name, age)
      expect(result.current.sectionCompletions?.demographics).toBe(40);
    });

    it('should calculate overall completion correctly', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 2 out of 14 total fields filled
      expect(result.current.percentage).toBe(14); // Rounded from 14.28%
      expect(result.current.filledFields).toBe(2);
      expect(result.current.totalFields).toBe(14);
    });
  });

  describe('Partial Completion - Psychographics', () => {
    beforeEach(() => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '',                        // avatar_name (empty)
          '',                        // age (empty)
          '',                        // income (empty)
          '',                        // location (empty)
          '',                        // lifestyle (empty)
          '["Honesty", "Family"]',   // values (filled)
          '["Failure"]',             // fears (filled)
          '[]',                      // desires (empty array)
          '[]',                      // triggers (empty array)
          '',                        // intent (empty)
          '[]',                      // decisionFactors (empty array)
          '',                        // shoppingStyle (empty)
          '',                        // priceConsciousness (empty)
          '',                        // voiceOfCustomer (empty)
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });
    });

    it('should calculate partial psychographics completion', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 2 out of 4 psychographics fields filled (values, fears)
      expect(result.current.sectionCompletions?.psychographics).toBe(50);
    });

    it('should count non-empty arrays correctly', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.filledFields).toBe(2);
      expect(result.current.percentage).toBe(14); // 2/14 ≈ 14%
    });
  });

  describe('Partial Completion - Behavior', () => {
    beforeEach(() => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '',                       // avatar_name (empty)
          '',                       // age (empty)
          '',                       // income (empty)
          '',                       // location (empty)
          '',                       // lifestyle (empty)
          '[]',                     // values (empty array)
          '[]',                     // fears (empty array)
          '[]',                     // desires (empty array)
          '[]',                     // triggers (empty array)
          'Research-driven',        // intent (filled)
          '["Price", "Quality"]',   // decisionFactors (filled)
          'Methodical',             // shoppingStyle (filled)
          '',                       // priceConsciousness (empty)
          '',                       // voiceOfCustomer (empty)
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });
    });

    it('should calculate partial behavior completion', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 3 out of 4 behavior fields filled
      expect(result.current.sectionCompletions?.behavior).toBe(75);
    });

    it('should calculate overall completion correctly', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 3 out of 14 total fields filled
      expect(result.current.percentage).toBe(21); // 3/14 ≈ 21%
      expect(result.current.filledFields).toBe(3);
    });
  });

  describe('Partial Completion - Voice', () => {
    beforeEach(() => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '',              // avatar_name (empty)
          '',              // age (empty)
          '',              // income (empty)
          '',              // location (empty)
          '',              // lifestyle (empty)
          '[]',            // values (empty array)
          '[]',            // fears (empty array)
          '[]',            // desires (empty array)
          '[]',            // triggers (empty array)
          '',              // intent (empty)
          '[]',            // decisionFactors (empty array)
          '',              // shoppingStyle (empty)
          '',              // priceConsciousness (empty)
          'Great product!', // voiceOfCustomer (filled)
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });
    });

    it('should calculate voice completion', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 1 out of 1 voice field filled
      expect(result.current.sectionCompletions?.voice).toBe(100);
    });

    it('should calculate overall completion correctly', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      // 1 out of 14 total fields filled
      expect(result.current.percentage).toBe(7); // 1/14 ≈ 7%
      expect(result.current.filledFields).toBe(1);
    });
  });

  describe('Full Completion', () => {
    beforeEach(() => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          'Sarah Johnson',                     // avatar_name
          '35-44',                             // age
          '$75,000-$100,000',                  // income
          'Austin, TX',                        // location
          'Active, Health-conscious',          // lifestyle
          '["Sustainability", "Quality"]',     // values
          '["Waste", "Low quality"]',          // fears
          '["Eco-friendly products"]',         // desires
          '["Environmental impact"]',          // triggers
          'Problem-solving',                   // intent
          '["Sustainability", "Reviews"]',     // decisionFactors
          'Methodical researcher',             // shoppingStyle
          'Value-focused',                     // priceConsciousness
          'I love products that last!',        // voiceOfCustomer
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });
    });

    it('should return 100% completion when all fields are filled', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.percentage).toBe(100);
      expect(result.current.filledFields).toBe(14);
      expect(result.current.totalFields).toBe(14);
    });

    it('should return 100% for all sections when complete', () => {
      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.sectionCompletions?.demographics).toBe(100);
      expect(result.current.sectionCompletions?.psychographics).toBe(100);
      expect(result.current.sectionCompletions?.behavior).toBe(100);
      expect(result.current.sectionCompletions?.voice).toBe(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only values as empty', () => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '   ',  // whitespace-only (should be empty)
          '',     // all other fields empty
          '', '', '', '[]', '[]', '[]', '[]', '', '[]', '', '', '',
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });

      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.filledFields).toBe(0);
      expect(result.current.percentage).toBe(0);
    });

    it('should handle malformed JSON arrays as empty', () => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '',              // avatar_name
          '',              // age
          '',              // income
          '',              // location
          '',              // lifestyle
          '[invalid json', // malformed JSON (should be empty)
          '[]',            // fears
          '[]',            // desires
          '[]',            // triggers
          '',              // intent
          '[]',            // decisionFactors
          '',              // shoppingStyle
          '',              // priceConsciousness
          '',              // voiceOfCustomer
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });

      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.filledFields).toBe(0);
      expect(result.current.percentage).toBe(0);
    });

    it('should handle empty JSON arrays as empty', () => {
      let callIndex = 0;
      vi.mocked(usePersistedField).mockImplementation(() => {
        const fields = [
          '',    // avatar_name
          '',    // age
          '',    // income
          '',    // location
          '',    // lifestyle
          '[]',  // empty array (should be empty)
          '[]',  // fears
          '[]',  // desires
          '[]',  // triggers
          '',    // intent
          '[]',  // decisionFactors
          '',    // shoppingStyle
          '',    // priceConsciousness
          '',    // voiceOfCustomer
        ];
        const value = fields[callIndex++];
        return createMockField(value);
      });

      const { result } = renderHook(() => useAvatarCompletion());

      expect(result.current.filledFields).toBe(0);
      expect(result.current.percentage).toBe(0);
    });
  });

  describe('Helper Functions', () => {
    describe('getCompletionLabel', () => {
      it('should return correct labels for different percentages', () => {
        expect(getCompletionLabel(0)).toBe('Not Started');
        expect(getCompletionLabel(10)).toBe('Just Started');
        expect(getCompletionLabel(30)).toBe('Getting Started');
        expect(getCompletionLabel(50)).toBe('In Progress');
        expect(getCompletionLabel(75)).toBe('Almost Done');
        expect(getCompletionLabel(100)).toBe('Complete');
      });
    });

    describe('getCompletionVariant', () => {
      it('should return correct variants for different percentages', () => {
        expect(getCompletionVariant(0)).toBe('outline');
        expect(getCompletionVariant(25)).toBe('outline');
        expect(getCompletionVariant(50)).toBe('secondary');
        expect(getCompletionVariant(75)).toBe('secondary');
        expect(getCompletionVariant(100)).toBe('default');
      });
    });
  });
});
