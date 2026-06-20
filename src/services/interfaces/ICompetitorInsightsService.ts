/**
 * ICompetitorInsightsService Interface
 *
 * Contract for the per-touchpoint Competitor-Agents feature: run a grounded,
 * IDEA-scored competitor analysis for one brand asset and read back the
 * persisted insights.
 *
 * The funnel-tracker base (`IBrandFunnelService`) is not on this branch, so this
 * is a standalone service modeled on `ICompetitiveAnalysisService` (edge invoke)
 * but using the `Result {data, error}` pattern (`IBrandService` precedent) so it
 * never throws across the service boundary.
 *
 * Current implementation:
 * - SupabaseCompetitorInsightsService: invokes the `competitor-analysis-asset`
 *   edge function and reads `brand_asset_competitive_insights`.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (ST-3)
 */

import type {
  AnalyzeCompetitorsRequest,
  CompetitorAnalysisResult,
  BrandAssetCompetitiveInsight,
  DraftCountermeasureRequest,
  DraftCountermeasureResult,
  RecordTestRequest,
  BrandTest,
} from '@/types/competitorInsights';

/** Service-boundary result; never throws. */
export interface CompetitorInsightsResult<T> {
  data: T | null;
  error: Error | null;
}

export interface ICompetitorInsightsService {
  /**
   * Run a grounded competitor analysis for one brand asset / touchpoint.
   * Invokes the `competitor-analysis-asset` edge function, which gathers
   * competitor evidence, scores each competitor on the IDEA Trust-Gap lens, and
   * persists the read to `brand_asset_competitive_insights`.
   *
   * Grounding gate: when no evidence can be gathered the result carries
   * `needsInput` (and an empty `competitors`) rather than a fabricated read.
   *
   * @param request - asset/touchpoint + optional discovery params + context
   * @returns Result with the analysis (never throws)
   */
  analyzeCompetitors(
    request: AnalyzeCompetitorsRequest,
  ): Promise<CompetitorInsightsResult<CompetitorAnalysisResult>>;

  /**
   * Read persisted competitive insights for a brand asset, newest first.
   *
   * @param assetId - the brand asset id
   * @returns Result with the insight rows (never throws)
   */
  getCompetitiveInsights(
    assetId: string,
  ): Promise<CompetitorInsightsResult<BrandAssetCompetitiveInsight[]>>;

  // ── P4 lift loop ───────────────────────────────────────────────────────────

  /**
   * Draft a countermeasure: route a competitor insight's `gap_to_our_avatar` +
   * `strategic_angle` (the competitor brief) into the `funnel-rewrite` edge
   * function to produce an on-brand rewrite (plan §2 step 5 / ST-4).
   *
   * @param request - the competitor brief + asset context
   * @returns Result with the rewrite (never throws)
   */
  draftCountermeasure(
    request: DraftCountermeasureRequest,
  ): Promise<CompetitorInsightsResult<DraftCountermeasureResult>>;

  /**
   * Compose the baseline vs. rewrite into an A/B test (via the shared
   * test-design composer) and record it into `brand_tests`, tagged
   * `competitor_insight_applied` for the competitor-informed lift loop (ST-4).
   *
   * @param request - test metadata + baseline/rewrite copy
   * @returns Result with the recorded test row (never throws)
   */
  recordTest(
    request: RecordTestRequest,
  ): Promise<CompetitorInsightsResult<BrandTest>>;

  /**
   * Read recorded brand tests for an avatar, newest first. Powers the
   * Testing & Lift surface (which competitor_insight_applied flag) (ST-4).
   *
   * @param avatarId - the avatar the tests are scoped to
   * @returns Result with the test rows (never throws)
   */
  getBrandTests(
    avatarId: string,
  ): Promise<CompetitorInsightsResult<BrandTest[]>>;
}
