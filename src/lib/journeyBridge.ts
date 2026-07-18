/**
 * Journey bridge routing helpers (F-059).
 *
 * Deterministic, framework-free logic for the diagnostic → scorecard → bridge →
 * /v2/coach hand-off. The primary-gap is carried as a `?gap=<dimension>` query
 * param (guest-safe, survives reload and the /auth round-trip — see arch.md D1).
 *
 * Kept separate from React so the routing decisions are unit-testable, and
 * separate from trustGap.ts so the scorecard's frozen `route` metadata is not
 * touched (arch.md D6).
 */

import {
  TRUST_GAP_DIMENSIONS,
  TRUST_GAP_DIMENSION_META,
  type TrustGapDimension,
} from '@/lib/trustGap';

/** Bridge screen route (bare/guest-accessible, mirrors /v1/diagnostic/results). */
export const BRIDGE_ROUTE = '/v1/diagnostic/bridge';
/** Layer 1 chat + Positioning Statement surface. */
export const COACH_ROUTE = '/v2/coach';

/** Validate an untrusted `?gap=` value against the known dimension keys. */
export function parseGapParam(value: string | null | undefined): TrustGapDimension | null {
  if (!value) return null;
  return (TRUST_GAP_DIMENSIONS as readonly string[]).includes(value)
    ? (value as TrustGapDimension)
    : null;
}

/** CTA destination from the scorecard: the bridge, carrying the gap. */
export function buildBridgePath(gap: TrustGapDimension): string {
  return `${BRIDGE_ROUTE}?gap=${gap}`;
}

/** Coach destination carrying the gap (or the bare coach when gap is unknown). */
export function buildCoachPath(gap: TrustGapDimension | null): string {
  return gap ? `${COACH_ROUTE}?gap=${gap}` : COACH_ROUTE;
}

/**
 * Where "Build my Positioning Statement" sends the user from the bridge.
 * - authed → straight to the coach (with gap)
 * - guest  → the auth gate, with the coach path preserved as an encoded redirect
 *   so they return to the coach (with gap) after creating their free account.
 */
export function buildDeepDiveDestination(gap: TrustGapDimension | null, isAuthenticated: boolean): string {
  const coachPath = buildCoachPath(gap);
  if (isAuthenticated) return coachPath;
  return `/auth?redirect=${encodeURIComponent(coachPath)}`;
}

/**
 * Suggested first message that opens the coach conversation on the weakest pillar
 * (arch.md D5). Reuses the pillar's plain-language "measures" line so the opener
 * reads naturally in the user's voice.
 */
export function gapOpenerPrompt(gap: TrustGapDimension): string {
  const meta = TRUST_GAP_DIMENSION_META[gap];
  const focus = meta.measures.replace(/\.$/, '').toLowerCase();
  return `My biggest Trust Gap is ${meta.label}. Help me work on ${focus}.`;
}
