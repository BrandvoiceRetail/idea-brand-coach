/**
 * Release-stage — the single source of truth for the app's lifecycle stage.
 *
 * ONE version-agnostic axis (`alpha` → `beta` → `ga`) that both the surface gate
 * (VersionGate/Auth force everyone into the single customer surface until GA) and
 * the FEATURES registry (a feature turns on once the app reaches its `stage`) read.
 * Replaces the two stale, overlapping flags it supersedes:
 *   - `VITE_FORCE_V4`      (surface force — went stale the moment /v5 shipped)
 *   - `VITE_DEPLOYMENT_PHASE` P0/P1/P2 (feature gating — opaque phase codes)
 *
 * FAIL-FORWARD default: an env-less build resolves to `'alpha'`, which forces the
 * single surface + P0-equivalent features — matching prod. There is no default
 * that ships the deprecated v1/v2 chooser, so the old "forgot the flag → wrong
 * surface" footgun cannot recur.
 *
 * Naming note: values are the lowercase strings `'alpha'|'beta'|'ga'` (consistent
 * with the existing "alpha surface" / alpha-instrumentation usage). Do NOT add a
 * symbol literally named `Alpha*` — that namespace belongs to
 * `src/lib/posthogClient.ts` (`AlphaEventName` / `captureAlphaEvent`).
 */

export type ReleaseStage = 'alpha' | 'beta' | 'ga';

const STAGE_RANK: Record<ReleaseStage, number> = { alpha: 0, beta: 1, ga: 2 };

/** Resolve the app's release stage from the build env. Unset/invalid → `'alpha'`. */
export function getReleaseStage(): ReleaseStage {
  const raw = import.meta.env.VITE_RELEASE_STAGE as string | undefined;
  return raw === 'beta' || raw === 'ga' ? raw : 'alpha';
}

/** The current app release stage (evaluated once at module load). */
export const CURRENT_STAGE: ReleaseStage = getReleaseStage();

/** Pure comparator: is `stage` at or past `min`? (Used to gate an arbitrary feature's stage.) */
export function isStageAtLeast(stage: ReleaseStage, min: ReleaseStage): boolean {
  return STAGE_RANK[stage] >= STAGE_RANK[min];
}

/** Convenience: is the CURRENT stage at or past `min`? */
export function isAtLeastStage(min: ReleaseStage): boolean {
  return isStageAtLeast(CURRENT_STAGE, min);
}

/**
 * Whether the app should force every user into the single customer surface.
 * True in every pre-GA stage (alpha and beta); false at GA.
 *
 * GA follow-up: at `'ga'` the surface gate falls through to the legacy v1/v2
 * chooser branch, which is deprecated per surface.ts / ADR-APP-VS-MCP-SURFACE D5.
 * That branch's removal belongs with D5 — do not re-introduce it by flipping GA
 * before the legacy routes are gone.
 */
export function isPreGa(): boolean {
  return CURRENT_STAGE !== 'ga';
}
