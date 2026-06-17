/**
 * SupabaseInAppNotificationChannel (Competitor-Agents P6 — Track B)
 *
 * The in-app INotificationChannel: reads brand_defense_alerts (RLS scopes to the
 * caller's avatars) to list alerts, count unread (for the funnel badge), and mark
 * an alert read.
 *
 * Follows the service-layer Result pattern (`{ data, error }`, never throws) and
 * the boundary-cast pattern from SupabaseCompetitorInsightsService.
 *
 * NOTE: brand_defense_alerts is not in the generated supabase types yet
 * (migration unapplied to prod), so the `.from(...)` builder is cast at the
 * boundary. // TODO(types-regen)
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import { supabase } from '@/integrations/supabase/client';
import type { INotificationChannel } from './interfaces/INotificationChannel';
import type { CompetitorInsightsResult } from './interfaces/ICompetitorInsightsService';
import type {
  BrandDefenseAlert,
  BrandDefenseCategory,
  BrandDefenseSeverity,
} from '@/types/brandDefense';
import type { IdeaDimension } from '@/types/competitorInsights';

export class SupabaseInAppNotificationChannel implements INotificationChannel {
  readonly channel = 'in-app';

  async listAlerts(avatarId: string): Promise<CompetitorInsightsResult<BrandDefenseAlert[]>> {
    try {
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { data, error } = await (supabase
        .from('brand_defense_alerts') as unknown as {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        })
        .select('*')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[InAppNotifications] listAlerts error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }

      const rows = (data ?? []).map((row) => this.mapAlertFromDb(row as Record<string, unknown>));
      return { data: rows, error: null };
    } catch (err) {
      console.error('[InAppNotifications] listAlerts threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to load alerts.') };
    }
  }

  async getUnreadCount(avatarId: string): Promise<CompetitorInsightsResult<number>> {
    try {
      // Count unread via head:true + count:'exact' (no rows transferred).
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { count, error } = await (supabase
        .from('brand_defense_alerts') as unknown as {
          select: (c: string, opts: { count: 'exact'; head: true }) => {
            eq: (col: string, val: string) => {
              is: (col: string, val: null) => Promise<{ count: number | null; error: unknown }>;
            };
          };
        })
        .select('id', { count: 'exact', head: true })
        .eq('avatar_id', avatarId)
        .is('read_at', null);

      if (error) {
        console.error('[InAppNotifications] getUnreadCount error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }
      return { data: count ?? 0, error: null };
    } catch (err) {
      console.error('[InAppNotifications] getUnreadCount threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to count unread alerts.') };
    }
  }

  async markRead(alertId: string): Promise<CompetitorInsightsResult<boolean>> {
    try {
      // TODO(types-regen): table absent from generated supabase types — cast at boundary.
      const { error } = await (supabase
        .from('brand_defense_alerts') as unknown as {
          update: (r: unknown) => {
            eq: (col: string, val: string) => Promise<{ error: unknown }>;
          };
        })
        .update({ read_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) {
        console.error('[InAppNotifications] markRead error:', error);
        return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
      }
      return { data: true, error: null };
    } catch (err) {
      console.error('[InAppNotifications] markRead threw:', err);
      return { data: null, error: err instanceof Error ? err : new Error('Failed to mark the alert read.') };
    }
  }

  // ── Boundary mapping ────────────────────────────────────────────────────────

  /** Map a brand_defense_alerts row to the domain type. */
  private mapAlertFromDb(row: Record<string, unknown>): BrandDefenseAlert {
    return {
      id: row.id as string,
      avatar_id: row.avatar_id as string,
      category: row.category as BrandDefenseCategory,
      threatened_dimension: (row.threatened_dimension as IdeaDimension | null) ?? null,
      severity: (row.severity as BrandDefenseSeverity) ?? 'medium',
      title: row.title as string,
      interpretation: (row.interpretation as string | null) ?? null,
      source_payload: (row.source_payload as Record<string, unknown>) ?? {},
      drafted_response: (row.drafted_response as Record<string, unknown> | null) ?? null,
      ledger_request_id: (row.ledger_request_id as string | null) ?? null,
      read_at: (row.read_at as string | null) ?? null,
      created_at: row.created_at as string,
    };
  }
}
