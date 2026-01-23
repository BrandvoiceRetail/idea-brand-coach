/**
 * OnboardingTour Component
 * Interactive guided tour using React Joyride to walk new users through key features
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import Joyride, { CallBackProps, STATUS, EVENTS, Step } from 'react-joyride';
import { useOnboardingTourContext } from '@/contexts/OnboardingTourContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { TourStep } from '@/types/tour';
import {
  trackTourStarted,
  trackTourCompleted,
  trackTourSkipped,
  trackStepViewed,
} from '@/lib/analytics';

/**
 * Tour step definitions highlighting the 4 key features
 * Uses data-tour attributes for reliable DOM selectors
 * Uses 'auto' placement for responsive positioning that adapts to viewport
 */
const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="diagnostic-feature"]',
    title: 'Brand Diagnostic',
    content:
      'Start here! Our Brand Diagnostic assesses your current brand strength across key dimensions. Get actionable insights to understand where your brand stands today.',
    placement: 'auto',
    disableBeacon: true,
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="idea-framework"]',
    title: 'IDEA Framework',
    content:
      'Master the IDEA Framework: Identity, Differentiation, Emotion, and Action. This proven methodology helps you build a brand that truly resonates with your audience.',
    placement: 'auto',
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="avatar-builder"]',
    title: 'Avatar Builder',
    content:
      'Create detailed customer avatars to deeply understand your ideal audience. Know their goals, challenges, and what motivates them to buy.',
    placement: 'auto',
    spotlightPadding: 8,
  },
  {
    target: '[data-tour="brand-coach"]',
    title: 'Brand Coach',
    content:
      'Get personalized AI-powered brand coaching. Ask questions, get strategic advice, and receive guidance tailored to your unique brand challenges.',
    placement: 'auto',
    spotlightPadding: 8,
  },
];

/**
 * Generate responsive tour styles based on screen size
 * Matches the application's design system with mobile optimizations
 * @param isMobile - Whether the current viewport is mobile (< 768px)
 */
const getTourStyles = (isMobile: boolean) => ({
  options: {
    primaryColor: 'hsl(var(--primary))',
    backgroundColor: 'hsl(var(--background))',
    textColor: 'hsl(var(--foreground))',
    arrowColor: 'hsl(var(--background))',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10000,
    // Constrain tooltip width on mobile to prevent overflow
    width: isMobile ? 280 : 380,
  },
  tooltip: {
    borderRadius: '0.5rem',
    // Reduced padding on mobile for more compact display
    padding: isMobile ? '0.75rem' : '1rem',
    boxShadow:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    // Ensure tooltip respects viewport boundaries
    maxWidth: isMobile ? 'calc(100vw - 32px)' : '400px',
  },
  tooltipContainer: {
    textAlign: 'left' as const,
  },
  tooltipTitle: {
    // Slightly smaller title on mobile
    fontSize: isMobile ? '1rem' : '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: 'hsl(var(--foreground))',
  },
  tooltipContent: {
    // Slightly smaller content on mobile
    fontSize: isMobile ? '0.8125rem' : '0.875rem',
    lineHeight: 1.6,
    color: 'hsl(var(--muted-foreground))',
  },
  buttonNext: {
    backgroundColor: 'hsl(var(--primary))',
    borderRadius: '0.375rem',
    // Slightly smaller buttons on mobile
    padding: isMobile ? '0.375rem 0.75rem' : '0.5rem 1rem',
    fontSize: isMobile ? '0.8125rem' : '0.875rem',
    fontWeight: 500,
  },
  buttonBack: {
    color: 'hsl(var(--muted-foreground))',
    marginRight: isMobile ? '0.25rem' : '0.5rem',
    fontSize: isMobile ? '0.8125rem' : '0.875rem',
  },
  buttonSkip: {
    color: 'hsl(var(--muted-foreground))',
    fontSize: isMobile ? '0.8125rem' : '0.875rem',
  },
  buttonClose: {
    color: 'hsl(var(--muted-foreground))',
    padding: '0.25rem',
  },
  spotlight: {
    borderRadius: '0.5rem',
  },
});

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
  } = useOnboardingTourContext();

  // Detect mobile viewport for responsive styles
  const isMobile = useIsMobile();

  // Memoize tour styles to prevent unnecessary re-renders
  const tourStyles = useMemo(() => getTourStyles(isMobile), [isMobile]);

  // Track if tour start analytics have been fired to avoid duplicates
  const hasTrackedStartRef = useRef(false);

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
      const { action, status, type, index, step } = data;

      // Track tour started on first step (only once per tour run)
      if (type === EVENTS.STEP_BEFORE && index === 0 && !hasTrackedStartRef.current) {
        hasTrackedStartRef.current = true;
        void trackTourStarted();
      }

      // Handle tour completion
      if (status === STATUS.FINISHED) {
        hasTrackedStartRef.current = false; // Reset for potential restart
        completeTour(TOUR_STEPS.length);
        void trackTourCompleted(TOUR_STEPS.length);
        onComplete?.();
        return;
      }

      // Handle tour skip
      if (status === STATUS.SKIPPED) {
        hasTrackedStartRef.current = false; // Reset for potential restart
        skipTour(index);
        void trackTourSkipped(index);
        onSkip?.();
        return;
      }

      // Handle step navigation and track step views
      if (type === EVENTS.STEP_AFTER) {
        // Track the step that was just viewed
        const stepTarget = typeof step?.target === 'string' ? step.target : String(step?.target ?? '');
        void trackStepViewed(index, stepTarget);

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
      styles={tourStyles}
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
        // Ensure floater stays within viewport boundaries on all screen sizes
        offset: isMobile ? 8 : 16,
        // Use flip for better positioning when tooltip would overflow viewport
        autoOpen: true,
      }}
      // Scroll offset adjusted for mobile to account for smaller viewport
      scrollOffset={isMobile ? 60 : 100}
    />
  );
}

/**
 * Export tour steps for testing and external use
 */
export { TOUR_STEPS };

export default OnboardingTour;
