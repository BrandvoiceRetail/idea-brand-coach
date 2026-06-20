/**
 * ITrustGapSnapshotService Interface (Competitor-Agents P6 — Track B)
 *
 * Captures and reads avatar-scoped brand-defense health snapshots. A snapshot
 * rolls up three feeds into a composite score:
 *   1. avatar-accuracy drift (best-effort; stubbed until a drift detector exists),
 *   2. Decision-Trigger health from the asset-ledger pass/needs-work/fail history
 *      (via an injectable asset-history reader — the existing getAssetHistory read),
 *   3. competitive pressure from brand_asset_competitive_insights.
 *
 * Uses the service-boundary Result pattern (`{ data, error }`, never throws),
 * matching ICompetitorInsightsService.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import type {
  TrustGapSnapshot,
  DecisionTriggerHealthFeed,
} from '@/types/brandDefense';
import type { CompetitorInsightsResult } from './ICompetitorInsightsService';

/**
 * Read seam for the Decision-Trigger health feed: the asset ledger's
 * pass/needs-work/fail history for an avatar's assets.
 *
 * The canonical ledger lives in IV-OS and is reached via the MCP
 * `get_asset_history` read (src/mcp/ivos/client.ts), which is a server-side
 * Node path — not reachable from this browser service. So the default reader is
 * a clearly-marked stub returning `source:'unavailable'`; a real reader can be
 * injected once the cross-server read boundary (D5) lands.
 * TODO(competitor-agents:dt-asset-ledger): inject a reader backed by the IV-OS
 * get_asset_history read.
 */
export interface AssetHistoryReader {
  /**
   * Return the pass/needs-work/fail counts for an avatar's graded assets.
   * Never throws; returns `source:'unavailable'` when no ledger read is wired.
   */
  getDecisionTriggerHealth(avatarId: string): Promise<DecisionTriggerHealthFeed>;
}

export interface ITrustGapSnapshotService {
  /**
   * Compute the three feeds for an avatar, roll them into a composite score, and
   * persist a trust_gap_snapshots row. Returns the persisted snapshot.
   *
   * @param avatarId - the avatar the snapshot is scoped to (RLS anchor)
   * @returns Result with the captured snapshot (never throws)
   */
  captureSnapshot(avatarId: string): Promise<CompetitorInsightsResult<TrustGapSnapshot>>;

  /**
   * Read persisted snapshots for an avatar, newest first.
   *
   * @param avatarId - the avatar the snapshots are scoped to
   * @returns Result with the snapshot rows (never throws)
   */
  getSnapshots(avatarId: string): Promise<CompetitorInsightsResult<TrustGapSnapshot[]>>;
}
