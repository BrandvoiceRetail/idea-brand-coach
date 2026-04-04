/**
 * useAlwaysAccept Hook Tests
 *
 * Tests for the localStorage-backed boolean preference hook
 * that controls auto-accept behavior for AI-extracted fields.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlwaysAccept } from '../useAlwaysAccept';

const STORAGE_KEY = 'always-accept-extractions';

describe('useAlwaysAccept', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Initial state
  // --------------------------------------------------------------------------

  it('should default isOn to false when localStorage is empty', () => {
    const { result } = renderHook(() => useAlwaysAccept());

    expect(result.current.isOn).toBe(false);
  });

  it('should read true from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'true');

    const { result } = renderHook(() => useAlwaysAccept());

    expect(result.current.isOn).toBe(true);
  });

  it('should read false from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'false');

    const { result } = renderHook(() => useAlwaysAccept());

    expect(result.current.isOn).toBe(false);
  });

  it('should treat non-"true" localStorage values as false', () => {
    localStorage.setItem(STORAGE_KEY, 'yes');

    const { result } = renderHook(() => useAlwaysAccept());

    expect(result.current.isOn).toBe(false);
  });

  // --------------------------------------------------------------------------
  // toggle
  // --------------------------------------------------------------------------

  it('should flip false to true when toggled', () => {
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOn).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('should flip true to false when toggled', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isOn).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('should toggle back and forth multiple times', () => {
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOn).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOn).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOn).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  // --------------------------------------------------------------------------
  // setOn
  // --------------------------------------------------------------------------

  it('should set isOn to true via setOn and persist', () => {
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.setOn(true);
    });

    expect(result.current.isOn).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('should set isOn to false via setOn and persist', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.setOn(false);
    });

    expect(result.current.isOn).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('should handle setting the same value (no-op state change)', () => {
    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.setOn(false);
    });

    expect(result.current.isOn).toBe(false);
  });

  // --------------------------------------------------------------------------
  // localStorage error handling
  // --------------------------------------------------------------------------

  it('should default to false when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    const { result } = renderHook(() => useAlwaysAccept());

    expect(result.current.isOn).toBe(false);
  });

  it('should still update state when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage quota exceeded');
    });

    const { result } = renderHook(() => useAlwaysAccept());

    act(() => {
      result.current.toggle();
    });

    // State updates even if persistence fails
    expect(result.current.isOn).toBe(true);
  });
});
