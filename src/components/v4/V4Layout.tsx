/**
 * V4Layout — RETIRED. /v5 is the canonical logged-in surface (product decision
 * 2026-07-06: the /v4 spine is no longer accessible). This shell is now a hard
 * redirect: because every /v4/* spine route renders through this parent route
 * element, returning <Navigate> here intercepts the whole subtree
 * (/v4, /v4/start, /v4/connect, /v4/diagnose, /v4/analyse, /v4/fix,
 * /v4/remeasure, /v4/defend) in one place.
 *
 * The former shell (sidebar + spine stepper + coach widget + Outlet) and the
 * stage pages remain in the tree, unrouted, for an easy revert if we bring a
 * fuller surface back in Gen 2.
 */
import { Navigate } from 'react-router-dom';

export function V4Layout(): JSX.Element {
  return <Navigate to="/v5" replace />;
}
