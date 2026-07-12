/**
 * BetaNavigationWidget — RETIRED 2026-07-07 (renders nothing).
 *
 * This navigated the v1-era guided beta journey (watch intro videos, /avatar,
 * /dashboard, /beta-journey step tracking) which predates the /v5 flow. Its
 * floating pills + "Beta Testing Feedback" overlay were resurrected on every
 * page — including /auth — for anyone with a stale `betaProgress` in
 * localStorage (any session counts, even anonymous), stacking a second
 * feedback UI on top of the current BetaFeedbackWidget and advertising a dead
 * journey. Feedback now goes through BetaFeedbackWidget (works signed-out).
 *
 * The mount points (Layout, Auth, FreeDiagnostic, DiagnosticResults) are left
 * in place calling this stub so a guided journey can return in Gen 2 by
 * restoring the previous implementation from git history.
 */
export function BetaNavigationWidget(): null {
  return null;
}
