/**
 * PostHog funnel event names for the Loop-3 Fix & Test surface (FixTestPanel).
 * Lives in its own module so the component file only exports components — keeps
 * react-refresh fast-refresh working (see react-refresh/only-export-components)
 * while tests can still import the names. Every name is registered in the
 * `AlphaEventName` union in src/lib/posthogClient.ts (no casts).
 */
export const FIX_TEST_EVENTS = {
  VIEWED: 'v4_fix_test_viewed',
  REWRITE_REQUESTED: 'v4_fix_rewrite_requested',
  CLAIM_CONFIRMED: 'v4_fix_variant_claim_confirmed',
  TEST_OPENED: 'v4_fix_test_opened',
  COACH_OPENED: 'v4_fix_coach_opened',
} as const;

export type FixTestEvent = (typeof FIX_TEST_EVENTS)[keyof typeof FIX_TEST_EVENTS];
