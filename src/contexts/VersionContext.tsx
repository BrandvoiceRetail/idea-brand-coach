/**
 * VersionContext
 *
 * Provides app-wide version preference state. Wrap your app with
 * VersionProvider and consume via useVersionContext().
 */
import { createContext, useContext, ReactNode } from 'react';
import {
  useVersionPreference,
  type UseVersionPreferenceResult,
} from '@/hooks/useVersionPreference';
import type { VersionContextValue } from '@/types/version';

const VersionContext = createContext<VersionContextValue | null>(null);

interface VersionProviderProps {
  children: ReactNode;
}

export function VersionProvider({ children }: VersionProviderProps): JSX.Element {
  const preference: UseVersionPreferenceResult = useVersionPreference();

  const value: VersionContextValue = {
    currentVersion: preference.currentVersion,
    hasSeenIntroduction: preference.hasSeenIntroduction,
    switchHistory: preference.switchHistory,
    setVersion: preference.setVersion,
    markIntroductionSeen: preference.markIntroductionSeen,
    isNewUser: preference.isNewUser,
  };

  return (
    <VersionContext.Provider value={value}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersionContext(): VersionContextValue {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersionContext must be used within VersionProvider');
  }
  return context;
}
