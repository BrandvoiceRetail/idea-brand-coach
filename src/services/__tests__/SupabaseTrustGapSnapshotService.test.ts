import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SupabaseTrustGapSnapshotService,
  buildAvatarDriftFeed,
  buildCompetitivePressureFeed,
  computeCompositeScore,
  stubAssetHistoryReader,
} from '../SupabaseTrustGapSnapshotService';
import { supabase } from '@/integrations/supabase/client';
import type { AssetHistoryReader } from '../interfaces/ITrustGapSnapshotService';
import type { CompetitorEntry } from '@/types/competitorInsights';
import type { DecisionTriggerHealthFeed } from '@/types/brandDefense';

/* eslint-disable @typescript-eslint/no-explicit-any */

const competitor = (overrides: Partial<CompetitorEntry> = {}): CompetitorEntry => ({
  name: 'Acme',
  url: null,
  idea_scores: { i: 80, d: 80, e: 80, a: 80 },
  rationale: 'strong',
  gap_to_our_avatar: 'gap',
  evidence_refs: [{ kind: 'listing', ref: 'asin:X' }],
  ...overrides,
});

describe('SupabaseTrustGapSnapshotService — pure scoring', () => {
  describe('buildAvatarDriftFeed (STUB)', () => {
    it('returns a neutral placeholder flagged signal:stub (never a measurement)', () => {
      const feed = buildAvatarDriftFeed();
      expect(feed.signal).toBe('stub');
      expect(feed.score).toBe(100);
      expect(feed.drifted_fields).toEqual([]);
      expect(feed.detail).toContain('not yet built');
    });
  });

  describe('buildCompetitivePressureFeed (grounded in insights)', () => {
    it('returns full health (100) when there are no competitors', () => {
      const feed = buildCompetitivePressureFeed([]);
      expect(feed.score).toBe(100);
      expect(feed.competitor_count).toBe(0);
      expect(feed.top_gap).toBeNull();
    });

    it('inverts average competitor strength into pressure (stronger = lower score)', () => {
      const feed = buildCompetitivePressureFeed([
        { competitors: [competitor()], strategic_angle: 'Own the ritual.' },
      ]);
      // Each pillar 80 → overall 80 → pressure score 100-80 = 20.
      expect(feed.avg_competitor_strength).toBe(80);
      expect(feed.score).toBe(20);
      expect(feed.competitor_count).toBe(1);
      expect(feed.insight_count).toBe(1);
      // top_gap is grounded in the persisted strategic_angle (not synthesized).
      expect(feed.top_gap).toBe('Own the ritual.');
    });

    it('counts competitors across multiple insights', () => {
      const feed = buildCompetitivePressureFeed([
        { competitors: [competitor(), competitor()], strategic_angle: null },
        { competitors: [competitor({ idea_scores: { i: 40, d: 40, e: 40, a: 40 } })], strategic_angle: 'B' },
      ]);
      expect(feed.competitor_count).toBe(3);
      expect(feed.insight_count).toBe(2);
      // top_gap skips the null angle and uses the first non-empty one.
      expect(feed.top_gap).toBe('B');
    });
  });

  describe('computeCompositeScore', () => {
    it('averages the three feeds and clamps to 0-100', () => {
      const drift = buildAvatarDriftFeed(); // 100
      const dt: DecisionTriggerHealthFeed = { score: 70, pass: 7, needs_work: 2, fail: 1, total: 10, source: 'asset-ledger' };
      const pressure = buildCompetitivePressureFeed([{ competitors: [competitor()], strategic_angle: null }]); // 20
      // (100 + 70 + 20) / 3 = 63.33 → 63
      expect(computeCompositeScore(drift, dt, pressure)).toBe(63);
    });
  });

  describe('stubAssetHistoryReader', () => {
    it('reports source:unavailable with zeroed counts (never fabricated)', async () => {
      const feed = await stubAssetHistoryReader.getDecisionTriggerHealth('a-1');
      expect(feed.source).toBe('unavailable');
      expect(feed.total).toBe(0);
      expect(feed.pass).toBe(0);
    });
  });
});

describe('SupabaseTrustGapSnapshotService — captureSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls up the three feeds and persists a snapshot', async () => {
    // Route .from() by table name: read insights, then insert the snapshot.
    const insightsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          { competitors: [competitor()], strategic_angle: 'Own the ritual.' },
        ],
        error: null,
      }),
    });
    const snapshotSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'snap-1',
        avatar_id: 'a-1',
        captured_at: '2026-06-18T00:00:00Z',
        avatar_drift: buildAvatarDriftFeed(),
        decision_trigger_health: { score: 100, pass: 0, needs_work: 0, fail: 0, total: 0, source: 'unavailable' },
        competitive_pressure: buildCompetitivePressureFeed([{ competitors: [competitor()], strategic_angle: 'Own the ritual.' }]),
        composite_score: 73,
        created_at: '2026-06-18T00:00:00Z',
      },
      error: null,
    });
    const snapshotInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: snapshotSingle }) });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'brand_asset_competitive_insights') return { select: insightsSelect } as any;
      if (table === 'trust_gap_snapshots') return { insert: snapshotInsert } as any;
      throw new Error(`unexpected table ${table}`);
    });

    const service = new SupabaseTrustGapSnapshotService();
    const { data, error } = await service.captureSnapshot('a-1');

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe('snap-1');
    // The inserted row carried a rolled-up composite + grounded pressure feed.
    const inserted = snapshotInsert.mock.calls[0][0];
    expect(inserted.avatar_id).toBe('a-1');
    expect(inserted.avatar_drift.signal).toBe('stub');
    expect(inserted.competitive_pressure.competitor_count).toBe(1);
    expect(inserted.composite_score).toBeGreaterThanOrEqual(0);
    expect(inserted.composite_score).toBeLessThanOrEqual(100);
  });

  it('uses an injected asset-history reader for the DT-health feed', async () => {
    const reader: AssetHistoryReader = {
      getDecisionTriggerHealth: vi.fn().mockResolvedValue({
        score: 60, pass: 6, needs_work: 3, fail: 1, total: 10, source: 'asset-ledger',
      } as DecisionTriggerHealthFeed),
    };

    const insightsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const snapshotInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'snap-2', avatar_id: 'a-1', captured_at: 't', composite_score: 0, created_at: 't' }, error: null }),
      }),
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'brand_asset_competitive_insights') return { select: insightsSelect } as any;
      if (table === 'trust_gap_snapshots') return { insert: snapshotInsert } as any;
      throw new Error(`unexpected table ${table}`);
    });

    const service = new SupabaseTrustGapSnapshotService(reader);
    await service.captureSnapshot('a-1');

    expect(reader.getDecisionTriggerHealth).toHaveBeenCalledWith('a-1');
    const inserted = snapshotInsert.mock.calls[0][0];
    expect(inserted.decision_trigger_health.source).toBe('asset-ledger');
    expect(inserted.decision_trigger_health.score).toBe(60);
  });

  it('returns an error result (never throws) when the insert fails', async () => {
    const insightsSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const snapshotInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) }),
    });
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'brand_asset_competitive_insights') return { select: insightsSelect } as any;
      return { insert: snapshotInsert } as any;
    });

    const service = new SupabaseTrustGapSnapshotService();
    const { data, error } = await service.captureSnapshot('a-1');
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
