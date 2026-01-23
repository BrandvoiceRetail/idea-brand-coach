import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnboardingTour, tourStorageUtils } from '../useOnboardingTour';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('useOnboardingTour', () => {
  const mockLocalStorage: Record<string, string> = {};

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

    // Mock requestAnimationFrame to execute callback immediately
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // Default mock for useAuth - no user
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      loading: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
  });

  it('should provide all tour state and methods', () => {
    const { result } = renderHook(() => useOnboardingTour());

    // State properties
    expect(result.current).toHaveProperty('run');
    expect(result.current).toHaveProperty('stepIndex');
    expect(result.current).toHaveProperty('isReady');

    // Methods
    expect(result.current).toHaveProperty('shouldShowTour');
    expect(result.current).toHaveProperty('startTour');
    expect(result.current).toHaveProperty('resetTour');
    expect(result.current).toHaveProperty('completeTour');
    expect(result.current).toHaveProperty('skipTour');
    expect(result.current).toHaveProperty('setStepIndex');
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useOnboardingTour());

    expect(result.current.run).toBe(false);
    expect(result.current.stepIndex).toBe(0);
  });

  it('should set isReady to true after mount', async () => {
    const { result } = renderHook(() => useOnboardingTour());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });
  });

  describe('startTour', () => {
    it('should set run to true and stepIndex to 0', async () => {
      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.startTour();
      });

      expect(result.current.run).toBe(true);
      expect(result.current.stepIndex).toBe(0);
    });

    it('should not start if not ready', () => {
      vi.stubGlobal('requestAnimationFrame', () => 1); // Don't execute callback

      const { result } = renderHook(() => useOnboardingTour());

      expect(result.current.isReady).toBe(false);

      act(() => {
        result.current.startTour();
      });

      expect(result.current.run).toBe(false);
    });
  });

  describe('completeTour', () => {
    it('should set run to false and save completion to localStorage', async () => {
      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.startTour();
      });

      act(() => {
        result.current.completeTour();
      });

      expect(result.current.run).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED,
        'true'
      );
    });
  });

  describe('skipTour', () => {
    it('should set run to false and save skipped state to localStorage', async () => {
      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.startTour();
      });

      act(() => {
        result.current.skipTour();
      });

      expect(result.current.run).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED,
        'false'
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_SKIPPED_AT,
        expect.any(String)
      );
    });
  });

  describe('resetTour', () => {
    it('should clear localStorage and reset state', async () => {
      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.startTour();
      });

      act(() => {
        result.current.resetTour();
      });

      expect(result.current.run).toBe(false);
      expect(result.current.stepIndex).toBe(0);
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED
      );
    });
  });

  describe('setStepIndex', () => {
    it('should update the step index', async () => {
      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.setStepIndex(2);
      });

      expect(result.current.stepIndex).toBe(2);
    });
  });

  describe('shouldShowTour', () => {
    it('should return false when not ready', () => {
      vi.stubGlobal('requestAnimationFrame', () => 1); // Don't execute callback

      const { result } = renderHook(() => useOnboardingTour());

      expect(result.current.shouldShowTour()).toBe(false);
    });

    it('should return false when user is not logged in', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        session: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        loading: false,
      });

      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.shouldShowTour()).toBe(false);
    });

    it('should return false when tour was already completed', async () => {
      const now = new Date();
      mockLocalStorage[tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED] = 'true';

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'test-user',
          email: 'test@example.com',
          created_at: now.toISOString(),
        } as any,
        session: {} as any,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        loading: false,
      });

      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.shouldShowTour()).toBe(false);
    });

    it('should return false when tour was skipped', async () => {
      const now = new Date();
      mockLocalStorage[tourStorageUtils.STORAGE_KEYS.TOUR_SKIPPED_AT] = now.toISOString();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'test-user',
          email: 'test@example.com',
          created_at: now.toISOString(),
        } as any,
        session: {} as any,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        loading: false,
      });

      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.shouldShowTour()).toBe(false);
    });

    it('should return true for new user who has not completed or skipped tour', async () => {
      const now = new Date();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'test-user',
          email: 'test@example.com',
          created_at: now.toISOString(),
        } as any,
        session: {} as any,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        loading: false,
      });

      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.shouldShowTour()).toBe(true);
    });

    it('should return false for user created more than 24 hours ago', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2); // 2 days ago

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'test-user',
          email: 'test@example.com',
          created_at: oldDate.toISOString(),
        } as any,
        session: {} as any,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        loading: false,
      });

      const { result } = renderHook(() => useOnboardingTour());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.shouldShowTour()).toBe(false);
    });
  });

  describe('tourStorageUtils', () => {
    it('should get stored tour completion data', () => {
      mockLocalStorage[tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED] = 'true';
      mockLocalStorage[tourStorageUtils.STORAGE_KEYS.TOUR_STEPS_COMPLETED] = '3';

      const result = tourStorageUtils.getStoredTourCompletion();

      expect(result.completed).toBe(true);
      expect(result.stepsCompleted).toBe(3);
    });

    it('should save tour completion data', () => {
      tourStorageUtils.saveStoredTourCompletion({
        completed: true,
        stepsCompleted: 4,
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED,
        'true'
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_STEPS_COMPLETED,
        '4'
      );
    });

    it('should clear stored tour completion data', () => {
      tourStorageUtils.clearStoredTourCompletion();

      expect(localStorage.removeItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_COMPLETED_AT
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_SKIPPED_AT
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        tourStorageUtils.STORAGE_KEYS.TOUR_STEPS_COMPLETED
      );
    });
  });
});
