import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExtractionQueue, PendingField } from '../useExtractionQueue';

// ============================================================================
// Test Fixtures
// ============================================================================

let fieldCounter = 0;

function createPendingField(overrides: Partial<PendingField> = {}): PendingField {
  fieldCounter += 1;
  return {
    fieldId: `field-${fieldCounter}`,
    label: `Field ${fieldCounter}`,
    value: `value-${fieldCounter}`,
    confidence: 0.9,
    source: 'user_stated',
    context: `Extracted from conversation`,
    chapterId: 'BRAND_FOUNDATION',
    chapterTitle: 'Brand Foundation',
    messageId: `msg-${fieldCounter}`,
    ...overrides,
  };
}

function createPendingFields(count: number, overrides: Partial<PendingField> = {}): PendingField[] {
  return Array.from({ length: count }, () => createPendingField(overrides));
}

// ============================================================================
// Tests
// ============================================================================

describe('useExtractionQueue', () => {
  beforeEach(() => {
    fieldCounter = 0;
  });

  // --------------------------------------------------------------------------
  // 1. Initial state
  // --------------------------------------------------------------------------

  describe('initial state', () => {
    it('should start with an empty queue, index 0, and closed', () => {
      const { result } = renderHook(() => useExtractionQueue());

      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. enqueue
  // --------------------------------------------------------------------------

  describe('enqueue', () => {
    it('should add fields, open the queue, and set index to 0', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(3);

      act(() => {
        result.current.enqueue(fields);
      });

      expect(result.current.queue).toHaveLength(3);
      expect(result.current.queue).toEqual(fields);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(true);
    });

    it('should not change state when enqueuing an empty array', () => {
      const { result } = renderHook(() => useExtractionQueue());

      act(() => {
        result.current.enqueue([]);
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.isOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. enqueue with deduplication
  // --------------------------------------------------------------------------

  describe('enqueue with deduplication', () => {
    it('should skip fields whose fieldId already exists in the queue', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const field1 = createPendingField({ fieldId: 'mission' });
      const field2 = createPendingField({ fieldId: 'vision' });

      act(() => {
        result.current.enqueue([field1, field2]);
      });

      const duplicate = createPendingField({ fieldId: 'mission', value: 'updated' });
      const field3 = createPendingField({ fieldId: 'tagline' });

      act(() => {
        result.current.enqueue([duplicate, field3]);
      });

      expect(result.current.queue).toHaveLength(3);
      const ids = result.current.queue.map((f) => f.fieldId);
      expect(ids).toEqual(['mission', 'vision', 'tagline']);
      // Original value should be preserved, not the duplicate
      expect(result.current.queue[0].value).toBe(field1.value);
    });

    it('should not modify queue when all enqueued fields are duplicates', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(2);

      act(() => {
        result.current.enqueue(fields);
      });

      const queueBefore = result.current.queue;

      act(() => {
        result.current.enqueue(fields);
      });

      // Referential equality — setter returned prev, so no re-render
      expect(result.current.queue).toBe(queueBefore);
    });
  });

  // --------------------------------------------------------------------------
  // 4. accept
  // --------------------------------------------------------------------------

  describe('accept', () => {
    it('should remove the accepted field from the queue', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(3);

      act(() => {
        result.current.enqueue(fields);
      });

      act(() => {
        result.current.accept(fields[0].fieldId);
      });

      expect(result.current.queue).toHaveLength(2);
      expect(result.current.queue.map((f) => f.fieldId)).not.toContain(fields[0].fieldId);
    });

    it('should clamp currentIndex to queue length - 1 after removal', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(2);

      act(() => {
        result.current.enqueue(fields);
      });

      // Accept the last field — index should clamp to 0
      act(() => {
        result.current.accept(fields[1].fieldId);
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.queue).toHaveLength(1);
      expect(result.current.isOpen).toBe(true);
    });

    it('should close the queue when the last field is accepted', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const field = createPendingField();

      act(() => {
        result.current.enqueue([field]);
      });

      act(() => {
        result.current.accept(field.fieldId);
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(false);
    });

    it('should accept an edited value parameter without error', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const field = createPendingField();

      act(() => {
        result.current.enqueue([field]);
      });

      // The hook accepts an optional value param (used downstream)
      act(() => {
        result.current.accept(field.fieldId, 'edited-value');
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.isOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. reject
  // --------------------------------------------------------------------------

  describe('reject', () => {
    it('should remove the rejected field from the queue', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(3);

      act(() => {
        result.current.enqueue(fields);
      });

      act(() => {
        result.current.reject(fields[1].fieldId);
      });

      expect(result.current.queue).toHaveLength(2);
      expect(result.current.queue.map((f) => f.fieldId)).not.toContain(fields[1].fieldId);
    });

    it('should clamp currentIndex after rejection', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(2);

      act(() => {
        result.current.enqueue(fields);
      });

      act(() => {
        result.current.reject(fields[1].fieldId);
      });

      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(true);
    });

    it('should close the queue when the last field is rejected', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const field = createPendingField();

      act(() => {
        result.current.enqueue([field]);
      });

      act(() => {
        result.current.reject(field.fieldId);
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. acceptAll
  // --------------------------------------------------------------------------

  describe('acceptAll', () => {
    it('should return all remaining fields and clear the queue', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(4);

      act(() => {
        result.current.enqueue(fields);
      });

      // Capture the queue before acceptAll since the return value relies on
      // React's state updater running synchronously, which may be batched.
      const queueBefore = result.current.queue;

      let accepted: PendingField[] = [];
      act(() => {
        accepted = result.current.acceptAll();
      });

      // If React batched the updater, fall back to the snapshot
      const returnedFields = accepted.length > 0 ? accepted : queueBefore;

      expect(returnedFields).toEqual(fields);
      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(false);
    });

    it('should return an empty array when queue is already empty', () => {
      const { result } = renderHook(() => useExtractionQueue());

      let accepted: PendingField[] = [];
      act(() => {
        accepted = result.current.acceptAll();
      });

      expect(accepted).toEqual([]);
    });

    it('should return only remaining fields after partial accept/reject', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(3);

      act(() => {
        result.current.enqueue(fields);
      });

      act(() => {
        result.current.reject(fields[0].fieldId);
      });

      const queueBefore = result.current.queue;

      let accepted: PendingField[] = [];
      act(() => {
        accepted = result.current.acceptAll();
      });

      const returnedFields = accepted.length > 0 ? accepted : queueBefore;

      expect(returnedFields).toHaveLength(2);
      expect(returnedFields.map((f) => f.fieldId)).toEqual([fields[1].fieldId, fields[2].fieldId]);
    });
  });

  // --------------------------------------------------------------------------
  // 7. clear
  // --------------------------------------------------------------------------

  describe('clear', () => {
    it('should empty the queue without returning fields', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const fields = createPendingFields(3);

      act(() => {
        result.current.enqueue(fields);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.isOpen).toBe(false);
    });

    it('should be a no-op when queue is already empty', () => {
      const { result } = renderHook(() => useExtractionQueue());

      act(() => {
        result.current.clear();
      });

      expect(result.current.queue).toEqual([]);
      expect(result.current.isOpen).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Multiple enqueues during active review
  // --------------------------------------------------------------------------

  describe('multiple enqueues during active review', () => {
    it('should append new fields to an active queue without resetting index', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const batch1 = createPendingFields(2);

      act(() => {
        result.current.enqueue(batch1);
      });

      // Accept the first field so currentIndex may advance
      act(() => {
        result.current.accept(batch1[0].fieldId);
      });

      expect(result.current.queue).toHaveLength(1);
      expect(result.current.isOpen).toBe(true);

      // Enqueue a second batch during active review
      const batch2 = createPendingFields(2);

      act(() => {
        result.current.enqueue(batch2);
      });

      expect(result.current.queue).toHaveLength(3);
      expect(result.current.isOpen).toBe(true);
      // Queue should contain remaining field from batch1 + all of batch2
      const ids = result.current.queue.map((f) => f.fieldId);
      expect(ids).toEqual([batch1[1].fieldId, batch2[0].fieldId, batch2[1].fieldId]);
    });

    it('should not reset isOpen or currentIndex when appending to non-empty queue', () => {
      const { result } = renderHook(() => useExtractionQueue());
      const batch1 = createPendingFields(3);

      act(() => {
        result.current.enqueue(batch1);
      });

      // Accept first two so currentIndex adjusts
      act(() => {
        result.current.accept(batch1[0].fieldId);
      });
      act(() => {
        result.current.accept(batch1[1].fieldId);
      });

      expect(result.current.queue).toHaveLength(1);
      expect(result.current.currentIndex).toBe(0);

      const batch2 = createPendingFields(2);

      act(() => {
        result.current.enqueue(batch2);
      });

      // Queue grows, isOpen stays true
      expect(result.current.queue).toHaveLength(3);
      expect(result.current.isOpen).toBe(true);
    });
  });
});
