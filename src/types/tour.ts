/**
 * Tour Types
 * Type definitions for Interactive Onboarding Tour feature
 */

/**
 * Tour step placement options
 */
export type TourStepPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'
  | 'auto'
  | 'center';

/**
 * Tour status values matching React Joyride STATUS constants
 */
export type TourStatus = 'finished' | 'skipped' | 'running' | 'paused' | 'ready' | 'idle' | 'error';

/**
 * Tour event types matching React Joyride EVENTS constants
 */
export type TourEventType =
  | 'step:after'
  | 'step:before'
  | 'tour:start'
  | 'tour:end'
  | 'tooltip:close'
  | 'beacon:click'
  | 'error:target_not_found';

/**
 * Tour action types matching React Joyride ACTIONS constants
 */
export type TourAction = 'start' | 'stop' | 'reset' | 'next' | 'prev' | 'skip' | 'close' | 'update' | 'init';

/**
 * Individual tour step configuration
 */
export interface TourStep {
  target: string;
  content: string;
  title?: string;
  placement?: TourStepPlacement;
  disableBeacon?: boolean;
  spotlightClicks?: boolean;
  spotlightPadding?: number;
  styles?: Record<string, unknown>;
}

/**
 * Current tour state managed by useOnboardingTour hook
 */
export interface TourState {
  run: boolean;
  stepIndex: number;
  isReady: boolean;
}

/**
 * Tour completion record for tracking user progress
 */
export interface TourCompletion {
  user_id: string;
  completed: boolean;
  completed_at: string | null;
  skipped_at: string | null;
  steps_completed: number;
  total_steps: number;
}

/**
 * Tour completion data for localStorage/API sync
 */
export interface TourCompletionCreate {
  completed: boolean;
  steps_completed: number;
}

/**
 * Tour completion update payload
 */
export interface TourCompletionUpdate {
  completed?: boolean;
  completed_at?: string;
  skipped_at?: string;
  steps_completed?: number;
}

/**
 * Tour callback data structure matching React Joyride CallBackProps
 */
export interface TourCallbackData {
  action: TourAction;
  status: TourStatus;
  type: TourEventType;
  index: number;
  step: TourStep;
  controlled: boolean;
  lifecycle: string;
  size: number;
}

/**
 * Tour analytics event payload
 */
export interface TourAnalyticsEvent {
  event_name: string;
  user_id?: string;
  step_index?: number;
  step_target?: string;
  status?: TourStatus;
  steps_completed?: number;
  timestamp?: string;
}

/**
 * Tour feature targets for data-tour attributes
 */
export type TourFeatureTarget =
  | 'diagnostic-feature'
  | 'idea-framework'
  | 'avatar-builder'
  | 'brand-coach';

/**
 * Tour hook return type
 */
export interface UseTourReturn {
  run: boolean;
  stepIndex: number;
  isReady: boolean;
  shouldShowTour: () => boolean;
  startTour: () => void;
  resetTour: () => void;
  completeTour: (stepsCompleted?: number) => void;
  skipTour: (currentStep?: number) => void;
  setStepIndex: (index: number) => void;
}
