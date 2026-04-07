/**
 * Tests for useRejectionMessages hook
 *
 * Verifies rejection tracking, message generation, flushing, and clearing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRejectionMessages, buildRejectionMessageContent } from '../useRejectionMessages';

describe('buildRejectionMessageContent', () => {
  it('should return empty string for empty labels', () => {
    expect(buildRejectionMessageContent([])).toBe('');
  });

  it('should format a single field rejection', () => {
    const result = buildRejectionMessageContent(['Brand Name']);
    expect(result).toBe(
      "Got it, I won't use that for **Brand Name**. What would you like instead?",
    );
  });

  it('should format two field rejections with "and"', () => {
    const result = buildRejectionMessageContent(['Brand Name', 'Mission']);
    expect(result).toBe(
      "Got it, I won't use those for **Brand Name** and **Mission**. What would you like instead?",
    );
  });

  it('should format three or more field rejections with commas and "and"', () => {
    const result = buildRejectionMessageContent(['Brand Name', 'Mission', 'Core Values']);
    expect(result).toBe(
      "Got it, I won't use those for **Brand Name**, **Mission** and **Core Values**. What would you like instead?",
    );
  });

  it('should handle four fields correctly', () => {
    const result = buildRejectionMessageContent(['A', 'B', 'C', 'D']);
    expect(result).toBe(
      "Got it, I won't use those for **A**, **B**, **C** and **D**. What would you like instead?",
    );
  });
});

describe('useRejectionMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with empty rejection messages', () => {
    const { result } = renderHook(() => useRejectionMessages());

    expect(result.current.rejectionMessages).toEqual([]);
    expect(result.current.pendingRejectionCount).toBe(0);
  });

  it('should track a rejection without immediately creating a message', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });

    // No message created yet — only pending
    expect(result.current.rejectionMessages).toEqual([]);
  });

  it('should flush tracked rejections into a single message', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
      result.current.trackRejection('mission', 'Mission');
    });

    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toHaveLength(1);
    const msg = result.current.rejectionMessages[0];
    expect(msg.content).toContain('**Brand Name**');
    expect(msg.content).toContain('**Mission**');
    expect(msg.content).toContain("won't use those");
    expect(msg.content).toContain('What would you like instead?');
    expect(msg.id).toMatch(/^rejection-/);
    expect(msg.created_at).toBeDefined();
  });

  it('should not create a message when flushing with no pending rejections', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toEqual([]);
  });

  it('should deduplicate rejections for the same field in a batch', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
      result.current.trackRejection('brandName', 'Brand Name');
    });

    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toHaveLength(1);
    // The content should mention Brand Name only once
    const occurrences = result.current.rejectionMessages[0].content
      .split('**Brand Name**').length - 1;
    expect(occurrences).toBe(1);
  });

  it('should accumulate messages across multiple flush cycles', () => {
    const { result } = renderHook(() => useRejectionMessages());

    // First batch
    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });
    act(() => {
      result.current.flushRejections();
    });

    // Second batch
    act(() => {
      result.current.trackRejection('mission', 'Mission');
    });
    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toHaveLength(2);
    expect(result.current.rejectionMessages[0].content).toContain('Brand Name');
    expect(result.current.rejectionMessages[1].content).toContain('Mission');
  });

  it('should clear all rejection messages', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });
    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toHaveLength(1);

    act(() => {
      result.current.clearRejectionMessages();
    });

    expect(result.current.rejectionMessages).toEqual([]);
  });

  it('should clear pending rejections on clearRejectionMessages', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });

    act(() => {
      result.current.clearRejectionMessages();
    });

    // Flushing after clear should produce no message
    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages).toEqual([]);
  });

  it('should generate unique IDs for each flushed message', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });
    act(() => {
      result.current.flushRejections();
    });

    act(() => {
      result.current.trackRejection('mission', 'Mission');
    });
    act(() => {
      result.current.flushRejections();
    });

    const ids = result.current.rejectionMessages.map((m) => m.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('should use singular phrasing for single field rejection', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
    });
    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages[0].content).toContain("won't use that for");
  });

  it('should use plural phrasing for multiple field rejections', () => {
    const { result } = renderHook(() => useRejectionMessages());

    act(() => {
      result.current.trackRejection('brandName', 'Brand Name');
      result.current.trackRejection('mission', 'Mission');
    });
    act(() => {
      result.current.flushRejections();
    });

    expect(result.current.rejectionMessages[0].content).toContain("won't use those for");
  });
});
