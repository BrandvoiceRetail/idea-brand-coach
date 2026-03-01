/**
 * Centralized route configuration
 * 
 * Update HOME_PAGE here to change where all "home" navigations redirect.
 * This single source of truth ensures consistent navigation across the app.
 */

export const ROUTES = {
  /** The main landing page for authenticated users */
  HOME_PAGE: '/start-here',

  /** Authentication page */
  AUTH: '/auth',

  /** Free diagnostic assessment */
  FREE_DIAGNOSTIC: '/free-diagnostic',

  /** Diagnostic results page */
  DIAGNOSTIC_RESULTS: '/diagnostic-results',

  /** Brand Copy Generator */
  COPY_GENERATOR: '/copy-generator',
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * V2 Routes - Two-panel responsive UI foundation
 *
 * These routes use the new TwoPanelTemplate component with optimized
 * mobile and desktop layouts.
 */
export const V2_ROUTES = {
  /** Brand Coach V2 - Two-panel chat + fields interface */
  BRAND_COACH_V2: '/v2/coach',
} as const;

export type V2RouteKey = keyof typeof V2_ROUTES;
