/**
 * useCompetitorInsights Hook
 *
 * Wires the Competitor-Agents feature into React: run a grounded, IDEA-scored
 * competitor analysis for one brand asset / funnel touchpoint and read back the
 * persisted insights.
 *
 * The plan (ST-3) says "wire into useFunnelTracker", but the funnel-tracker base
 * (`useFunnelTracker.ts`) is not on this branch (see _BUILD_MANIFEST §0 HALT), so
 * this is the standalone hook the manifest prescribes as the realistic
 * alternative. It consumes ICompetitorInsightsService via ServiceProvider, keeps
 * loading/error state, surfaces sonner toasts, and fires the PostHog
 * `funnel_competitor_analysis_*` events (counts/booleans/IDs/scores only).
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useServices } from '@/services/ServiceProvider';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { isCompetitorAgentsEnabled } from '@/config/features';
import type {
  AnalyzeCompetitorsRequest,
  CompetitorAnalysisResult,
  BrandAssetCompetitiveInsight,
  DraftCountermeasureRequest,
  DraftCountermeasureResult,
  RecordTestRequest,
  BrandTest,
} from '@/types/competitorInsights';

export interface UseCompetitorInsightsResult {
  /** Most recent analysis run result (live competitors + strategic angle). */
  analysis: CompetitorAnalysisResult | null;
  /** Persisted insights read back for the current asset (newest first). */
  insights: BrandAssetCompetitiveInsight[];
  /** Most recent drafted countermeasure (rewrite), or null. */
  countermeasure: DraftCountermeasureResult | null;
  /** Recorded brand tests for the current avatar (newest first). */
  brandTests: BrandTest[];
  /** True while an analysis run is in flight. */
  isAnalyzing: boolean;
  /** True while a countermeasure rewrite is in flight. */
  isDrafting: boolean;
  /** True while a test is being recorded. */
  isRecordingTest: boolean;
  /** True while persisted insights are loading. */
  isLoading: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Run a competitor analysis; returns the result (or null on failure). */
  analyzeCompetitors: (
    request: AnalyzeCompetitorsRequest,
  ) => Promise<CompetitorAnalysisResult | null>;
  /** Load persisted insights for an asset. */
  loadInsights: (assetId: string) => Promise<void>;
  /** Draft a countermeasure rewrite from a competitor brief (ST-4). */
  draftCountermeasure: (
    request: DraftCountermeasureRequest,
  ) => Promise<DraftCountermeasureResult | null>;
  /** Compose + record a competitor-informed A/B test into brand_tests (ST-4). */
  recordTest: (request: RecordTestRequest) => Promise<BrandTest | null>;
  /** Load recorded brand tests for an avatar. */
  loadBrandTests: (avatarId: string) => Promise<void>;
}

export function useCompetitorInsights(): UseCompetitorInsightsResult {
  const { competitorInsightsService } = useServices();

  const [analysis, setAnalysis] = useState<CompetitorAnalysisResult | null>(null);
  const [insights, setInsights] = useState<BrandAssetCompetitiveInsight[]>([]);
  const [countermeasure, setCountermeasure] = useState<DraftCountermeasureResult | null>(null);
  const [brandTests, setBrandTests] = useState<BrandTest[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isRecordingTest, setIsRecordingTest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const analyzeCompetitors = useCallback(
    async (request: AnalyzeCompetitorsRequest): Promise<CompetitorAnalysisResult | null> => {
      // COMPETITOR_AGENTS gate: never reach the edge function while disabled.
      if (!isCompetitorAgentsEnabled()) return null;
      setIsAnalyzing(true);
      setError(null);

      // Counts/booleans/IDs/scores only — never free text or PII.
      captureAlphaEvent('funnel_competitor_analysis_run', {
        touchpoint_id: request.touchpointId,
        modality: request.modality ?? 'marketplace-listing',
        has_asin: Boolean(request.asin),
        has_category: Boolean(request.category),
      });

      const { data, error: serviceError } = await competitorInsightsService.analyzeCompetitors(request);

      if (!isMountedRef.current) return data;

      if (serviceError || !data) {
        const message = serviceError?.message ?? 'Unable to analyze competitors right now.';
        setError(message);
        toast.error(message);
        setIsAnalyzing(false);
        return null;
      }

      setAnalysis(data);

      if (data.needsInput) {
        // Grounding gate: nothing to score. Tell the user what is missing.
        toast.message('More input needed to analyze competitors.', {
          description: data.needsInput[0]?.question,
        });
      } else if (data.competitors.length === 0) {
        toast.message('No grounded competitors were found for this touchpoint.');
      } else {
        captureAlphaEvent('funnel_competitor_analysis_viewed', {
          touchpoint_id: request.touchpointId,
          modality: request.modality ?? 'marketplace-listing',
          competitor_count: data.competitors.length,
          grounding: data.grounding,
          has_strategic_angle: Boolean(data.strategicAngle),
          persisted: Boolean(data.insightId),
        });
        toast.success(`Analyzed ${data.competitors.length} competitor(s).`);
        // Refresh persisted insights so the asset view reflects the new run.
        if (data.insightId) void loadInsights(request.assetId);
      }

      setIsAnalyzing(false);
      return data;
    },
    // loadInsights is stable (useCallback below); referenced after declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitorInsightsService],
  );

  const loadInsights = useCallback(
    async (assetId: string): Promise<void> => {
      if (!isCompetitorAgentsEnabled()) return;
      setIsLoading(true);
      setError(null);

      const { data, error: serviceError } = await competitorInsightsService.getCompetitiveInsights(assetId);

      if (!isMountedRef.current) return;

      if (serviceError) {
        const message = serviceError.message ?? 'Failed to load competitive insights.';
        setError(message);
      } else {
        setInsights(data ?? []);
      }

      setIsLoading(false);
    },
    [competitorInsightsService],
  );

  // ── P4 lift loop ───────────────────────────────────────────────────────────

  const draftCountermeasure = useCallback(
    async (request: DraftCountermeasureRequest): Promise<DraftCountermeasureResult | null> => {
      if (!isCompetitorAgentsEnabled()) return null;
      setIsDrafting(true);
      setError(null);

      const { data, error: serviceError } = await competitorInsightsService.draftCountermeasure(request);

      if (!isMountedRef.current) return data;

      if (serviceError || !data) {
        const message = serviceError?.message ?? 'Unable to draft a countermeasure right now.';
        setError(message);
        toast.error(message);
        setIsDrafting(false);
        return null;
      }

      setCountermeasure(data);
      // Counts/booleans/IDs only — never the rewrite copy or any free text.
      captureAlphaEvent('funnel_competitor_countermeasure_drafted', {
        touchpoint_id: request.touchpointId ?? null,
        has_strategic_angle: Boolean(request.competitorBrief.strategic_angle),
        has_gap: Boolean(request.competitorBrief.gap_to_our_avatar),
      });
      toast.success('Drafted a countermeasure rewrite.');
      setIsDrafting(false);
      return data;
    },
    [competitorInsightsService],
  );

  const recordTest = useCallback(
    async (request: RecordTestRequest): Promise<BrandTest | null> => {
      if (!isCompetitorAgentsEnabled()) return null;
      setIsRecordingTest(true);
      setError(null);

      const { data, error: serviceError } = await competitorInsightsService.recordTest(request);

      if (!isMountedRef.current) return data;

      if (serviceError || !data) {
        const message = serviceError?.message ?? 'Unable to record the test right now.';
        setError(message);
        toast.error(message);
        setIsRecordingTest(false);
        return null;
      }

      // Counts/booleans/IDs only — never the variant copy.
      captureAlphaEvent('funnel_competitor_test_recorded', {
        touchpoint_id: data.touchpoint_id,
        competitor_insight_applied: data.competitor_insight_applied,
        variant_count: data.variants.length,
        has_competitive_insight: Boolean(data.competitive_insight_id),
      });
      toast.success('Recorded the A/B test.');
      // Refresh the test list so the Testing & Lift surface reflects the new row.
      void loadBrandTests(request.avatarId);
      setIsRecordingTest(false);
      return data;
    },
    // loadBrandTests is stable (useCallback below); referenced after declaration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [competitorInsightsService],
  );

  const loadBrandTests = useCallback(
    async (avatarId: string): Promise<void> => {
      if (!isCompetitorAgentsEnabled()) return;
      const { data, error: serviceError } = await competitorInsightsService.getBrandTests(avatarId);

      if (!isMountedRef.current) return;

      if (serviceError) {
        setError(serviceError.message ?? 'Failed to load brand tests.');
      } else {
        setBrandTests(data ?? []);
      }
    },
    [competitorInsightsService],
  );

  return {
    analysis,
    insights,
    countermeasure,
    brandTests,
    isAnalyzing,
    isDrafting,
    isRecordingTest,
    isLoading,
    error,
    analyzeCompetitors,
    loadInsights,
    draftCountermeasure,
    recordTest,
    loadBrandTests,
  };
}
