import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { OnboardingTour, TOUR_STEPS } from '../OnboardingTour';
import { useOnboardingTourContext } from '@/contexts/OnboardingTourContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  trackTourStarted,
  trackTourCompleted,
  trackTourSkipped,
  trackStepViewed,
} from '@/lib/analytics';
import { STATUS, EVENTS } from 'react-joyride';

// Mock dependencies
vi.mock('@/contexts/OnboardingTourContext');
vi.mock('@/hooks/use-mobile');
vi.mock('@/lib/analytics');

// Mock Joyride component to make testing easier
vi.mock('react-joyride', async () => {
  const actual = await vi.importActual('react-joyride');
  return {
    ...actual,
    default: vi.fn(({ callback, run, steps, stepIndex }) => {
      // Store callback for testing
      if (run && callback) {
        (global as any).__joyrideCallback = callback;
        (global as any).__joyrideState = { run, steps, stepIndex };
      }
      return run ? <div data-testid="joyride-active">Joyride Active</div> : null;
    }),
  };
});

describe('OnboardingTour', () => {
  const mockStartTour = vi.fn();
  const mockCompleteTour = vi.fn();
  const mockSkipTour = vi.fn();
  const mockSetStepIndex = vi.fn();
  const mockShouldShowTour = vi.fn();

  const defaultHookReturn = {
    run: false,
    stepIndex: 0,
    isReady: true,
    shouldShowTour: mockShouldShowTour,
    startTour: mockStartTour,
    resetTour: vi.fn(),
    completeTour: mockCompleteTour,
    skipTour: mockSkipTour,
    setStepIndex: mockSetStepIndex,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mocks
    vi.mocked(useOnboardingTourContext).mockReturnValue(defaultHookReturn);
    vi.mocked(useIsMobile).mockReturnValue(false);
    mockShouldShowTour.mockReturnValue(false);

    // Clear global joyride state
    delete (global as any).__joyrideCallback;
    delete (global as any).__joyrideState;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render null when not ready', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: false,
      });

      const { container } = render(<OnboardingTour />);

      expect(container.firstChild).toBeNull();
    });

    it('should render Joyride when ready and running', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      const { getByTestId } = render(<OnboardingTour />);

      expect(getByTestId('joyride-active')).toBeInTheDocument();
    });

    it('should not render active joyride when not running', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: false,
      });

      const { queryByTestId } = render(<OnboardingTour />);

      expect(queryByTestId('joyride-active')).not.toBeInTheDocument();
    });
  });

  describe('auto-start', () => {
    it('should auto-start tour for new users when autoStart is true', () => {
      mockShouldShowTour.mockReturnValue(true);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
      });

      render(<OnboardingTour autoStart={true} />);

      // Fast-forward past the 500ms delay
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockStartTour).toHaveBeenCalled();
    });

    it('should not auto-start when autoStart is false', () => {
      mockShouldShowTour.mockReturnValue(true);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
      });

      render(<OnboardingTour autoStart={false} />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockStartTour).not.toHaveBeenCalled();
    });

    it('should not auto-start when shouldShowTour returns false', () => {
      mockShouldShowTour.mockReturnValue(false);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
      });

      render(<OnboardingTour autoStart={true} />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockStartTour).not.toHaveBeenCalled();
    });

    it('should not auto-start when not ready', () => {
      mockShouldShowTour.mockReturnValue(true);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: false,
      });

      render(<OnboardingTour autoStart={true} />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockStartTour).not.toHaveBeenCalled();
    });
  });

  describe('joyride callback handling', () => {
    it('should track tour started on first step', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;
      expect(callback).toBeDefined();

      // Simulate first step event
      act(() => {
        callback({
          action: 'next',
          status: STATUS.RUNNING,
          type: EVENTS.STEP_BEFORE,
          index: 0,
          step: TOUR_STEPS[0],
        });
      });

      expect(trackTourStarted).toHaveBeenCalled();
    });

    it('should not track tour started multiple times', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Simulate first step event twice
      act(() => {
        callback({
          action: 'next',
          status: STATUS.RUNNING,
          type: EVENTS.STEP_BEFORE,
          index: 0,
          step: TOUR_STEPS[0],
        });
      });

      act(() => {
        callback({
          action: 'next',
          status: STATUS.RUNNING,
          type: EVENTS.STEP_BEFORE,
          index: 0,
          step: TOUR_STEPS[0],
        });
      });

      expect(trackTourStarted).toHaveBeenCalledTimes(1);
    });

    it('should handle tour completion', () => {
      const mockOnComplete = vi.fn();

      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour onComplete={mockOnComplete} />);

      const callback = (global as any).__joyrideCallback;

      // Simulate tour finished
      act(() => {
        callback({
          action: 'next',
          status: STATUS.FINISHED,
          type: EVENTS.TOUR_END,
          index: 3,
          step: TOUR_STEPS[3],
        });
      });

      expect(mockCompleteTour).toHaveBeenCalledWith(TOUR_STEPS.length);
      expect(trackTourCompleted).toHaveBeenCalledWith(TOUR_STEPS.length);
      expect(mockOnComplete).toHaveBeenCalled();
    });

    it('should handle tour skip', () => {
      const mockOnSkip = vi.fn();

      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour onSkip={mockOnSkip} />);

      const callback = (global as any).__joyrideCallback;

      // Simulate tour skipped at step 1
      act(() => {
        callback({
          action: 'skip',
          status: STATUS.SKIPPED,
          type: EVENTS.TOUR_END,
          index: 1,
          step: TOUR_STEPS[1],
        });
      });

      expect(mockSkipTour).toHaveBeenCalledWith(1);
      expect(trackTourSkipped).toHaveBeenCalledWith(1);
      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('should navigate to next step on next action', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
        stepIndex: 0,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Simulate next step
      act(() => {
        callback({
          action: 'next',
          status: STATUS.RUNNING,
          type: EVENTS.STEP_AFTER,
          index: 0,
          step: TOUR_STEPS[0],
        });
      });

      expect(trackStepViewed).toHaveBeenCalledWith(0, TOUR_STEPS[0].target);
      expect(mockSetStepIndex).toHaveBeenCalledWith(1);
    });

    it('should navigate to previous step on prev action', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
        stepIndex: 2,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Simulate previous step
      act(() => {
        callback({
          action: 'prev',
          status: STATUS.RUNNING,
          type: EVENTS.STEP_AFTER,
          index: 2,
          step: TOUR_STEPS[2],
        });
      });

      expect(mockSetStepIndex).toHaveBeenCalledWith(1);
    });

    it('should skip to next step when target not found', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
        stepIndex: 1,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Simulate target not found
      act(() => {
        callback({
          action: 'next',
          status: STATUS.RUNNING,
          type: EVENTS.TARGET_NOT_FOUND,
          index: 1,
          step: TOUR_STEPS[1],
        });
      });

      expect(mockSetStepIndex).toHaveBeenCalledWith(2);
    });
  });

  describe('TOUR_STEPS', () => {
    it('should have 4 tour steps', () => {
      expect(TOUR_STEPS).toHaveLength(4);
    });

    it('should have correct step targets', () => {
      expect(TOUR_STEPS[0].target).toBe('[data-tour="diagnostic-feature"]');
      expect(TOUR_STEPS[1].target).toBe('[data-tour="idea-framework"]');
      expect(TOUR_STEPS[2].target).toBe('[data-tour="avatar-builder"]');
      expect(TOUR_STEPS[3].target).toBe('[data-tour="brand-coach"]');
    });

    it('should have titles for all steps', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step.title).toBeDefined();
        expect(step.title).toBeTruthy();
      });
    });

    it('should have content for all steps', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step.content).toBeDefined();
        expect(step.content).toBeTruthy();
      });
    });

    it('should have auto placement for all steps', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step.placement).toBe('auto');
      });
    });

    it('should disable beacon only for first step', () => {
      expect(TOUR_STEPS[0].disableBeacon).toBe(true);
      // Other steps don't have disableBeacon set
    });
  });

  describe('responsive behavior', () => {
    it('should use mobile styles when on mobile', () => {
      vi.mocked(useIsMobile).mockReturnValue(true);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      const { getByTestId } = render(<OnboardingTour />);

      // Component renders (mobile styles are internal)
      expect(getByTestId('joyride-active')).toBeInTheDocument();
      expect(useIsMobile).toHaveBeenCalled();
    });

    it('should use desktop styles when not on mobile', () => {
      vi.mocked(useIsMobile).mockReturnValue(false);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      const { getByTestId } = render(<OnboardingTour />);

      // Component renders (desktop styles are internal)
      expect(getByTestId('joyride-active')).toBeInTheDocument();
      expect(useIsMobile).toHaveBeenCalled();
    });
  });

  describe('props', () => {
    it('should default autoStart to false', () => {
      mockShouldShowTour.mockReturnValue(true);
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
      });

      render(<OnboardingTour />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockStartTour).not.toHaveBeenCalled();
    });

    it('should call onComplete when provided and tour completes', () => {
      const mockOnComplete = vi.fn();

      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour onComplete={mockOnComplete} />);

      const callback = (global as any).__joyrideCallback;

      act(() => {
        callback({
          action: 'next',
          status: STATUS.FINISHED,
          type: EVENTS.TOUR_END,
          index: 3,
          step: TOUR_STEPS[3],
        });
      });

      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onSkip when provided and tour is skipped', () => {
      const mockOnSkip = vi.fn();

      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour onSkip={mockOnSkip} />);

      const callback = (global as any).__joyrideCallback;

      act(() => {
        callback({
          action: 'skip',
          status: STATUS.SKIPPED,
          type: EVENTS.TOUR_END,
          index: 0,
          step: TOUR_STEPS[0],
        });
      });

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('should work without onComplete callback', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Should not throw
      act(() => {
        callback({
          action: 'next',
          status: STATUS.FINISHED,
          type: EVENTS.TOUR_END,
          index: 3,
          step: TOUR_STEPS[3],
        });
      });

      expect(mockCompleteTour).toHaveBeenCalled();
    });

    it('should work without onSkip callback', () => {
      vi.mocked(useOnboardingTourContext).mockReturnValue({
        ...defaultHookReturn,
        isReady: true,
        run: true,
      });

      render(<OnboardingTour />);

      const callback = (global as any).__joyrideCallback;

      // Should not throw
      act(() => {
        callback({
          action: 'skip',
          status: STATUS.SKIPPED,
          type: EVENTS.TOUR_END,
          index: 1,
          step: TOUR_STEPS[1],
        });
      });

      expect(mockSkipTour).toHaveBeenCalled();
    });
  });
});
