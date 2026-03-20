/**
 * useDeviceType Hook
 *
 * Responsive device detection hook that determines the current device type
 * based on viewport width. Used for adaptive UI components that render
 * differently on mobile vs desktop.
 *
 * Breakpoints follow Tailwind CSS defaults:
 * - Mobile: < 768px (sm breakpoint)
 * - Tablet: 768px - 1024px
 * - Desktop: >= 1024px (lg breakpoint)
 */

import { useState, useEffect } from 'react';

/**
 * Device type classifications
 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Device detection result
 */
export interface UseDeviceTypeResult {
  /** Current device type */
  deviceType: DeviceType;

  /** Convenience flags */
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  /** True if mobile or tablet */
  isTouchDevice: boolean;

  /** Current viewport width */
  width: number;

  /** Current viewport height */
  height: number;
}

/**
 * Breakpoints in pixels (matching Tailwind CSS)
 */
const BREAKPOINTS = {
  SM: 640,  // Tailwind sm
  MD: 768,  // Tailwind md
  LG: 1024, // Tailwind lg
  XL: 1280, // Tailwind xl
} as const;

/**
 * Get the current device type based on window width
 */
function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.MD) {
    return 'mobile';
  } else if (width < BREAKPOINTS.LG) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Hook for responsive device detection
 *
 * @example
 * ```tsx
 * const { deviceType, isMobile } = useDeviceType();
 *
 * if (isMobile) {
 *   return <MobileLayout />;
 * } else {
 *   return <DesktopLayout />;
 * }
 * ```
 */
export function useDeviceType(): UseDeviceTypeResult {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.LG,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = (): void => {
      // Debounce resize events for performance
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    };

    // Set initial dimensions
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const deviceType = getDeviceType(dimensions.width);

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTouchDevice: deviceType === 'mobile' || deviceType === 'tablet',
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Hook to check if we're at or above a specific breakpoint
 *
 * @example
 * ```tsx
 * const isLargeScreen = useBreakpoint('lg');
 * ```
 */
export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const { width } = useDeviceType();
  return width >= BREAKPOINTS[breakpoint];
}

/**
 * Hook for media query matching
 *
 * @example
 * ```tsx
 * const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
 * const isLandscape = useMediaQuery('(orientation: landscape)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handleChange = (e: MediaQueryListEvent): void => {
      setMatches(e.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}