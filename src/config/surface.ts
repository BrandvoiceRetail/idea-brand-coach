/**
 * Surface enforcement — the single source of truth for which app surface customers see.
 *
 * WHY: `VITE_FORCE_V4` named a *specific version* (so it went stale the moment v5 shipped)
 * and only changed the default landing — it sealed nothing, which is why ~30 legacy pages
 * still leak. This module replaces that with a version-agnostic, default-deny model:
 * exactly ONE customer-facing surface; everything not on the allowlist below redirects to it.
 *
 * See docs/architecture/ADR-APP-VS-MCP-SURFACE.md (Decision 5). Enforced by
 * src/config/__tests__/surface.test.ts (fails the build on a leaked/unclassified route).
 *
 * PROMOTING A NEW SURFACE (the whole point — no more re-auditing routes each resurface):
 *   1. Point CURRENT_SURFACE at the new surface's base path.
 *   2. Move its routes into CUSTOMER_ROUTE_PREFIXES.
 *   3. DELETE the old surface's routes from App.tsx — git history is the archive, not a live /vN.
 * The CI guard then proves only the current surface is customer-reachable.
 */

/** The one customer-facing surface. Repoint this to promote a new UI (e.g. '/' once v5 moves to root). */
export const CURRENT_SURFACE = '/v5' as const;

/**
 * Route tiers (default-deny allowlist). A path not matched by any tier below is LEGACY and
 * MUST redirect to CURRENT_SURFACE. Prefix match: an entry `/v5` covers `/v5/anything`.
 */

/** Customer-facing: the current surface + the public entry/landing paths. */
export const CUSTOMER_ROUTE_PREFIXES: readonly string[] = [
  CURRENT_SURFACE, // '/v5'
  '/', // VersionGate dispatcher (resolves to CURRENT_SURFACE or /welcome)
  '/welcome', // public marketing landing
];

/** Infrastructure: public or gated, but not a "surface" (auth, legal, settings, callbacks, 404). */
export const INFRA_ROUTE_PREFIXES: readonly string[] = [
  '/auth',
  '/privacy',
  '/oauth/consent',
  '/settings',
  '/integrations/figma/callback',
];

/**
 * Internal: auth + role/flag gated, NEVER customer-reachable. Kept live for our own use
 * (recent v4 work, admin, dev/test, beta). These must sit behind an internal gate, not be
 * open to a signed-in customer.
 */
export const INTERNAL_ROUTE_PREFIXES: readonly string[] = [
  '/admin',
  '/v4',
  '/v2/coach',
  '/v2/funnel',
  '/v2/focus',
  '/test',
  // Beta is three sibling paths, not children of /beta — list each (segment-prefix
  // matching intentionally does not treat '/beta-journey' as under '/beta').
  '/beta',
  '/beta-journey',
  '/beta-feedback',
];

export type SurfaceTier = 'customer' | 'infra' | 'internal' | 'legacy';

/** Longest-prefix match against a tier's prefix list (so '/v2/coach' beats a bare '/v2'). */
function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/'),
  );
}

/**
 * Classify a route path. Default-deny: anything not explicitly allowlisted is 'legacy'
 * and must redirect to CURRENT_SURFACE. Order matters — internal is checked before the
 * broad customer/infra sets so gated surfaces win.
 */
export function classifyRoute(pathname: string): SurfaceTier {
  if (matchesPrefix(pathname, INTERNAL_ROUTE_PREFIXES)) return 'internal';
  if (matchesPrefix(pathname, CUSTOMER_ROUTE_PREFIXES)) return 'customer';
  if (matchesPrefix(pathname, INFRA_ROUTE_PREFIXES)) return 'infra';
  return 'legacy';
}

/** Whether a customer may reach this path (customer or public-infra). Internal + legacy are not customer-facing. */
export function isCustomerReachable(pathname: string): boolean {
  const tier = classifyRoute(pathname);
  return tier === 'customer' || tier === 'infra';
}
