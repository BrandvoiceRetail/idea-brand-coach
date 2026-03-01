import React, { createContext, useContext, ReactNode } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { useThreePanelState } from '@/v2/hooks/useThreePanelState';

/**
 * V2-specific panel state for three-panel layout
 */
export interface PanelState {
  leftWidth: number;
  rightWidth: number;
  isLeftCollapsed: boolean;
  isRightCollapsed: boolean;
  focusedPanel: 'left' | 'center' | 'right' | null;
}

/**
 * V2StateContext - Thin wrapper composing BrandContext
 * Adds v2-specific state for panel management
 */
interface V2StateContextType {
  // V2-specific panel state
  panelState: PanelState;
  updatePanelState: (updates: Partial<PanelState>) => void;
  setPanelWidth: (panel: 'left' | 'right', width: number) => void;
  togglePanelCollapse: (panel: 'left' | 'right') => void;
  setFocusedPanel: (panel: 'left' | 'center' | 'right' | null) => void;
}

const V2StateContext = createContext<V2StateContextType | undefined>(undefined);

const initialPanelState: PanelState = {
  leftWidth: 320,
  rightWidth: 320,
  isLeftCollapsed: false,
  isRightCollapsed: false,
  focusedPanel: null,
};

export const V2StateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use the existing hook instead of duplicating logic
  const {
    panelState,
    setPanelWidth,
    togglePanelCollapse,
    setFocusedPanel,
    updatePanelState,
  } = useThreePanelState({
    fieldIdentifier: 'v2-global-panel-state',
    defaultState: initialPanelState,
  });

  const value: V2StateContextType = {
    panelState,
    updatePanelState,
    setPanelWidth,
    togglePanelCollapse,
    setFocusedPanel,
  };

  return (
    <V2StateContext.Provider value={value}>
      {children}
    </V2StateContext.Provider>
  );
};

/**
 * Custom hook to access V2 state
 * Must be used within V2StateProvider
 */
export const useV2State = (): V2StateContextType => {
  const context = useContext(V2StateContext);
  if (context === undefined) {
    throw new Error('useV2State must be used within a V2StateProvider');
  }
  return context;
};

/**
 * Custom hook that provides both Brand state and V2 state
 * Convenience hook for components that need both
 */
export const useBrandV2State = () => {
  const brandContext = useBrand();
  const v2Context = useV2State();

  return {
    ...brandContext,
    ...v2Context,
  };
};
