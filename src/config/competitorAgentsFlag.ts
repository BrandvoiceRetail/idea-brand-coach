/**
 * COMPETITOR_AGENTS feature flag — interim re-export.
 *
 * The whole Competitor-Agents surface (per-touchpoint competitor analysis, the
 * lift loop, and the Brand Defense alerts) stays behind this flag until launch.
 *
 * As of P7 (Track C — harden), the CANONICAL flag lives in
 * `src/config/features.ts` (`isCompetitorAgentsEnabled`). This module now simply
 * re-exports it so the existing consumers that import from
 * `@/config/competitorAgentsFlag` keep working unchanged — there is exactly one
 * implementation, in `features.ts`.
 *
 * Default OFF. Enabled by setting VITE_COMPETITOR_AGENTS=true at build time.
 */

export { isCompetitorAgentsEnabled } from '@/config/features';
