/**
 * CompetitorGapsAggregate (Competitor-Agents P3 — Tab 2 aggregate surface)
 *
 * Rolls up persisted competitive insights across the funnel's assets into a
 * single "N competitors analyzed -> view gaps" summary per asset (plan §2 step
 * 4). Reads `brand_asset_competitive_insights` per piece via
 * `useCompetitorInsights`. Read-only; the per-piece panel does the analysis.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md
 */

import React, { useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCompetitorInsights } from '@/hooks/useCompetitorInsights';
import type { FunnelPiece } from './funnelPiece';

interface CompetitorGapsAggregateProps {
  pieces: FunnelPiece[];
}

/** One asset's rollup row — loads its own persisted insights. */
function AssetGapRow({ piece }: { piece: FunnelPiece }): React.ReactElement {
  const { insights, isLoading, loadInsights } = useCompetitorInsights();

  useEffect(() => {
    void loadInsights(piece.assetId);
  }, [piece.assetId, loadInsights]);

  const totalCompetitors = insights.reduce((sum, ins) => sum + ins.competitors.length, 0);
  const latestAngle = insights.find((ins) => ins.strategic_angle)?.strategic_angle ?? null;

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{piece.touchpointLabel}</p>
        {latestAngle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{latestAngle}</p>
        )}
      </div>
      <Badge variant={totalCompetitors > 0 ? 'default' : 'secondary'} className="shrink-0">
        {isLoading
          ? 'Loading...'
          : totalCompetitors > 0
            ? `${totalCompetitors} competitors analyzed`
            : 'Not analyzed'}
      </Badge>
    </div>
  );
}

export function CompetitorGapsAggregate({ pieces }: CompetitorGapsAggregateProps): React.ReactElement | null {
  if (pieces.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Competitor gaps across the funnel</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pieces.map((piece) => (
          <AssetGapRow key={piece.assetId} piece={piece} />
        ))}
      </CardContent>
    </Card>
  );
}
