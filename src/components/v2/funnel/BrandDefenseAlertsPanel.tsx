/**
 * BrandDefenseAlertsPanel (Competitor-Agents P6 — Track B)
 *
 * The in-app alert inbox surface for the funnel: lists brand-defense alerts for
 * the avatar (newest first), shows the threatened IDEA pillar + severity, the
 * IDEA-scored interpretation, and the drafted-response status, and lets the user
 * mark an alert read. The unread badge lives on the funnel's "Defense" tab
 * trigger (see DefenseTabTrigger / FunnelTracker).
 *
 * Read-only over the alerts the brand-defense-monitor raises; gated behind the
 * COMPETITOR_AGENTS flag at the FunnelTracker level.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (Track B)
 */

import React, { useEffect } from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBrandDefenseAlerts } from '@/hooks/useBrandDefenseAlerts';
import { isCompetitorAgentsEnabled } from '@/config/features';
import type { BrandDefenseAlert, BrandDefenseSeverity } from '@/types/brandDefense';

interface BrandDefenseAlertsPanelProps {
  /** Avatar whose alerts are shown. */
  avatarId?: string;
}

/** Map severity to a Badge variant. */
function severityVariant(severity: BrandDefenseSeverity): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

/** Human label for the drafted-response status. */
function responseLabel(alert: BrandDefenseAlert): string {
  const status = (alert.drafted_response?.status as string | undefined) ?? 'pending-generation';
  return status === 'drafted' ? 'Response drafted' : 'Response pending';
}

export function BrandDefenseAlertsPanel({ avatarId }: BrandDefenseAlertsPanelProps): React.ReactElement {
  const { alerts, unreadCount, isLoading, loadAlerts, markRead } = useBrandDefenseAlerts();

  useEffect(() => {
    if (avatarId) void loadAlerts(avatarId);
  }, [avatarId, loadAlerts]);

  // COMPETITOR_AGENTS gate: defense surface is exported; self-gate so it never
  // renders (or triggers a service call) while the flag is off.
  if (!isCompetitorAgentsEnabled()) {
    return <></>;
  }

  if (!avatarId) {
    return (
      <p className="text-sm text-muted-foreground">
        Open the funnel for a specific brand to see its defense alerts.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Brand defense</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" aria-label={`${unreadCount} unread alerts`}>
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <CardDescription>
          {alerts.length === 0
            ? isLoading
              ? 'Loading alerts…'
              : 'No defense alerts. The monitor will raise alerts here when a threat is detected.'
            : `${alerts.length} alert(s) — ${unreadCount} unread.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-md border p-3 ${alert.read_at ? 'opacity-70' : 'border-primary/40'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{alert.title}</span>
              </div>
              <Badge variant={severityVariant(alert.severity)} className="capitalize">
                {alert.severity}
              </Badge>
            </div>

            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{alert.category.replace(/-/g, ' ')}</span>
              {alert.threatened_dimension && (
                <span className="capitalize">· threatens {alert.threatened_dimension}</span>
              )}
              <span>· {responseLabel(alert)}</span>
            </div>

            {alert.interpretation && (
              <p className="mt-2 text-sm text-muted-foreground">{alert.interpretation}</p>
            )}

            {!alert.read_at && (
              <div className="mt-2">
                <Button variant="ghost" size="sm" onClick={() => void markRead(alert.id)}>
                  Mark read
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
