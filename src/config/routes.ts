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
  
  /** Brand Coach chat interface */
  BRAND_COACH: '/brand-coach',
} as const;

export type RouteKey = keyof typeof ROUTES;
