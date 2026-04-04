import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollOpenFlash } from '../useScrollOpenFlash';
import type { ChapterAccordionHandle } from '@/components/v2/ChapterSectionAccordion';

function createMockHandle(): ChapterAccordionHandle {
  return {
    focusField: vi.fn(),
    flashField: vi.fn(),
    focusChapter: vi.fn(),
  };
}

function createRef(
  handle: ChapterAccordionHandle | null
): React.RefObject<ChapterAccordionHandle> {
  return { current: handle } as React.RefObject<ChapterAccordionHandle>;
}

describe('useScrollOpenFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('triggerFlash', () => {
    it('should call focusField immediately then flashField after 300ms', () => {
      const handle = createMockHandle();
      const ref = createRef(handle);

      const { result } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      act(() => {
        result.current.triggerFlash('brand-purpose');
      });

      // focusField called immediately
      expect(handle.focusField).toHaveBeenCalledWith('brand-purpose');
      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // flashField not called yet
      expect(handle.flashField).not.toHaveBeenCalled();

      // Advance 300ms
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(handle.flashField).toHaveBeenCalledWith('brand-purpose');
      expect(handle.flashField).toHaveBeenCalledTimes(1);
    });

    it('should no-op gracefully when ref is null', () => {
      const ref = createRef(null);

      const { result } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      // Should not throw
      act(() => {
        result.current.triggerFlash('brand-purpose');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Nothing to assert on the handle since it's null;
      // the test passes if no error is thrown
    });
  });

  describe('triggerBatchFlash', () => {
    it('should call triggerFlash for each field with default 200ms stagger', () => {
      const handle = createMockHandle();
      const ref = createRef(handle);

      const { result } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      act(() => {
        result.current.triggerBatchFlash(['field-a', 'field-b', 'field-c']);
      });

      // First field scheduled at 0ms delay -- flush it
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(handle.focusField).toHaveBeenCalledWith('field-a');
      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // Advance 200ms: second field fires
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(handle.focusField).toHaveBeenCalledWith('field-b');
      expect(handle.focusField).toHaveBeenCalledTimes(2);

      // Advance another 200ms: third field fires
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(handle.focusField).toHaveBeenCalledWith('field-c');
      expect(handle.focusField).toHaveBeenCalledTimes(3);

      // Advance 300ms more to flush all flashField timers
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(handle.flashField).toHaveBeenCalledTimes(3);
      expect(handle.flashField).toHaveBeenCalledWith('field-a');
      expect(handle.flashField).toHaveBeenCalledWith('field-b');
      expect(handle.flashField).toHaveBeenCalledWith('field-c');
    });

    it('should respect custom stagger interval', () => {
      const handle = createMockHandle();
      const ref = createRef(handle);

      const { result } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      act(() => {
        result.current.triggerBatchFlash(['field-a', 'field-b'], 500);
      });

      // First field scheduled at 0ms delay -- flush it
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(handle.focusField).toHaveBeenCalledWith('field-a');
      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // At 200ms the second field should NOT have fired yet
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // At 500ms the second field fires
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(handle.focusField).toHaveBeenCalledWith('field-b');
      expect(handle.focusField).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should clear timers on unmount', () => {
      const handle = createMockHandle();
      const ref = createRef(handle);

      const { result, unmount } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      act(() => {
        result.current.triggerFlash('field-a');
      });

      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // Unmount before the 300ms flashField timer fires
      unmount();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // flashField should never have been called because timer was cleared
      expect(handle.flashField).not.toHaveBeenCalled();
    });

    it('should clear previous batch timers when a new batch is triggered', () => {
      const handle = createMockHandle();
      const ref = createRef(handle);

      const { result } = renderHook(() =>
        useScrollOpenFlash({ accordionRef: ref })
      );

      // Start first batch
      act(() => {
        result.current.triggerBatchFlash(['old-a', 'old-b', 'old-c']);
      });

      // First field of batch 1 scheduled at 0ms -- flush it
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(handle.focusField).toHaveBeenCalledWith('old-a');
      expect(handle.focusField).toHaveBeenCalledTimes(1);

      // Before batch 1 completes, start a new batch (clears old timers)
      act(() => {
        result.current.triggerBatchFlash(['new-x', 'new-y']);
      });

      // Flush the 0ms timer for new-x
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(handle.focusField).toHaveBeenCalledWith('new-x');

      // Advance past where old-b (200ms) and old-c (400ms) would have fired
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // old-b and old-c should NOT have been called (timers cleared)
      expect(handle.focusField).not.toHaveBeenCalledWith('old-b');
      expect(handle.focusField).not.toHaveBeenCalledWith('old-c');

      // new-y should have fired at 200ms
      expect(handle.focusField).toHaveBeenCalledWith('new-y');
    });
  });
});
