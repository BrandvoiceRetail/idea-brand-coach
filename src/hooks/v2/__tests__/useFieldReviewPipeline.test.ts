import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldReviewPipeline } from '../useFieldReviewPipeline';
import type { PendingField } from '../useExtractionQueue';

// ── Mocks ──────────────────────────────────────────────────────────────

const mockEnqueue = vi.fn();
const mockAccept = vi.fn();
const mockReject = vi.fn();
const mockAcceptAll = vi.fn(() => [] as PendingField[]);
const mockClear = vi.fn();
let mockQueue: PendingField[] = [];
let mockIsOpen = false;

vi.mock('@/hooks/v2/useExtractionQueue', () => ({
  useExtractionQueue: () => ({
    queue: mockQueue,
    currentIndex: 0,
    enqueue: mockEnqueue,
    accept: mockAccept,
    reject: mockReject,
    acceptAll: mockAcceptAll,
    clear: mockClear,
    isOpen: mockIsOpen,
  }),
}));

let mockAlwaysAcceptOn = false;
const mockToggle = vi.fn();

vi.mock('@/hooks/v2/useAlwaysAccept', () => ({
  useAlwaysAccept: () => ({
    isOn: mockAlwaysAcceptOn,
    toggle: mockToggle,
    setOn: vi.fn(),
  }),
}));

const mockTriggerFlash = vi.fn();
const mockTriggerBatchFlash = vi.fn();

vi.mock('@/hooks/v2/useScrollOpenFlash', () => ({
  useScrollOpenFlash: () => ({
    triggerFlash: mockTriggerFlash,
    triggerBatchFlash: mockTriggerBatchFlash,
  }),
}));

const mockMessageExtractions = {};
const mockSetMessageExtraction = vi.fn();

vi.mock('@/contexts/ExtractionMetaContext', () => ({
  useExtractionMeta: () => ({
    messageExtractions: mockMessageExtractions,
    setMessageExtraction: mockSetMessageExtraction,
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────────

function makePendingField(overrides: Partial<PendingField> = {}): PendingField {
  return {
    fieldId: 'brandPurpose',
    label: 'Brand Purpose',
    value: 'To inspire creativity',
    confidence: 0.95,
    source: 'user_stated',
    chapterId: 'chapter-01',
    chapterTitle: 'Brand Foundation',
    messageId: 'msg-1',
    ...overrides,
  };
}

function renderPipeline(overrides: Record<string, unknown> = {}): ReturnType<typeof renderHook<ReturnType<typeof useFieldReviewPipeline>>> {
  const mockSetFieldManual = vi.fn();
  const mockSetMobileAccordionOpen = vi.fn();

  return renderHook(() =>
    useFieldReviewPipeline({
      accordionRef: { current: null },
      setFieldManual: (overrides.setFieldManual as typeof mockSetFieldManual) ?? mockSetFieldManual,
      isMobile: (overrides.isMobile as boolean) ?? false,
      setMobileAccordionOpen: (overrides.setMobileAccordionOpen as typeof mockSetMobileAccordionOpen) ?? mockSetMobileAccordionOpen,
    }),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('useFieldReviewPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue = [];
    mockIsOpen = false;
    mockAlwaysAcceptOn = false;
  });

  describe('return shape', () => {
    it('should return all expected fields', () => {
      const { result } = renderPipeline();

      expect(result.current).toHaveProperty('reviewQueue');
      expect(result.current).toHaveProperty('reviewQueueIndex');
      expect(result.current).toHaveProperty('isReviewOpen');
      expect(result.current).toHaveProperty('pendingCount');
      expect(result.current).toHaveProperty('alwaysAccept');
      expect(result.current).toHaveProperty('toggleAlwaysAccept');
      expect(result.current).toHaveProperty('messageExtractions');
      expect(result.current).toHaveProperty('setMessageExtraction');
      expect(result.current).toHaveProperty('enqueueFieldsForReview');
      expect(result.current).toHaveProperty('handleReviewAccept');
      expect(result.current).toHaveProperty('handleReviewReject');
      expect(result.current).toHaveProperty('handleReviewAcceptAll');
      expect(result.current).toHaveProperty('handleReviewClose');
      expect(result.current).toHaveProperty('handleFieldAcceptFromBadge');
      expect(result.current).toHaveProperty('handleAcceptAllFromBadge');
      expect(result.current).toHaveProperty('handleFieldClick');
    });
  });

  describe('enqueueFieldsForReview', () => {
    it('should enqueue to review queue when alwaysAccept is off', () => {
      mockAlwaysAcceptOn = false;
      const { result } = renderPipeline();
      const fields = [makePendingField()];

      act(() => result.current.enqueueFieldsForReview(fields));

      expect(mockEnqueue).toHaveBeenCalledWith(fields);
      expect(mockTriggerBatchFlash).not.toHaveBeenCalled();
    });

    it('should auto-accept and flash when alwaysAccept is on', () => {
      mockAlwaysAcceptOn = true;
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });
      const fields = [
        makePendingField({ fieldId: 'brandPurpose', value: 'Purpose A' }),
        makePendingField({ fieldId: 'brandVision', value: 'Vision B' }),
      ];

      act(() => result.current.enqueueFieldsForReview(fields));

      expect(mockSetField).toHaveBeenCalledTimes(2);
      expect(mockSetField).toHaveBeenCalledWith('brandPurpose', 'Purpose A');
      expect(mockSetField).toHaveBeenCalledWith('brandVision', 'Vision B');
      expect(mockTriggerBatchFlash).toHaveBeenCalledWith(['brandPurpose', 'brandVision']);
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('should not flash when auto-accepting empty array', () => {
      mockAlwaysAcceptOn = true;
      const { result } = renderPipeline();

      act(() => result.current.enqueueFieldsForReview([]));

      expect(mockTriggerBatchFlash).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewAccept', () => {
    it('should persist field, remove from queue, and flash', () => {
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });

      act(() => result.current.handleReviewAccept('brandPurpose', 'My purpose'));

      expect(mockSetField).toHaveBeenCalledWith('brandPurpose', 'My purpose');
      expect(mockAccept).toHaveBeenCalledWith('brandPurpose');
      expect(mockTriggerFlash).toHaveBeenCalledWith('brandPurpose');
    });
  });

  describe('handleReviewReject', () => {
    it('should remove from queue without persisting', () => {
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });

      act(() => result.current.handleReviewReject('brandPurpose'));

      expect(mockReject).toHaveBeenCalledWith('brandPurpose');
      expect(mockSetField).not.toHaveBeenCalled();
      expect(mockTriggerFlash).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewAcceptAll', () => {
    it('should accept all, persist each, and batch flash', () => {
      const accepted = [
        makePendingField({ fieldId: 'f1', value: 'v1' }),
        makePendingField({ fieldId: 'f2', value: 'v2' }),
      ];
      mockAcceptAll.mockReturnValueOnce(accepted);
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });

      act(() => result.current.handleReviewAcceptAll());

      expect(mockAcceptAll).toHaveBeenCalled();
      expect(mockSetField).toHaveBeenCalledWith('f1', 'v1');
      expect(mockSetField).toHaveBeenCalledWith('f2', 'v2');
      expect(mockTriggerBatchFlash).toHaveBeenCalledWith(['f1', 'f2']);
    });

    it('should not flash when acceptAll returns empty', () => {
      mockAcceptAll.mockReturnValueOnce([]);
      const { result } = renderPipeline();

      act(() => result.current.handleReviewAcceptAll());

      expect(mockTriggerBatchFlash).not.toHaveBeenCalled();
    });
  });

  describe('handleReviewClose', () => {
    it('should clear the queue', () => {
      const { result } = renderPipeline();

      act(() => result.current.handleReviewClose());

      expect(mockClear).toHaveBeenCalled();
    });
  });

  describe('handleFieldAcceptFromBadge', () => {
    it('should persist and flash a single field', () => {
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });

      act(() => result.current.handleFieldAcceptFromBadge('brandVision', 'New vision'));

      expect(mockSetField).toHaveBeenCalledWith('brandVision', 'New vision');
      expect(mockTriggerFlash).toHaveBeenCalledWith('brandVision');
    });
  });

  describe('handleAcceptAllFromBadge', () => {
    it('should persist all and batch flash', () => {
      const mockSetField = vi.fn();
      const { result } = renderPipeline({ setFieldManual: mockSetField });

      act(() => result.current.handleAcceptAllFromBadge({
        brandPurpose: 'Purpose',
        brandVision: 'Vision',
      }));

      expect(mockSetField).toHaveBeenCalledWith('brandPurpose', 'Purpose');
      expect(mockSetField).toHaveBeenCalledWith('brandVision', 'Vision');
      expect(mockTriggerBatchFlash).toHaveBeenCalledWith(['brandPurpose', 'brandVision']);
    });
  });

  describe('handleFieldClick', () => {
    it('should trigger flash immediately on desktop', () => {
      const { result } = renderPipeline({ isMobile: false });

      act(() => result.current.handleFieldClick({ fieldId: 'brandPurpose' }));

      expect(mockTriggerFlash).toHaveBeenCalledWith('brandPurpose');
    });

    it('should open mobile sheet and delay flash on mobile', () => {
      vi.useFakeTimers();
      const mockSetMobileOpen = vi.fn();
      const { result } = renderPipeline({ isMobile: true, setMobileAccordionOpen: mockSetMobileOpen });

      act(() => result.current.handleFieldClick({ fieldId: 'brandPurpose' }));

      expect(mockSetMobileOpen).toHaveBeenCalledWith(true);
      expect(mockTriggerFlash).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(400); });

      expect(mockTriggerFlash).toHaveBeenCalledWith('brandPurpose');
      vi.useRealTimers();
    });
  });

  describe('derived state', () => {
    it('should compute pendingCount from queue length', () => {
      mockQueue = [makePendingField(), makePendingField({ fieldId: 'brandVision' })];
      const { result } = renderPipeline();

      expect(result.current.pendingCount).toBe(2);
    });

    it('should expose alwaysAccept from hook', () => {
      mockAlwaysAcceptOn = true;
      const { result } = renderPipeline();

      expect(result.current.alwaysAccept).toBe(true);
    });
  });
});
