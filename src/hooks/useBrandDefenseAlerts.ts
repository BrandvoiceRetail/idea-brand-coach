/**
 * useBrandDefenseAlerts Hook (Competitor-Agents P6 — Track B)
 *
 * Wires the in-app brand-defense alert inbox into React: list alerts for an
 * avatar, expose the unread count (for the funnel badge), and mark an alert read.
 * Consumes INotificationChannel via ServiceProvider, keeps loading/error state,
 * surfaces sonner toasts on failure, and fires PostHog `funnel_defense_*` events
 * (counts/booleans/IDs only — content discipline).
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useServices } from '@/services/ServiceProvider';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { isCompetitorAgentsEnabled } from '@/config/features';
import type { BrandDefenseAlert } from '@/types/brandDefense';

export interface UseBrandDefenseAlertsResult {
  /** Alerts for the current avatar (newest first). */
  alerts: BrandDefenseAlert[];
  /** Count of unread alerts (powers the badge). */
  unreadCount: number;
  /** True while alerts are loading. */
  isLoading: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Load alerts + unread count for an avatar. */
  loadAlerts: (avatarId: string) => Promise<void>;
  /** Refresh just the unread count for an avatar (cheap; for the badge). */
  refreshUnreadCount: (avatarId: string) => Promise<void>;
  /** Mark a single alert read; updates local state optimistically. */
  markRead: (alertId: string) => Promise<void>;
}

export function useBrandDefenseAlerts(): UseBrandDefenseAlertsResult {
  const { notificationChannel } = useServices();

  const [alerts, setAlerts] = useState<BrandDefenseAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshUnreadCount = useCallback(
    async (avatarId: string): Promise<void> => {
      // COMPETITOR_AGENTS gate: defense surface stays dark while disabled.
      if (!isCompetitorAgentsEnabled()) return;
      const { data, error: serviceError } = await notificationChannel.getUnreadCount(avatarId);
      if (!isMountedRef.current) return;
      if (serviceError) {
        setError(serviceError.message);
        return;
      }
      setUnreadCount(data ?? 0);
    },
    [notificationChannel],
  );

  const loadAlerts = useCallback(
    async (avatarId: string): Promise<void> => {
      if (!isCompetitorAgentsEnabled()) return;
      setIsLoading(true);
      setError(null);

      const { data, error: serviceError } = await notificationChannel.listAlerts(avatarId);

      if (!isMountedRef.current) return;

      if (serviceError) {
        setError(serviceError.message ?? 'Failed to load alerts.');
        setIsLoading(false);
        return;
      }

      const rows = data ?? [];
      setAlerts(rows);
      const unread = rows.filter((a) => !a.read_at).length;
      setUnreadCount(unread);
      // Counts/booleans only — never the alert content.
      captureAlphaEvent('funnel_defense_alerts_viewed', {
        alert_count: rows.length,
        unread_count: unread,
      });
      setIsLoading(false);
    },
    [notificationChannel],
  );

  const markRead = useCallback(
    async (alertId: string): Promise<void> => {
      if (!isCompetitorAgentsEnabled()) return;
      const { error: serviceError } = await notificationChannel.markRead(alertId);
      if (!isMountedRef.current) return;
      if (serviceError) {
        toast.error(serviceError.message ?? 'Failed to mark the alert read.');
        return;
      }
      // Optimistic local update so the badge + list reflect the read immediately.
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId && !a.read_at ? { ...a, read_at: new Date().toISOString() } : a)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      captureAlphaEvent('funnel_defense_alert_read', { alert_id: alertId });
    },
    [notificationChannel],
  );

  return {
    alerts,
    unreadCount,
    isLoading,
    error,
    loadAlerts,
    refreshUnreadCount,
    markRead,
  };
}
