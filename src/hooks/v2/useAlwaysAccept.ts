/**
 * useAlwaysAccept Hook
 *
 * Persisted boolean preference controlling whether AI-extracted fields
 * are auto-accepted (bypass review modal) or queued for manual review.
 * Persistence is handled via localStorage so it survives page reloads.
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseAlwaysAcceptReturn {
  /** Whether auto-accept is currently enabled */
  isOn: boolean;
  /** Toggle the current value */
  toggle: () => void;
  /** Set to a specific value */
  setOn: (value: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'always-accept-extractions';

// ============================================================================
// Hook
// ============================================================================

/**
 * Manages the "always accept" preference with localStorage persistence.
 *
 * Note: The existing `usePersistedField` hook is designed for brand-data fields
 * with IndexedDB + Supabase sync — it's heavier than needed for a simple boolean
 * UI preference. This hook uses localStorage directly for simplicity and instant
 * load without async initialization.
 */
export function useAlwaysAccept(): UseAlwaysAcceptReturn {
  const [isOn, setIsOn] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Persist to localStorage whenever the value changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOn));
    } catch {
      // localStorage unavailable — preference is ephemeral this session
    }
  }, [isOn]);

  const toggle = useCallback((): void => {
    setIsOn((prev) => !prev);
  }, []);

  const setOn = useCallback((value: boolean): void => {
    setIsOn(value);
  }, []);

  return { isOn, toggle, setOn };
}
