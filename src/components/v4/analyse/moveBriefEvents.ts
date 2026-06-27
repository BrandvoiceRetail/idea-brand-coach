/**
 * PostHog funnel event names for the Loop-2 brief + claim-gate surface
 * (MoveBriefClaimGate). Lives in its own module so the component file only
 * exports components — keeps react-refresh fast-refresh working (see
 * react-refresh/only-export-components) while tests can still import the names.
 */
export const MOVE_BRIEF_EVENTS = {
  VIEWED: 'v4_brief_claim_gate_viewed',
  CLAIM_CONFIRMED: 'v4_brief_claim_confirmed',
  EXPORTED: 'v4_brief_exported',
} as const;

export type MoveBriefEvent = (typeof MOVE_BRIEF_EVENTS)[keyof typeof MOVE_BRIEF_EVENTS];
