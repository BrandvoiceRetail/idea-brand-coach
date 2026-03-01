/**
 * useThreePanelState Hook
 * Extends usePersistedField pattern for three-panel layout state
 * Provides local-first persistence for panel widths and collapse state
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePersistedField } from '@/hooks/usePersistedField';
import type { PanelState } from '@/v2/contexts/V2StateContext';

/**
 * Configuration for the three-panel state hook
 */
interface UseThreePanelStateConfig {
  fieldIdentifier?: string;
  defaultState?: Partial<PanelState>;
}

/**
 * Return type for the three-panel state hook
 */
interface UseThreePanelStateReturn {
  panelState: PanelState;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  togglePanelCollapse: (panel: 'left' | 'right') => void;
  setFocusedPanel: (panel: 'left' | 'center' | 'right' | null) => void;
  updatePanelState: (updates: Partial<PanelState>) => void;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Default panel state
 */
const DEFAULT_PANEL_STATE: PanelState = {
  leftWidth: 320,
  rightWidth: 320,
  isLeftCollapsed: false,
  isRightCollapsed: false,
  focusedPanel: null,
};

/**
 * Hook for managing three-panel layout state with persistence
 * Uses usePersistedField for local-first storage with background sync
 */
export function useThreePanelState({
  fieldIdentifier = 'v2-panel-state',
  defaultState = {},
}: UseThreePanelStateConfig = {}): UseThreePanelStateReturn {
  // Merge default state with provided overrides
  const initialState = useMemo(
    () => ({ ...DEFAULT_PANEL_STATE, ...defaultState }),
    [defaultState]
  );

  // Use persisted field for storage (extends existing pattern)
  const {
    value: persistedValue,
    onChange: setPersisted,
    isLoading,
    error,
    refresh,
  } = usePersistedField({
    fieldIdentifier,
    category: 'settings',
    defaultValue: JSON.stringify(initialState),
  });

  // Parse persisted value into PanelState
  const [panelState, setPanelState] = useState<PanelState>(initialState);

  // Sync persisted value to local state
  useEffect(() => {
    if (persistedValue) {
      try {
        const parsed = JSON.parse(persistedValue) as PanelState;
        setPanelState(parsed);
      } catch (err) {
        console.error('[useThreePanelState] Failed to parse persisted value:', err);
        setPanelState(initialState);
      }
    }
  }, [persistedValue, initialState]);

  /**
   * Update panel state and persist changes
   */
  const updatePanelState = useCallback(
    (updates: Partial<PanelState>): void => {
      setPanelState((prev) => {
        const nextState = { ...prev, ...updates };
        // Persist to IndexedDB (instant) + background sync to Supabase
        setPersisted(JSON.stringify(nextState));
        return nextState;
      });
    },
    [setPersisted]
  );

  /**
   * Set width for left or right panel
   */
  const setPanelWidth = useCallback(
    (panel: 'left' | 'right', width: number): void => {
      const key = panel === 'left' ? 'leftWidth' : 'rightWidth';
      updatePanelState({ [key]: width });
    },
    [updatePanelState]
  );

  /**
   * Toggle collapse state for left or right panel
   */
  const togglePanelCollapse = useCallback(
    (panel: 'left' | 'right'): void => {
      setPanelState((prev) => {
        const key = panel === 'left' ? 'isLeftCollapsed' : 'isRightCollapsed';
        const nextState = {
          ...prev,
          [key]: !prev[key],
        };
        setPersisted(JSON.stringify(nextState));
        return nextState;
      });
    },
    [setPersisted]
  );

  /**
   * Set focused panel
   */
  const setFocusedPanel = useCallback(
    (panel: 'left' | 'center' | 'right' | null): void => {
      updatePanelState({ focusedPanel: panel });
    },
    [updatePanelState]
  );

  return {
    panelState,
    setPanelWidth,
    togglePanelCollapse,
    setFocusedPanel,
    updatePanelState,
    isLoading,
    error,
    refresh,
  };
}
