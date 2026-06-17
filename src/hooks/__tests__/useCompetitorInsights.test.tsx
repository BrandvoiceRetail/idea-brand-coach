import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCompetitorInsights } from '../useCompetitorInsights';
import { useServices } from '@/services/ServiceProvider';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { CompetitorAnalysisResult } from '@/types/competitorInsights';

vi.mock('@/services/ServiceProvider');
vi.mock('@/lib/posthogClient', () => ({ captureAlphaEvent: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

// COMPETITOR_AGENTS gate (P7b). Default ENABLED for these behavioural tests; the
// off-state is covered explicitly below.
let competitorAgentsEnabled = true;
vi.mock('@/config/features', () => ({
  isCompetitorAgentsEnabled: () => competitorAgentsEnabled,
}));

const analyzeCompetitors = vi.fn();
const getCompetitiveInsights = vi.fn();
const draftCountermeasure = vi.fn();
const recordTest = vi.fn();
const getBrandTests = vi.fn();

const REQUEST = {
  assetId: 'asset-1',
  touchpointId: 'amazon_listing_copy',
  modality: 'marketplace-listing' as const,
  avatarId: 'avatar-1',
  category: 'sleep gummies',
};

const RESULT: CompetitorAnalysisResult = {
  competitors: [
    {
      name: 'Acme',
      url: null,
      idea_scores: { i: 1, d: 2, e: 3, a: 4 },
      rationale: '',
      gap_to_our_avatar: '',
      evidence_refs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
    },
  ],
  strategicAngle: 'Win on ritual.',
  grounding: 'evidence',
  evidenceRefs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
  insightId: 'insight-1',
  needsInput: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  competitorAgentsEnabled = true;
  vi.mocked(useServices).mockReturnValue({
    competitorInsightsService: {
      analyzeCompetitors,
      getCompetitiveInsights,
      draftCountermeasure,
      recordTest,
      getBrandTests,
    },
    // other services unused by this hook
  } as unknown as ReturnType<typeof useServices>);
});

describe('useCompetitorInsights', () => {
  it('fires run + viewed PostHog events on a grounded analysis', async () => {
    analyzeCompetitors.mockResolvedValue({ data: RESULT, error: null });
    getCompetitiveInsights.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.analyzeCompetitors(REQUEST);
    });

    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'funnel_competitor_analysis_run',
      expect.objectContaining({ touchpoint_id: 'amazon_listing_copy', has_category: true }),
    );
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'funnel_competitor_analysis_viewed',
      expect.objectContaining({ competitor_count: 1, grounding: 'evidence', persisted: true }),
    );
    expect(result.current.analysis).toEqual(RESULT);
  });

  it('does NOT fire the viewed event when the grounding gate returns needsInput', async () => {
    analyzeCompetitors.mockResolvedValue({
      data: { ...RESULT, competitors: [], grounding: 'inference', insightId: null, needsInput: [{ slot: 1, question: 'q', why: 'w' }] },
      error: null,
    });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.analyzeCompetitors(REQUEST);
    });

    expect(captureAlphaEvent).toHaveBeenCalledWith('funnel_competitor_analysis_run', expect.anything());
    expect(captureAlphaEvent).not.toHaveBeenCalledWith('funnel_competitor_analysis_viewed', expect.anything());
  });

  it('sets the error state and returns null when the service errors', async () => {
    analyzeCompetitors.mockResolvedValue({ data: null, error: new Error('Edge down') });

    const { result } = renderHook(() => useCompetitorInsights());

    let returned: CompetitorAnalysisResult | null = RESULT;
    await act(async () => {
      returned = await result.current.analyzeCompetitors(REQUEST);
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe('Edge down');
  });

  it('loads persisted insights for an asset', async () => {
    const insightRow = {
      id: 'insight-1',
      avatar_id: 'avatar-1',
      asset_id: 'asset-1',
      modality: 'marketplace-listing',
      competitors: RESULT.competitors,
      strategic_angle: 'Win on ritual.',
      status: 'completed' as const,
      analyzed_at: '2026-06-18T00:00:00Z',
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    };
    getCompetitiveInsights.mockResolvedValue({ data: [insightRow], error: null });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.loadInsights('asset-1');
    });

    await waitFor(() => expect(result.current.insights).toHaveLength(1));
    expect(result.current.insights[0].id).toBe('insight-1');
  });

  // ── P4 lift loop ─────────────────────────────────────────────────────────────

  it('drafts a countermeasure and fires the drafted event (counts/booleans only)', async () => {
    draftCountermeasure.mockResolvedValue({
      data: { rewrite: 'New copy.', angleNote: 'Leads with ritual.' },
      error: null,
    });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.draftCountermeasure({
        touchpointId: 'amazon_listing_copy',
        competitorBrief: { strategic_angle: 'Own the ritual.', gap_to_our_avatar: 'dosage gap' },
      });
    });

    expect(result.current.countermeasure).toEqual({ rewrite: 'New copy.', angleNote: 'Leads with ritual.' });
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'funnel_competitor_countermeasure_drafted',
      expect.objectContaining({ touchpoint_id: 'amazon_listing_copy', has_strategic_angle: true, has_gap: true }),
    );
  });

  it('records a competitor-informed test, fires the recorded event, and refreshes the list', async () => {
    const recordedTest = {
      id: 'test-1',
      avatar_id: 'avatar-1',
      asset_id: 'asset-1',
      competitive_insight_id: 'insight-1',
      touchpoint_id: 'amazon_listing_copy',
      name: 'Countermeasure',
      hypothesis: null,
      channel: 'amazon',
      primary_metric: 'unit_session_percentage',
      variants: [
        { variant_id: 'A', label: 'Baseline', content: 'Old', traffic_share: 50 },
        { variant_id: 'B', label: 'Competitor-informed rewrite', content: 'New', traffic_share: 50 },
      ],
      baseline_value: null,
      result_value: null,
      status: 'draft' as const,
      competitor_insight_applied: true,
      created_at: '2026-06-18T00:00:00Z',
      updated_at: '2026-06-18T00:00:00Z',
    };
    recordTest.mockResolvedValue({ data: recordedTest, error: null });
    getBrandTests.mockResolvedValue({ data: [recordedTest], error: null });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.recordTest({
        avatarId: 'avatar-1',
        assetId: 'asset-1',
        competitiveInsightId: 'insight-1',
        touchpointId: 'amazon_listing_copy',
        name: 'Countermeasure',
        baselineCopy: 'Old',
        rewriteCopy: 'New',
        channel: 'amazon',
      });
    });

    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'funnel_competitor_test_recorded',
      expect.objectContaining({ competitor_insight_applied: true, variant_count: 2, has_competitive_insight: true }),
    );
    expect(getBrandTests).toHaveBeenCalledWith('avatar-1');
    await waitFor(() => expect(result.current.brandTests).toHaveLength(1));
  });

  it('sets error and returns null when recordTest fails', async () => {
    recordTest.mockResolvedValue({ data: null, error: new Error('RLS denied') });

    const { result } = renderHook(() => useCompetitorInsights());

    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.recordTest({
        avatarId: 'avatar-1',
        name: 'n',
        baselineCopy: 'A',
        rewriteCopy: 'B',
      });
    });

    expect(returned).toBeNull();
    expect(result.current.error).toBe('RLS denied');
    expect(captureAlphaEvent).not.toHaveBeenCalledWith('funnel_competitor_test_recorded', expect.anything());
  });

  it('loads recorded brand tests for an avatar', async () => {
    getBrandTests.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useCompetitorInsights());

    await act(async () => {
      await result.current.loadBrandTests('avatar-1');
    });

    expect(getBrandTests).toHaveBeenCalledWith('avatar-1');
  });

  // ── COMPETITOR_AGENTS gate (P7b) ─────────────────────────────────────────────

  describe('when COMPETITOR_AGENTS is disabled', () => {
    beforeEach(() => {
      competitorAgentsEnabled = false;
    });

    it('does NOT reach the service and returns null from analyzeCompetitors', async () => {
      const { result } = renderHook(() => useCompetitorInsights());

      let returned: CompetitorAnalysisResult | null = RESULT;
      await act(async () => {
        returned = await result.current.analyzeCompetitors(REQUEST);
      });

      expect(returned).toBeNull();
      expect(analyzeCompetitors).not.toHaveBeenCalled();
      expect(captureAlphaEvent).not.toHaveBeenCalled();
    });

    it('does NOT reach the service from the read/draft/record actions', async () => {
      const { result } = renderHook(() => useCompetitorInsights());

      await act(async () => {
        await result.current.loadInsights('asset-1');
        await result.current.loadBrandTests('avatar-1');
        await result.current.draftCountermeasure({ competitorBrief: { strategic_angle: 'x' } });
        await result.current.recordTest({ avatarId: 'a', name: 'n', baselineCopy: 'A', rewriteCopy: 'B' });
      });

      expect(getCompetitiveInsights).not.toHaveBeenCalled();
      expect(getBrandTests).not.toHaveBeenCalled();
      expect(draftCountermeasure).not.toHaveBeenCalled();
      expect(recordTest).not.toHaveBeenCalled();
    });
  });
});
