import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseCompetitorInsightsService } from '../SupabaseCompetitorInsightsService';
import { supabase } from '@/integrations/supabase/client';
import type { AnalyzeCompetitorsRequest } from '@/types/competitorInsights';

/* eslint-disable @typescript-eslint/no-explicit-any */

const REQUEST: AnalyzeCompetitorsRequest = {
  assetId: 'asset-1',
  touchpointId: 'amazon_listing_copy',
  modality: 'marketplace-listing',
  avatarId: 'avatar-1',
  category: 'sleep gummies',
};

/** A grounded edge-function response (the happy path). */
function groundedResponse(): Record<string, unknown> {
  return {
    competitors: [
      {
        name: 'Acme Sleep',
        url: 'https://amazon.com/dp/B0TEST',
        idea_scores: { i: 60, d: 40, e: 30, a: 55 },
        rationale: 'Strong insight, weak empathy.',
        gap_to_our_avatar: 'Speaks to dosage, not to the bedtime ritual our avatar cares about.',
        evidence_refs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
      },
    ],
    strategic_angle: 'Own the bedtime ritual narrative competitors ignore.',
    grounding: 'evidence',
    evidence_refs: [{ kind: 'listing', ref: 'asin:B0TEST' }],
    insightId: 'insight-1',
  };
}

describe('SupabaseCompetitorInsightsService', () => {
  let service: SupabaseCompetitorInsightsService;

  beforeEach(() => {
    service = new SupabaseCompetitorInsightsService();
    vi.clearAllMocks();
  });

  describe('analyzeCompetitors', () => {
    it('maps a grounded edge response to the domain result', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: groundedResponse(),
        error: null,
      } as any);

      const { data, error } = await service.analyzeCompetitors(REQUEST);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data!.competitors).toHaveLength(1);
      expect(data!.competitors[0].idea_scores).toEqual({ i: 60, d: 40, e: 30, a: 55 });
      expect(data!.strategicAngle).toBe('Own the bedtime ritual narrative competitors ignore.');
      expect(data!.grounding).toBe('evidence');
      expect(data!.insightId).toBe('insight-1');
      expect(data!.needsInput).toBeNull();
    });

    it('passes the mapped (mixed-casing) body to the edge function', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: groundedResponse(),
        error: null,
      } as any);

      await service.analyzeCompetitors({ ...REQUEST, avatarContext: { foo: 'bar' } });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('competitor-analysis-asset', {
        body: expect.objectContaining({
          assetId: 'asset-1',
          touchpointId: 'amazon_listing_copy',
          avatarId: 'avatar-1',
          category: 'sleep gummies',
          avatar_context: { foo: 'bar' },
        }),
      });
    });

    it('surfaces the grounding gate as needsInput (no fabricated competitors)', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          competitors: [],
          strategic_angle: null,
          grounding: 'inference',
          evidence_refs: [],
          needs_input: [{ slot: 1, question: 'Provide a category or ASIN.', why: 'Grounding gate.' }],
        },
        error: null,
      } as any);

      const { data, error } = await service.analyzeCompetitors(REQUEST);

      expect(error).toBeNull();
      expect(data!.competitors).toHaveLength(0);
      expect(data!.grounding).toBe('inference');
      expect(data!.needsInput).toHaveLength(1);
      expect(data!.needsInput![0].question).toBe('Provide a category or ASIN.');
    });

    it('returns an error Result on edge invoke failure (never throws)', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: new Error('Edge down'),
      } as any);

      const { data, error } = await service.analyzeCompetitors(REQUEST);

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('Edge down');
    });

    it('returns an error Result when the edge body carries a JSON error', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { error: 'Unable to analyze competitors right now. Please try again.' },
        error: null,
      } as any);

      const { data, error } = await service.analyzeCompetitors(REQUEST);

      expect(data).toBeNull();
      expect(error!.message).toContain('Unable to analyze competitors');
    });
  });

  describe('getCompetitiveInsights', () => {
    it('reads and maps insight rows for an asset (newest first)', async () => {
      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'insight-1',
            avatar_id: 'avatar-1',
            asset_id: 'asset-1',
            modality: 'marketplace-listing',
            competitors: [{ name: 'Acme', url: null, idea_scores: { i: 1, d: 2, e: 3, a: 4 }, rationale: '', gap_to_our_avatar: '', evidence_refs: [] }],
            strategic_angle: 'Win on ritual.',
            status: 'completed',
            analyzed_at: '2026-06-18T00:00:00Z',
            created_at: '2026-06-18T00:00:00Z',
            updated_at: '2026-06-18T00:00:00Z',
          },
        ],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await service.getCompetitiveInsights('asset-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe('insight-1');
      expect(data![0].competitors).toHaveLength(1);
      expect(data![0].strategic_angle).toBe('Win on ritual.');
      expect(select).toHaveBeenCalledWith('*');
      expect(eq).toHaveBeenCalledWith('asset_id', 'asset-1');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns an error Result when the query fails (never throws)', async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: new Error('RLS denied') });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await service.getCompetitiveInsights('asset-1');

      expect(data).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('RLS denied');
    });

    it('returns an empty array when there are no insights', async () => {
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await service.getCompetitiveInsights('asset-1');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  // ── P4 lift loop ─────────────────────────────────────────────────────────────

  describe('draftCountermeasure', () => {
    it('routes the gap + strategic angle into funnel-rewrite and maps the rewrite', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { rewrite: 'New on-brand copy.', angle_note: 'Leads with the ritual.' },
        error: null,
      } as any);

      const { data, error } = await service.draftCountermeasure({
        touchpointId: 'amazon_listing_copy',
        currentCopy: 'Old copy.',
        competitorBrief: {
          strategic_angle: 'Own the bedtime ritual.',
          gap_to_our_avatar: 'They speak to dosage, not ritual.',
          competitor_names: ['Acme Sleep'],
        },
      });

      expect(error).toBeNull();
      expect(data!.rewrite).toBe('New on-brand copy.');
      expect(data!.angleNote).toBe('Leads with the ritual.');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('funnel-rewrite', {
        body: expect.objectContaining({
          touchpoint_id: 'amazon_listing_copy',
          current_copy: 'Old copy.',
          competitor_brief: expect.objectContaining({
            strategic_angle: 'Own the bedtime ritual.',
            gap_to_our_avatar: 'They speak to dosage, not ritual.',
          }),
        }),
      });
    });

    it('errors (never throws) when the rewrite comes back empty', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { rewrite: '   ' },
        error: null,
      } as any);

      const { data, error } = await service.draftCountermeasure({
        competitorBrief: { strategic_angle: 'x' },
      });

      expect(data).toBeNull();
      expect(error!.message).toContain('empty');
    });

    it('returns an error Result on edge invoke failure', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: new Error('Edge down'),
      } as any);

      const { data, error } = await service.draftCountermeasure({
        competitorBrief: { strategic_angle: 'x' },
      });

      expect(data).toBeNull();
      expect(error!.message).toBe('Edge down');
    });
  });

  describe('recordTest', () => {
    it('composes an A/B test and inserts it tagged competitor_insight_applied=true', async () => {
      const single = vi.fn().mockResolvedValue({
        data: {
          id: 'test-1',
          avatar_id: 'avatar-1',
          asset_id: 'asset-1',
          competitive_insight_id: 'insight-1',
          touchpoint_id: 'amazon_listing_copy',
          name: 'Countermeasure: Listing',
          hypothesis: 'h',
          channel: 'amazon',
          primary_metric: 'unit_session_percentage',
          variants: [
            { variant_id: 'A', label: 'Baseline', content: 'Old', traffic_share: 50 },
            { variant_id: 'B', label: 'Competitor-informed rewrite', content: 'New', traffic_share: 50 },
          ],
          baseline_value: null,
          result_value: null,
          status: 'draft',
          competitor_insight_applied: true,
          created_at: '2026-06-18T00:00:00Z',
          updated_at: '2026-06-18T00:00:00Z',
        },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as any);

      const { data, error } = await service.recordTest({
        avatarId: 'avatar-1',
        assetId: 'asset-1',
        competitiveInsightId: 'insight-1',
        touchpointId: 'amazon_listing_copy',
        name: 'Countermeasure: Listing',
        baselineCopy: 'Old',
        rewriteCopy: 'New',
        channel: 'amazon',
      });

      expect(error).toBeNull();
      expect(data!.id).toBe('test-1');
      expect(data!.competitor_insight_applied).toBe(true);
      expect(data!.variants).toHaveLength(2);
      // The insert row carries the P4 flag and the composed two-variant spec.
      const insertedRow = insert.mock.calls[0][0];
      expect(insertedRow.competitor_insight_applied).toBe(true);
      expect(insertedRow.variants).toHaveLength(2);
      expect(insertedRow.avatar_id).toBe('avatar-1');
    });

    it('defaults competitor_insight_applied from the presence of a competitiveInsightId', async () => {
      const single = vi.fn().mockResolvedValue({ data: { id: 'test-2', avatar_id: 'a', name: 'n', variants: [], status: 'draft', competitor_insight_applied: false, created_at: '', updated_at: '' }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as any);

      await service.recordTest({
        avatarId: 'avatar-1',
        name: 'Standard test',
        baselineCopy: 'A',
        rewriteCopy: 'B',
      });

      // No competitiveInsightId, no explicit flag -> false.
      expect(insert.mock.calls[0][0].competitor_insight_applied).toBe(false);
    });

    it('returns an error Result when the insert fails', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: new Error('RLS denied') });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      vi.mocked(supabase.from).mockReturnValue({ insert } as any);

      const { data, error } = await service.recordTest({
        avatarId: 'avatar-1',
        name: 'n',
        baselineCopy: 'A',
        rewriteCopy: 'B',
      });

      expect(data).toBeNull();
      expect(error!.message).toBe('RLS denied');
    });
  });

  describe('getBrandTests', () => {
    it('reads and maps tests for an avatar (newest first)', async () => {
      const order = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'test-1',
            avatar_id: 'avatar-1',
            asset_id: 'asset-1',
            competitive_insight_id: 'insight-1',
            touchpoint_id: 'amazon_listing_copy',
            name: 'Countermeasure',
            hypothesis: null,
            channel: 'amazon',
            primary_metric: 'unit_session_percentage',
            variants: [],
            baseline_value: 10,
            result_value: 14,
            status: 'completed',
            competitor_insight_applied: true,
            created_at: '2026-06-18T00:00:00Z',
            updated_at: '2026-06-18T00:00:00Z',
          },
        ],
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await service.getBrandTests('avatar-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].competitor_insight_applied).toBe(true);
      expect(data![0].result_value).toBe(14);
      expect(eq).toHaveBeenCalledWith('avatar_id', 'avatar-1');
      expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns an error Result when the query fails', async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: new Error('boom') });
      const eq = vi.fn().mockReturnValue({ order });
      const select = vi.fn().mockReturnValue({ eq });
      vi.mocked(supabase.from).mockReturnValue({ select } as any);

      const { data, error } = await service.getBrandTests('avatar-1');

      expect(data).toBeNull();
      expect(error!.message).toBe('boom');
    });
  });
});
