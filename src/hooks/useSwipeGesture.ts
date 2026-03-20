/**
 * useSwipeGesture Hook
 *
 * Touch gesture detection for mobile interfaces. Supports swipe detection
 * in all four directions with configurable thresholds and velocities.
 * Used for mobile field review interactions.
 */

import { useRef, useCallback, RefObject } from 'react';

/**
 * Swipe direction types
 */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Swipe event details
 */
export interface SwipeEvent {
  /** Direction of the swipe */
  direction: SwipeDirection;

  /** Total distance swiped in pixels */
  distance: number;

  /** Swipe velocity in pixels per millisecond */
  velocity: number;

  /** Starting X coordinate */
  startX: number;

  /** Starting Y coordinate */
  startY: number;

  /** Ending X coordinate */
  endX: number;

  /** Ending Y coordinate */
  endY: number;

  /** Total duration of swipe in milliseconds */
  duration: number;
}

/**
 * Swipe handler callbacks
 */
export interface SwipeHandlers {
  /** Called when a swipe is detected in any direction */
  onSwipe?: (event: SwipeEvent) => void;

  /** Called for upward swipes */
  onSwipeUp?: (event: SwipeEvent) => void;

  /** Called for downward swipes */
  onSwipeDown?: (event: SwipeEvent) => void;

  /** Called for leftward swipes */
  onSwipeLeft?: (event: SwipeEvent) => void;

  /** Called for rightward swipes */
  onSwipeRight?: (event: SwipeEvent) => void;

  /** Called when touch starts */
  onTouchStart?: (event: TouchEvent) => void;

  /** Called during touch movement */
  onTouchMove?: (event: TouchEvent) => void;

  /** Called when touch ends */
  onTouchEnd?: (event: TouchEvent) => void;
}

/**
 * Configuration options for swipe detection
 */
export interface SwipeConfig {
  /** Minimum distance in pixels to register as a swipe (default: 50) */
  minDistance?: number;

  /** Maximum duration in ms for a swipe gesture (default: 500) */
  maxDuration?: number;

  /** Minimum velocity in px/ms to register as swipe (default: 0.3) */
  minVelocity?: number;

  /** Prevent default behavior on touch events (default: true) */
  preventDefault?: boolean;

  /** Stop propagation of touch events (default: false) */
  stopPropagation?: boolean;

  /** Track mouse events in addition to touch (default: false) */
  trackMouse?: boolean;
}

/**
 * Hook result with event handlers to attach to element
 */
export interface UseSwipeGestureResult {
  /** Touch event handlers to spread on the element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
  };

  /** Reference to attach to the element (alternative to spreading handlers) */
  ref: RefObject<HTMLElement>;

  /** True if currently tracking a touch/swipe */
  isTracking: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<SwipeConfig> = {
  minDistance: 50,
  maxDuration: 500,
  minVelocity: 0.3,
  preventDefault: true,
  stopPropagation: false,
  trackMouse: false,
};

/**
 * Hook for detecting swipe gestures on touch devices
 *
 * @param handlers - Callbacks for swipe events
 * @param config - Configuration options
 *
 * @example
 * ```tsx
 * const swipe = useSwipeGesture({
 *   onSwipeLeft: () => console.log('Swiped left!'),
 *   onSwipeRight: () => console.log('Swiped right!'),
 * });
 *
 * return <div {...swipe.handlers}>Swipeable content</div>;
 * ```
 */
export function useSwipeGesture(
  handlers: SwipeHandlers = {},
  config: SwipeConfig = {}
): UseSwipeGestureResult {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const ref = useRef<HTMLElement>(null);
  const trackingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleStart = useCallback(
    (x: number, y: number, event: TouchEvent | MouseEvent) => {
      trackingRef.current = true;
      startRef.current = { x, y, time: Date.now() };

      if (mergedConfig.preventDefault) {
        event.preventDefault();
      }
      if (mergedConfig.stopPropagation) {
        event.stopPropagation();
      }

      if ('touches' in event) {
        handlers.onTouchStart?.(event as TouchEvent);
      }
    },
    [handlers, mergedConfig.preventDefault, mergedConfig.stopPropagation]
  );

  const handleMove = useCallback(
    (event: TouchEvent | MouseEvent) => {
      if (!trackingRef.current) return;

      if (mergedConfig.preventDefault) {
        event.preventDefault();
      }
      if (mergedConfig.stopPropagation) {
        event.stopPropagation();
      }

      if ('touches' in event) {
        handlers.onTouchMove?.(event as TouchEvent);
      }
    },
    [handlers, mergedConfig.preventDefault, mergedConfig.stopPropagation]
  );

  const handleEnd = useCallback(
    (x: number, y: number, event: TouchEvent | MouseEvent) => {
      if (!trackingRef.current || !startRef.current) return;

      trackingRef.current = false;

      const deltaX = x - startRef.current.x;
      const deltaY = y - startRef.current.y;
      const duration = Date.now() - startRef.current.time;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Calculate velocity
      const velocity = Math.sqrt(absX * absX + absY * absY) / duration;

      // Check if it qualifies as a swipe
      if (
        duration <= mergedConfig.maxDuration &&
        velocity >= mergedConfig.minVelocity &&
        (absX >= mergedConfig.minDistance || absY >= mergedConfig.minDistance)
      ) {
        let direction: SwipeDirection;

        // Determine primary direction
        if (absX > absY) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        const swipeEvent: SwipeEvent = {
          direction,
          distance: Math.sqrt(absX * absX + absY * absY),
          velocity,
          startX: startRef.current.x,
          startY: startRef.current.y,
          endX: x,
          endY: y,
          duration,
        };

        // Call generic handler
        handlers.onSwipe?.(swipeEvent);

        // Call direction-specific handler
        switch (direction) {
          case 'up':
            handlers.onSwipeUp?.(swipeEvent);
            break;
          case 'down':
            handlers.onSwipeDown?.(swipeEvent);
            break;
          case 'left':
            handlers.onSwipeLeft?.(swipeEvent);
            break;
          case 'right':
            handlers.onSwipeRight?.(swipeEvent);
            break;
        }
      }

      if ('touches' in event) {
        handlers.onTouchEnd?.(event as TouchEvent);
      }

      startRef.current = null;
    },
    [
      handlers,
      mergedConfig.maxDuration,
      mergedConfig.minVelocity,
      mergedConfig.minDistance,
    ]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY, e.nativeEvent);
    },
    [handleStart]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleMove(e.nativeEvent);
    },
    [handleMove]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      handleEnd(touch.clientX, touch.clientY, e.nativeEvent);
    },
    [handleEnd]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mergedConfig.trackMouse) {
        handleStart(e.clientX, e.clientY, e.nativeEvent);
      }
    },
    [handleStart, mergedConfig.trackMouse]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (mergedConfig.trackMouse) {
        handleMove(e.nativeEvent);
      }
    },
    [handleMove, mergedConfig.trackMouse]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (mergedConfig.trackMouse) {
        handleEnd(e.clientX, e.clientY, e.nativeEvent);
      }
    },
    [handleEnd, mergedConfig.trackMouse]
  );

  const touchHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    ...(mergedConfig.trackMouse && {
      onMouseDown,
      onMouseMove,
      onMouseUp,
    }),
  };

  return {
    handlers: touchHandlers,
    ref,
    isTracking: trackingRef.current,
  };
}