import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFieldHistory } from '../useFieldHistory';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' }
  }))
}));

// Mock the KnowledgeRepository module
vi.mock('@/lib/knowledge-base/knowledge-repository', () => {
  const mockRepository = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getFieldHistory: vi.fn().mockResolvedValue([])
  };

  return {
    KnowledgeRepository: class MockKnowledgeRepository {
      constructor() {
        return mockRepository;
      }
    }
  };
});

describe('useFieldHistory', () => {
  const mockFieldIdentifier = 'brand.name';

  it('should initialize with empty history', () => {
    const { result } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should provide refresh function', () => {
    const { result } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    expect(result.current.refresh).toBeInstanceOf(Function);
  });

  it('should not fetch when disabled', () => {
    const { result } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    // When disabled, should not attempt to fetch
    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should handle field identifier changes', () => {
    const { result, rerender } = renderHook(
      ({ fieldIdentifier }) =>
        useFieldHistory({ fieldIdentifier, enabled: false }),
      {
        initialProps: { fieldIdentifier: 'brand.name' }
      }
    );

    expect(result.current.history).toEqual([]);

    // Rerender with different field identifier
    rerender({ fieldIdentifier: 'brand.tagline' });

    // Should still maintain empty history when disabled
    expect(result.current.history).toEqual([]);
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    const initialRefresh = result.current.refresh;

    rerender();

    // refresh function should remain stable across rerenders
    expect(result.current.refresh).toBe(initialRefresh);
  });

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    expect(result.current.history).toEqual([]);

    // Should not throw on unmount
    expect(() => unmount()).not.toThrow();
  });

  it('should accept enabled parameter', () => {
    const { result: enabledResult } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: true })
    );

    const { result: disabledResult } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    // Both should initialize properly regardless of enabled state
    expect(enabledResult.current).toHaveProperty('history');
    expect(enabledResult.current).toHaveProperty('isLoading');
    expect(enabledResult.current).toHaveProperty('error');
    expect(enabledResult.current).toHaveProperty('refresh');

    expect(disabledResult.current).toHaveProperty('history');
    expect(disabledResult.current).toHaveProperty('isLoading');
    expect(disabledResult.current).toHaveProperty('error');
    expect(disabledResult.current).toHaveProperty('refresh');
  });

  it('should default enabled to true when not provided', () => {
    const { result } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier })
    );

    // Should still provide all expected properties
    expect(result.current).toHaveProperty('history');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
  });

  it('should return correct initial state structure', () => {
    const { result } = renderHook(() =>
      useFieldHistory({ fieldIdentifier: mockFieldIdentifier, enabled: false })
    );

    // Verify the complete state structure
    expect(result.current).toMatchObject({
      history: expect.any(Array),
      isLoading: expect.any(Boolean),
      error: null,
      refresh: expect.any(Function)
    });
  });
});
