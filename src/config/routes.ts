/**
 * Centralized route configuration
 *
 * Update HOME_PAGE here to change where all "home" navigations redirect.
 * This single source of truth ensures consistent navigation across the app.
 */

export const ROUTES = {
  /** The main landing page for authenticated users */
  HOME_PAGE: '/v1/start-here',

  /** Authentication page */
  AUTH: '/auth',

  /** Free diagnostic assessment */
  FREE_DIAGNOSTIC: '/free-diagnostic',

  /** Diagnostic results page */
  DIAGNOSTIC_RESULTS: '/diagnostic-results',

  /** Brand Copy Generator */
  COPY_GENERATOR: '/copy-generator',
} as const;

/**
 * V1 Routes - Legacy routes with /v1 prefix
 * All legacy application routes are namespaced under /v1/* to separate from V2 experience
 */
export const V1_ROUTES = {
  /** V1 start page */
  START_HERE: '/v1/start-here',

  /** V1 journey page */
  JOURNEY: '/v1/journey',

  /** V1 diagnostic assessment */
  DIAGNOSTIC: '/v1/diagnostic',

  /** V1 diagnostic results */
  DIAGNOSTIC_RESULTS: '/v1/diagnostic/results',

  /** V1 dashboard */
  DASHBOARD: '/v1/dashboard',

  /** V1 brand diagnostic */
  BRAND_DIAGNOSTIC: '/v1/brand-diagnostic',

  /** V1 IDEA diagnostic */
  IDEA_DIAGNOSTIC: '/v1/idea-diagnostic',

  /** V1 IDEA framework */
  IDEA: '/v1/idea',

  /** V1 IDEA consultant */
  IDEA_CONSULTANT: '/v1/idea/consultant',

  /** V1 IDEA insight */
  IDEA_INSIGHT: '/v1/idea/insight',

  /** V1 IDEA distinctive */
  IDEA_DISTINCTIVE: '/v1/idea/distinctive',

  /** V1 IDEA empathy */
  IDEA_EMPATHY: '/v1/idea/empathy',

  /** V1 IDEA authenticity */
  IDEA_AUTHENTICITY: '/v1/idea/authenticity',

  /** V1 avatar builder */
  AVATAR: '/v1/avatar',

  /** V1 brand canvas */
  CANVAS: '/v1/canvas',

  /** V1 copy generator */
  COPY_GENERATOR: '/v1/copy-generator',

  /** V1 research learning */
  RESEARCH_LEARNING: '/v1/research-learning',

  /** V1 conversation history */
  CONVERSATIONS: '/v1/conversations',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type V1RouteKey = keyof typeof V1_ROUTES;
