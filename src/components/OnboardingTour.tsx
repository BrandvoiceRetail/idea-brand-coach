/**
 * OnboardingTour Component
 * Interactive guided tour using React Joyride to walk new users through key features
 */

import { useEffect, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, Step } from 'react-joyride';
import { useOnboardingTour } from '@/hooks/useOnboardingTour';
import { TourStep } from '@/types/tour';

/**
 * Tour step definitions highlighting the 4 key features
 * Uses data-tour attributes for reliable DOM selectors
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="diagnostic-feature"]',
    title: 'Brand Diagnostic',
    content:
      'Start here! Our Brand Diagnostic assesses your current brand strength across key dimensions. Get actionable insights to understand where your brand stands today.',
    placement: 'bottom',
    disableBeacon: true,
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="idea-framework"]',
    title: 'IDEA Framework',
    content:
      'Master the IDEA Framework: Identity, Differentiation, Emotion, and Action. This proven methodology helps you build a brand that truly resonates with your audience.',
    placement: 'bottom',
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="avatar-builder"]',
    title: 'Avatar Builder',
    content:
      'Create detailed customer avatars to deeply understand your ideal audience. Know their goals, challenges, and what motivates them to buy.',
    placement: 'bottom',
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="brand-coach"]',
    title: 'Brand Coach',
    content:
      'Get personalized AI-powered brand coaching. Ask questions, get strategic advice, and receive guidance tailored to your unique brand challenges.',
    placement: 'bottom',
    spotlightPadding: 8,
  },
];

/**
 * Custom styles for the tour tooltips
 * Matches the application's design system
 */
const TOUR_STYLES = {
  options: {
    primaryColor: 'hsl(var(--primary))',
    backgroundColor: 'hsl(var(--background))',
    textColor: 'hsl(var(--foreground))',
    arrowColor: 'hsl(var(--background))',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: '0.5rem',
    padding: '1rem',
    boxShadow:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: 'hsl(var(--foreground))',
  },
  tooltipContent: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: 'hsl(var(--muted-foreground))',
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--primary))',
    borderRadius: '0.375rem',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  buttonBack: {
    color: 'hsl(var(--muted-foreground))',
    marginRight: '0.5rem',
    fontSize: '0.875rem',
  },
  buttonSkip: {
    color: 'hsl(var(--muted-foreground))',
    fontSize: '0.875rem',
  },
  buttonClose: {
    color: 'hsl(var(--muted-foreground))',
    padding: '0.25rem',
  },
  spotlight: {
    borderRadius: '0.5rem',
  },
};

/**
 * Props for the OnboardingTour component
 */
interface OnboardingTourProps {
  /** Whether to auto-start the tour when component mounts */
  autoStart?: boolean;
  /** Callback when tour is completed */
  onComplete?: () => void;
  /** Callback when tour is skipped */
  onSkip?: () => void;
}

/**
 * OnboardingTour Component
 *
 * Renders an interactive guided tour using React Joyride.
 * The tour highlights 4 key features: Diagnostic, IDEA Framework, Avatar Builder, and Brand Coach.
 *
 * @example
 * ```tsx
 * // Auto-start tour for new users
 * <OnboardingTour autoStart={true} />
 *
 * // Manual control with callbacks
 * <OnboardingTour
 *   onComplete={() => console.log('Tour completed')}
 *   onSkip={() => console.log('Tour skipped')}
 * />
 * ```
 */
export function OnboardingTour({
  autoStart = false,
  onComplete,
  onSkip,
}: OnboardingTourProps) {
  const {
    run,
    stepIndex,
    isReady,
    shouldShowTour,
    startTour,
    completeTour,
    skipTour,
    setStepIndex,
  } = useOnboardingTour();

  // Auto-start tour for new users if autoStart is enabled
  useEffect(() => {
    if (autoStart && isReady && shouldShowTour()) {
      // Small delay to ensure all target elements are mounted
      const timeoutId = setTimeout(() => {
        startTour();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [autoStart, isReady, shouldShowTour, startTour]);

  /**
   * Handle Joyride callback events
   * Manages tour state transitions and analytics tracking
   */
  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, status, type, index } = data;

      // Handle tour completion
      if (status === STATUS.FINISHED) {
        completeTour(TOUR_STEPS.length);
        onComplete?.();
        return;
      }

      // Handle tour skip
      if (status === STATUS.SKIPPED) {
        skipTour(index);
        onSkip?.();
        return;
      }

      // Handle step navigation
      if (type === EVENTS.STEP_AFTER) {
        // Move to next step
        if (action === 'next') {
          setStepIndex(index + 1);
        }
        // Move to previous step
        if (action === 'prev') {
          setStepIndex(index - 1);
        }
      }

      // Handle target not found error
      if (type === EVENTS.TARGET_NOT_FOUND) {
        // Skip to next step if target element doesn't exist
        setStepIndex(index + 1);
      }
    },
    [completeTour, skipTour, setStepIndex, onComplete, onSkip]
  );

  // Don't render if not ready
  if (!isReady) {
    return null;
  }

  return (
    <Joyride
      steps={TOUR_STEPS as Step[]}
      run={run}
      stepIndex={stepIndex}
      continuous={true}
      showProgress={true}
      showSkipButton={true}
      disableScrolling={false}
      disableOverlayClose={false}
      spotlightClicks={false}
      hideCloseButton={false}
      callback={handleJoyrideCallback}
      styles={TOUR_STYLES}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
        open: 'Open',
      }}
      floaterProps={{
        disableAnimation: false,
      }}
    />
  );
}

/**
 * Export tour steps for testing and external use
 */
export { TOUR_STEPS };

export default OnboardingTour;
