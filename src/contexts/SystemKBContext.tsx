/**
 * SystemKBContext
 *
 * Global context for System KB (IDEA Framework Knowledge Base) toggle state.
 * This ensures all chat components stay in sync when the toggle is changed.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useServices } from '@/services/ServiceProvider';

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
  const { chatService } = useServices();

  // Initialize from service state
  const [useSystemKB, setUseSystemKBState] = useState(() => chatService.getUseSystemKB());

  // Sync service when state changes
  useEffect(() => {
    chatService.setUseSystemKB(useSystemKB);
  }, [chatService, useSystemKB]);

  const toggleSystemKB = useCallback(() => {
    setUseSystemKBState(prev => !prev);
  }, []);

  const setUseSystemKB = useCallback((enabled: boolean) => {
    setUseSystemKBState(enabled);
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
