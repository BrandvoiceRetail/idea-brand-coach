/**
 * Analytics Tracking Service
 * Provides event tracking for user interactions and feature usage
 */

import { supabase } from '@/integrations/supabase/client';
import type { TourAnalyticsEvent, TourStatus } from '@/types/tour';

/**
 * Analytics event names for tour tracking
 */
export const TOUR_EVENTS = {
  STARTED: 'onboarding_tour_started',
  COMPLETED: 'onboarding_tour_completed',
  SKIPPED: 'onboarding_tour_skipped',
  STEP_VIEWED: 'onboarding_step_viewed',
} as const;

export type TourEventName = (typeof TOUR_EVENTS)[keyof typeof TOUR_EVENTS];

/**
 * Generic analytics event payload
 */
export interface AnalyticsEvent {
  event_name: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
  user_id?: string;
}

/**
 * Get the current user ID from Supabase auth
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Track a generic analytics event
 *
 * @param eventName - Name of the event to track
 * @param properties - Optional event properties/metadata
 *
 * @example
 * ```ts
 * trackEvent('button_clicked', { button_id: 'submit', page: 'checkout' });
 * ```
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const timestamp = new Date().toISOString();

    const event: AnalyticsEvent = {
      event_name: eventName,
      properties,
      timestamp,
      user_id: userId ?? undefined,
    };

    // In development, log to console for debugging
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[Analytics]', eventName, properties);
    }

    // Store in localStorage as a fallback analytics queue
    // This can be synced to a backend analytics service later
    const analyticsQueue = getAnalyticsQueue();
    analyticsQueue.push(event);

    // Keep only the last 100 events to prevent localStorage bloat
    const trimmedQueue = analyticsQueue.slice(-100);
    localStorage.setItem('analytics_queue', JSON.stringify(trimmedQueue));
  } catch {
    // Silently fail - analytics should never break the app
  }
}

/**
 * Get the analytics event queue from localStorage
 */
function getAnalyticsQueue(): AnalyticsEvent[] {
  try {
    const queue = localStorage.getItem('analytics_queue');
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
}

/**
 * Clear the analytics queue (useful after syncing to backend)
 */
export function clearAnalyticsQueue(): void {
  try {
    localStorage.removeItem('analytics_queue');
  } catch {
    // Silently fail
  }
}

/**
 * Get all queued analytics events
 */
export function getQueuedEvents(): AnalyticsEvent[] {
  return getAnalyticsQueue();
}

// ============================================
// Tour-specific tracking functions
// ============================================

/**
 * Track when the onboarding tour starts
 */
export async function trackTourStarted(): Promise<void> {
  await trackEvent(TOUR_EVENTS.STARTED, {
    source: 'auto' as const,
  });
}

/**
 * Track when the onboarding tour is completed
 *
 * @param stepsCompleted - Number of steps completed
 */
export async function trackTourCompleted(stepsCompleted: number): Promise<void> {
  await trackEvent(TOUR_EVENTS.COMPLETED, {
    steps_completed: stepsCompleted,
    status: 'finished' as TourStatus,
  });
}

/**
 * Track when the onboarding tour is skipped
 *
 * @param stepIndex - Index of the step where user skipped
 */
export async function trackTourSkipped(stepIndex: number): Promise<void> {
  await trackEvent(TOUR_EVENTS.SKIPPED, {
    step_index: stepIndex,
    status: 'skipped' as TourStatus,
  });
}

/**
 * Track when a tour step is viewed
 *
 * @param stepIndex - Index of the step being viewed
 * @param stepTarget - DOM selector target of the step
 */
export async function trackStepViewed(
  stepIndex: number,
  stepTarget: string
): Promise<void> {
  await trackEvent(TOUR_EVENTS.STEP_VIEWED, {
    step_index: stepIndex,
    step_target: stepTarget,
  });
}

/**
 * Create a tour analytics event object (for external use)
 *
 * @param eventName - Name of the tour event
 * @param data - Additional event data
 */
export function createTourAnalyticsEvent(
  eventName: TourEventName,
  data?: Partial<TourAnalyticsEvent>
): TourAnalyticsEvent {
  return {
    event_name: eventName,
    timestamp: new Date().toISOString(),
    ...data,
  };
}
