import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMilestone } from '../useMilestone';

describe('useMilestone', () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear mock storage
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);

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

    // Mock matchMedia for prefers-reduced-motion
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return null activeMilestone when field count is 0', () => {
    const { result } = renderHook(() => useMilestone(0, 'avatar-1'));

    expect(result.current.activeMilestone).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });

  it('should not fire a milestone below 10 fields', () => {
    const { result } = renderHook(() => useMilestone(9, 'avatar-1'));

    expect(result.current.activeMilestone).toBeNull();
  });

  it('should fire the 10-field milestone', () => {
    const { result } = renderHook(() => useMilestone(10, 'avatar-1'));

    expect(result.current.activeMilestone).not.toBeNull();
    expect(result.current.activeMilestone?.tier).toBe(10);
    expect(result.current.activeMilestone?.showPulse).toBe(true);
    expect(result.current.activeMilestone?.showConfetti).toBe(false);
    expect(result.current.activeMilestone?.showGold).toBe(false);
    expect(result.current.activeMilestone?.message).toContain('10 fields captured');
  });

  it('should fire the 20-field milestone with confetti', () => {
    // First get past 10
    const { result, rerender } = renderHook(
      ({ count }) => useMilestone(count, 'avatar-1'),
      { initialProps: { count: 10 } },
    );

    // Dismiss 10
    act(() => result.current.dismissMilestone());

    // Jump to 20
    rerender({ count: 20 });

    expect(result.current.activeMilestone).not.toBeNull();
    expect(result.current.activeMilestone?.tier).toBe(20);
    expect(result.current.activeMilestone?.showConfetti).toBe(true);
    expect(result.current.activeMilestone?.showPulse).toBe(false);
    expect(result.current.activeMilestone?.message).toContain('20 fields');
  });

  it('should fire the 35-field milestone with gold and confetti', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useMilestone(count, 'avatar-1'),
      { initialProps: { count: 10 } },
    );

    act(() => result.current.dismissMilestone());
    rerender({ count: 20 });
    act(() => result.current.dismissMilestone());
    rerender({ count: 35 });

    expect(result.current.activeMilestone).not.toBeNull();
    expect(result.current.activeMilestone?.tier).toBe(35);
    expect(result.current.activeMilestone?.showConfetti).toBe(true);
    expect(result.current.activeMilestone?.showGold).toBe(true);
    expect(result.current.activeMilestone?.message).toContain('All 35 fields');
    expect(result.current.isComplete).toBe(true);
  });

  it('should not re-fire the same milestone on re-render', () => {
    const { result, rerender } = renderHook(
      ({ count }) => useMilestone(count, 'avatar-1'),
      { initialProps: { count: 10 } },
    );

    expect(result.current.activeMilestone?.tier).toBe(10);

    // Dismiss it
    act(() => result.current.dismissMilestone());
    expect(result.current.activeMilestone).toBeNull();

    // Re-render with same count
    rerender({ count: 10 });
    expect(result.current.activeMilestone).toBeNull();
  });

  it('should persist milestones per avatar via localStorage', () => {
    // Fire milestone for avatar-1
    renderHook(() => useMilestone(10, 'avatar-1'));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'milestone_fired_avatar-1_10',
      'true',
    );
  });

  it('should not fire milestone that was already persisted for this avatar', () => {
    // Pre-set the storage
    mockLocalStorage['milestone_fired_avatar-1_10'] = 'true';

    const { result } = renderHook(() => useMilestone(10, 'avatar-1'));

    expect(result.current.activeMilestone).toBeNull();
  });

  it('should fire milestone for different avatar even if same tier was fired for another', () => {
    // Mark tier 10 as fired for avatar-1
    mockLocalStorage['milestone_fired_avatar-1_10'] = 'true';

    // avatar-2 should still get the milestone
    const { result } = renderHook(() => useMilestone(10, 'avatar-2'));

    expect(result.current.activeMilestone).not.toBeNull();
    expect(result.current.activeMilestone?.tier).toBe(10);
  });

  it('should dismiss milestone when dismissMilestone is called', () => {
    const { result } = renderHook(() => useMilestone(10, 'avatar-1'));

    expect(result.current.activeMilestone).not.toBeNull();

    act(() => result.current.dismissMilestone());

    expect(result.current.activeMilestone).toBeNull();
  });

  it('should return isComplete true when 35-field milestone has previously fired', () => {
    // Mark all tiers as fired (simulating a profile that already completed)
    mockLocalStorage['milestone_fired_avatar-1_10'] = 'true';
    mockLocalStorage['milestone_fired_avatar-1_20'] = 'true';
    mockLocalStorage['milestone_fired_avatar-1_35'] = 'true';

    const { result } = renderHook(() => useMilestone(35, 'avatar-1'));

    expect(result.current.isComplete).toBe(true);
    // Should not re-fire any milestone since all are already in localStorage
    expect(result.current.activeMilestone).toBeNull();
  });

  it('should handle null avatarId gracefully', () => {
    const { result } = renderHook(() => useMilestone(10, null));

    expect(result.current.activeMilestone).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });

  it('should detect prefers-reduced-motion', () => {
    // Override matchMedia to return matches: true
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    const { result } = renderHook(() => useMilestone(0, 'avatar-1'));

    expect(result.current.prefersReducedMotion).toBe(true);
  });

  it('should fire highest newly-crossed tier when jumping from 0 to 35', () => {
    // When we jump straight to 35, only the highest unfired tier should fire
    const { result } = renderHook(() => useMilestone(35, 'avatar-1'));

    expect(result.current.activeMilestone).not.toBeNull();
    expect(result.current.activeMilestone?.tier).toBe(35);
    expect(result.current.isComplete).toBe(true);

    // All tiers should be marked as fired in localStorage
    expect(mockLocalStorage['milestone_fired_avatar-1_35']).toBe('true');
  });

  it('should reset when avatar changes', () => {
    const { result, rerender } = renderHook(
      ({ count, avatarId }) => useMilestone(count, avatarId),
      { initialProps: { count: 10, avatarId: 'avatar-1' } },
    );

    expect(result.current.activeMilestone?.tier).toBe(10);

    // Switch to new avatar with 0 fields
    rerender({ count: 0, avatarId: 'avatar-2' });

    expect(result.current.activeMilestone).toBeNull();
  });
});
