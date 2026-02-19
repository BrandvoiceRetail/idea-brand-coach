/**
 * SystemKBContext
 *
 * Global context for System KB (IDEA Framework Knowledge Base) state.
 * NOTE: System KB is now always enabled. This context is kept for backwards compatibility
 * and potential future extensions, but the toggle functionality has been removed.
 */

import { createContext, useContext, useCallback, ReactNode } from 'react';

interface SystemKBContextValue {
  /** Whether System KB integration is enabled */
  useSystemKB: boolean;
  /** Toggle System KB on/off */
  toggleSystemKB: () => void;
  /** Set System KB enabled state directly */
  setUseSystemKB: (enabled: boolean) => void;
}

const SystemKBContext = createContext<SystemKBContextValue | undefined>(undefined);

interface SystemKBProviderProps {
  children: ReactNode;
}

export function SystemKBProvider({ children }: SystemKBProviderProps): JSX.Element {
  // System KB is now always enabled
  const useSystemKB = true;

  // No-op functions for backwards compatibility
  const toggleSystemKB = useCallback(() => {
    // No-op: System KB is always enabled
    console.log('[SystemKBContext] System KB is always enabled');
  }, []);

  const setUseSystemKB = useCallback((enabled: boolean) => {
    // No-op: System KB is always enabled
    console.log('[SystemKBContext] System KB is always enabled');
  }, []);

  return (
    <SystemKBContext.Provider value={{ useSystemKB, toggleSystemKB, setUseSystemKB }}>
      {children}
    </SystemKBContext.Provider>
  );
}

/**
 * Hook to access System KB toggle state
 * Must be used within a SystemKBProvider
 */
export function useSystemKB(): SystemKBContextValue {
  const context = useContext(SystemKBContext);
  if (!context) {
    throw new Error('useSystemKB must be used within a SystemKBProvider');
  }
  return context;
}
