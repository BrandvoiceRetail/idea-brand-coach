/**
 * INotificationChannel Interface (Competitor-Agents P6 — Track B)
 *
 * The delivery contract for brand-defense alerts. The monitor raises alerts; a
 * channel delivers them. Today the only channel is in-app (SupabaseInApp
 * NotificationChannel, reading brand_defense_alerts) backing the funnel unread
 * badge. Future channels (email, Slack, push) implement the same contract so the
 * monitor stays channel-agnostic.
 *
 * Uses the service-boundary Result pattern (`{ data, error }`, never throws),
 * matching ICompetitorInsightsService / ITrustGapSnapshotService.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import type { BrandDefenseAlert } from '@/types/brandDefense';
import type { CompetitorInsightsResult } from './ICompetitorInsightsService';

export interface INotificationChannel {
  /** A stable channel name for logging/attribution (e.g. 'in-app'). */
  readonly channel: string;

  /**
   * List alerts for an avatar, newest first.
   *
   * @param avatarId - the avatar the alerts are scoped to (RLS anchor)
   * @returns Result with the alert rows (never throws)
   */
  listAlerts(avatarId: string): Promise<CompetitorInsightsResult<BrandDefenseAlert[]>>;

  /**
   * Count UNREAD alerts for an avatar (powers the unread badge).
   *
   * @param avatarId - the avatar the alerts are scoped to
   * @returns Result with the unread count (never throws)
   */
  getUnreadCount(avatarId: string): Promise<CompetitorInsightsResult<number>>;

  /**
   * Mark a single alert read.
   *
   * @param alertId - the alert id
   * @returns Result (data=true on success; never throws)
   */
  markRead(alertId: string): Promise<CompetitorInsightsResult<boolean>>;
}
