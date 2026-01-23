/**
 * OnboardingTourContext
 * Provides shared state for the onboarding tour across components
 */

import { createContext, useContext, ReactNode } from 'react';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { UseTourReturn } from '@/types/tour';

const OnboardingTourContext = createContext<UseTourReturn | null>(null);

interface OnboardingTourProviderProps {
  children: ReactNode;
}

export function OnboardingTourProvider({ children }: OnboardingTourProviderProps): JSX.Element {
  const tourState = useOnboardingTour();

  return (
    <OnboardingTourContext.Provider value={tourState}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTourContext(): UseTourReturn {
  const context = useContext(OnboardingTourContext);
  if (!context) {
    throw new Error('useOnboardingTourContext must be used within OnboardingTourProvider');
  }
  return context;
}
