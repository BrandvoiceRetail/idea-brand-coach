/**
 * SupabaseTrustGapSnapshotService (Competitor-Agents P6 — Track B)
 *
 * Implements ITrustGapSnapshotService against Supabase. Rolls up three feeds
 * into one avatar-scoped brand-defense snapshot:
 *   1. avatar-accuracy drift — best-effort; STUBBED (no drift detector on this
 *      branch). Marked signal:'stub' so it is never read as a measurement.
 *   2. Decision-Trigger health — from the asset-ledger pass/needs-work/fail
 *      history via the injectable AssetHistoryReader (the getAssetHistory read).
 *      Defaults to a stub reader returning source:'unavailable'.
 *   3. competitive pressure — derived from the REAL
 *      brand_asset_competitive_insights rows for the avatar (grounded, not invented).
 *
 * Follows the service-layer Result pattern (`{ data, error }`, never throws) and
 * the boundary-cast pattern from SupabaseCompetitorInsightsService.
 *
 * NOTE: trust_gap_snapshots / brand_asset_competitive_insights are not in the
 * generated supabase types yet (migrations unapplied to prod), so the `.from(...)`
 * builders are cast at the boundary. // TODO(types-regen)
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import { supabase } from '@/integrations/supabase/client';
import type { CompetitorInsightsResult } from './interfaces/ICompetitorInsightsService';
import type {
  ITrustGapSnapshotService,
  AssetHistoryReader,
} from './interfaces/ITrustGapSnapshotService';
import type {
  TrustGapSnapshot,
  AvatarDriftFeed,
  DecisionTriggerHealthFeed,
  CompetitivePressureFeed,
} from '@/types/brandDefense';
import type { CompetitorEntry, IdeaScores } from '@/types/competitorInsights';

/** Clamp a number into the 0-100 band and round to an integer. */
function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Sum of an IDEA score object (each pillar 0-100 in the insights schema → 0-400). */
function ideaOverall(scores: IdeaScores | undefined): number {
  if (!scores) return 0;
  // Each pillar 0-100 in the competitor schema; average to a 0-100 overall.
  return clampScore((scores.i + scores.d + scores.e + scores.a) / 4);
}

/**
 * The avatar-accuracy drift feed. STUBBED: no drift detector exists on this
 * branch, so this returns a neutral placeholder marked signal:'stub' — never a
 * fabricated measurement.
 * TODO(competitor-agents:avatar-drift): replace with a real drift signal.
 */
export function buildAvatarDriftFeed(): AvatarDriftFeed {
  return {
    score: 100,
    signal: 'stub',
    detail:
      'Avatar-accuracy drift detection is not yet built on this branch. This is a neutral placeholder, not a measurement.',
    drifted_fields: [],
  };
}

/**
 * Roll competitor insights into a competitive-pressure feed. GROUNDED in the
 * persisted brand_asset_competitive_insights rows: counts and strengths come
 * from the rows, never invented. Pressure score is the inverse of the average
 * competitor strength (stronger competitors = more pressure = lower score).
 */
export function buildCompetitivePressureFeed(
  insights: Array<{ competitors: CompetitorEntry[]; strategic_angle: string | null }>,
): CompetitivePressureFeed {
  const allCompetitors = insights.flatMap((i) => (Array.isArray(i.competitors) ? i.competitors : []));
  const competitorCount = allCompetitors.length;

  if (competitorCount === 0) {
    return {
      score: 100,
      competitor_count: 0,
      insight_count: insights.length,
      avg_competitor_strength: 0,
      top_gap: null,
    };
  }

  const avgStrength = clampScore(
    allCompetitors.reduce((sum, c) => sum + ideaOverall(c.idea_scores), 0) / competitorCount,
  );

  // Most-cited gap: the first non-empty strategic angle (grounded, not synthesized).
  const topGap = insights.find((i) => i.strategic_angle && i.strategic_angle.trim())?.strategic_angle ?? null;

  return {
    // Higher competitor strength → more pressure → lower health score.
    score: clampScore(100 - avgStrength),
    competitor_count: competitorCount,
    insight_count: insights.length,
    avg_competitor_strength: avgStrength,
    top_gap: topGap,
  };
}

/**
 * Roll the three feeds into a 0-100 composite (higher = healthier). Even weight
 * across the three feeds; the avatar-drift stub contributes its neutral 100 so
 * it does not skew the score before a real detector exists.
 */
export function computeCompositeScore(
  drift: AvatarDriftFeed,
  dt: DecisionTriggerHealthFeed,
  pressure: CompetitivePressureFeed,
): number {
  return clampScore((drift.score + dt.score + pressure.score) / 3);
}

/**
 * Default Decision-Trigger health reader: a clearly-marked stub. The canonical
 * pass/needs-work/fail history lives in the IV-OS ledger reached via the
 * server-side MCP get_asset_history read, which is not reachable from this
 * browser service. Returns source:'unavailable' (never a fabricated count).
 * TODO(competitor-agents:dt-asset-ledger): inject a reader backed by the IV-OS
 * get_asset_history read once the cross-server boundary (D5) lands.
 */
export const stubAssetHistoryReader: AssetHistoryReader = {
  async getDecisionTriggerHealth(): Promise<DecisionTriggerHealthFeed> {
    return {
      score: 100,
      pass: 0,
      needs_work: 0,
      fail: 0,
      total: 0,
      source: 'unavailable',
    };
  },
};

export class SupabaseTrustGapSnapshotService implements ITrustGapSnapshotService {
  private readonly assetHistory: AssetHistoryReader;

  constructor(assetHistory: AssetHistoryReader = stubAssetHistoryReader) {
    this.assetHistory = assetHistory;
  }

  async captureSnapshot(avatarId: string): Promise<CompetitorInsightsResult<TrustGapSnapshot>> {
    try {
      // Feed 1 — avatar drift (stub).
      const avatarDrift = buildAvatarDriftFeed();

      // Feed 2 — Decision-Trigger health (asset-ledger history, via the reader).
      const decisionTriggerHealth = await this.assetHistory.getDecisionTriggerHealth(avatarId);

      // Feed 3 — competitive pressure (grounded in persisted insights).
      const insights = await this.readInsightsForAvatar(avatarId);
      const competitivePressure = buildCompetitivePressureFeed(insights);

      const compositeScore = computeCompositeScore(
        avatarDrift,
        decisionTriggerHealth,
        competitivePressure,
      );

      const insertRow = {
        avatar_id: avatarId,
        avatar_drift: avatarDrift,
        decision_trigger_health: decisionTriggerHealth,
        competitive_pressure: competitivePressure,
        composite_score: compositeScore,
      };

      // TODO(types-regen): trust_gap_snapshots is not in the generated supabase
      // types yet (migration unapplied to prod) — cast the builder at the boundary.
      const { data, error } = await (supabase
        .from('trust_gap_snapshots') as unknown as {
          insert: (r: unknown) => {
            select: (c: string) => { single: () => Promise<{ data: unknown | null; error: unknown }> };
          };
        })
        .insert(insertRow)
        .select('*')
        .single();

      if (error) {
        console.error('[TrustGapSnapshot] captureSnapshot error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      return { data: this.mapSnapshotFromDb((data ?? {}) as Record<string, unknown>), error: null };
    } catch (err) {
      console.error('[TrustGapSnapshot] captureSnapshot threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to capture a brand-defense snapshot.') };
    }
  }

  async getSnapshots(avatarId: string): Promise<CompetitorInsightsResult<TrustGapSnapshot[]>> {
    try {
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { data, error } = await (supabase
        .from('trust_gap_snapshots') as unknown as {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        })
        .select('*')
        .eq('avatar_id', avatarId)
        .order('captured_at', { ascending: false });

      if (error) {
        console.error('[TrustGapSnapshot] getSnapshots error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const rows = (data ?? []).map((row) => this.mapSnapshotFromDb(row as Record<string, unknown>));
      return { data: rows, error: null };
    } catch (err) {
      console.error('[TrustGapSnapshot] getSnapshots threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to load brand-defense snapshots.') };
    }
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Read the avatar's competitor insights (competitors + strategic_angle only). */
  private async readInsightsForAvatar(
    avatarId: string,
  ): Promise<Array<{ competitors: CompetitorEntry[]; strategic_angle: string | null }>> {
    // TODO(types-regen): table absent from generated supabase types — cast at boundary.
    const { data, error } = await (supabase
      .from('brand_asset_competitive_insights') as unknown as {
        select: (c: string) => {
          eq: (col: string, val: string) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      })
      .select('competitors, strategic_angle')
      .eq('avatar_id', avatarId);

    if (error || !data) {
      if (error) console.error('[TrustGapSnapshot] readInsightsForAvatar error:', error);
      return [];
    }
    return (data as Array<Record<string, unknown>>).map((row) => ({
      competitors: (row.competitors as CompetitorEntry[]) ?? [],
      strategic_angle: (row.strategic_angle as string | null) ?? null,
    }));
  }

  /** Map a trust_gap_snapshots row to the domain type. */
  private mapSnapshotFromDb(row: Record<string, unknown>): TrustGapSnapshot {
    return {
      id: row.id as string,
      avatar_id: row.avatar_id as string,
      captured_at: row.captured_at as string,
      avatar_drift: (row.avatar_drift as AvatarDriftFeed) ?? buildAvatarDriftFeed(),
      decision_trigger_health: (row.decision_trigger_health as DecisionTriggerHealthFeed) ?? {
        score: 0,
        pass: 0,
        needs_work: 0,
        fail: 0,
        total: 0,
        source: 'unavailable',
      },
      competitive_pressure: (row.competitive_pressure as CompetitivePressureFeed) ?? {
        score: 0,
        competitor_count: 0,
        insight_count: 0,
        avg_competitor_strength: 0,
        top_gap: null,
      },
      composite_score: (row.composite_score as number) ?? 0,
      created_at: row.created_at as string,
    };
  }
}
