/**
 * useOnboardingTour Hook
 * React hook for managing the interactive onboarding tour state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UseTourReturn } from '@/types/tour';

// Storage keys for persisting tour state
const STORAGE_KEYS = {
  TOUR_COMPLETED: 'onboarding_tour_completed',
  TOUR_COMPLETED_AT: 'onboarding_tour_completed_at',
  TOUR_SKIPPED_AT: 'onboarding_tour_skipped_at',
  TOUR_STEPS_COMPLETED: 'onboarding_tour_steps_completed',
} as const;

// Time window to consider a user as "new" (24 hours in milliseconds)
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Get completion data from localStorage
 */
function getStoredTourCompletion(): {
  completed: boolean;
  completedAt: string | null;
  skippedAt: string | null;
  stepsCompleted: number;
} {
  try {
    return {
      completed: localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED) === 'true',
      completedAt: localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED_AT),
      skippedAt: localStorage.getItem(STORAGE_KEYS.TOUR_SKIPPED_AT),
      stepsCompleted: parseInt(localStorage.getItem(STORAGE_KEYS.TOUR_STEPS_COMPLETED) || '0', 10),
    };
  } catch {
    // Handle localStorage access errors (e.g., private browsing mode)
    return {
      completed: false,
      completedAt: null,
      skippedAt: null,
      stepsCompleted: 0,
    };
  }
}

/**
 * Save completion data to localStorage
 */
function saveStoredTourCompletion(data: {
  completed?: boolean;
  completedAt?: string;
  skippedAt?: string;
  stepsCompleted?: number;
}): void {
  try {
    if (data.completed !== undefined) {
      localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED, String(data.completed));
    }
    if (data.completedAt !== undefined) {
      localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED_AT, data.completedAt);
    }
    if (data.skippedAt !== undefined) {
      localStorage.setItem(STORAGE_KEYS.TOUR_SKIPPED_AT, data.skippedAt);
    }
    if (data.stepsCompleted !== undefined) {
      localStorage.setItem(STORAGE_KEYS.TOUR_STEPS_COMPLETED, String(data.stepsCompleted));
    }
  } catch {
    // Silently handle localStorage access errors
  }
}

/**
 * Clear tour completion data from localStorage
 */
function clearStoredTourCompletion(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TOUR_COMPLETED);
    localStorage.removeItem(STORAGE_KEYS.TOUR_COMPLETED_AT);
    localStorage.removeItem(STORAGE_KEYS.TOUR_SKIPPED_AT);
    localStorage.removeItem(STORAGE_KEYS.TOUR_STEPS_COMPLETED);
  } catch {
    // Silently handle localStorage access errors
  }
}

/**
 * Check if user account was created within the "new user" window
 */
function isNewUser(userCreatedAt: string | undefined): boolean {
  if (!userCreatedAt) {
    return false;
  }

  try {
    const createdAtDate = new Date(userCreatedAt);
    const now = new Date();
    const timeSinceCreation = now.getTime() - createdAtDate.getTime();
    return timeSinceCreation < NEW_USER_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Hook for managing the onboarding tour state
 *
 * @example
 * ```tsx
 * const { run, startTour, shouldShowTour } = useOnboardingTour();
 *
 * useEffect(() => {
 *   if (shouldShowTour()) {
 *     startTour();
 *   }
 * }, [shouldShowTour, startTour]);
 *
 * return <Joyride run={run} steps={steps} />;
 * ```
 */
export function useOnboardingTour(): UseTourReturn {
  const { user } = useAuth();

  // Tour control state
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Initialize readiness when DOM is ready
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is painted
    const frameId = requestAnimationFrame(() => {
      setIsReady(true);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  // Check if tour should auto-launch for new users
  const shouldShowTour = useCallback((): boolean => {
    // Don't show if not ready
    if (!isReady) {
      return false;
    }

    // Don't show if not logged in
    if (!user) {
      return false;
    }

    // Check if user has already completed or skipped the tour
    const { completed, skippedAt } = getStoredTourCompletion();
    if (completed || skippedAt) {
      return false;
    }

    // Check if user is within the "new user" window
    const userIsNew = isNewUser(user.created_at);

    return userIsNew;
  }, [user, isReady]);

  // Start the tour
  const startTour = useCallback((): void => {
    if (!isReady) {
      return;
    }
    setStepIndex(0);
    setRun(true);
  }, [isReady]);

  // Reset the tour (for revisiting)
  const resetTour = useCallback((): void => {
    setRun(false);
    setStepIndex(0);
    clearStoredTourCompletion();
  }, []);

  // Complete the tour
  const completeTour = useCallback((stepsCompleted: number = 4): void => {
    setRun(false);
    setStepIndex(0);

    const completedAt = new Date().toISOString();
    saveStoredTourCompletion({
      completed: true,
      completedAt,
      stepsCompleted,
    });
  }, []);

  // Skip the tour
  const skipTour = useCallback((currentStep: number = 0): void => {
    setRun(false);
    setStepIndex(0);

    const skippedAt = new Date().toISOString();
    saveStoredTourCompletion({
      completed: false,
      skippedAt,
      stepsCompleted: currentStep,
    });
  }, []);

  // Update step index
  const handleSetStepIndex = useCallback((index: number): void => {
    setStepIndex(index);
  }, []);

  // Memoize the return value for stable references
  return useMemo(
    () => ({
      // State
      run,
      stepIndex,
      isReady,

      // Methods
      shouldShowTour,
      startTour,
      resetTour,
      completeTour,
      skipTour,
      setStepIndex: handleSetStepIndex,
    }),
    [run, stepIndex, isReady, shouldShowTour, startTour, resetTour, completeTour, skipTour, handleSetStepIndex]
  );
}

/**
 * Export storage utilities for testing
 */
export const tourStorageUtils = {
  getStoredTourCompletion,
  saveStoredTourCompletion,
  clearStoredTourCompletion,
  STORAGE_KEYS,
};

export default useOnboardingTour;
