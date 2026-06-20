/**
 * TestingLiftTab (Competitor-Agents P4 — Testing & Lift surface)
 *
 * Lists recorded `brand_tests` for the avatar and surfaces the P4
 * `competitor_insight_applied` flag, so competitor-informed A/B tests are
 * visibly distinguished from the rest (the basis for the LT-5 lift-attribution
 * correlation). Read-only; tests are recorded from the DraftCountermeasureDialog.
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (ST-4 / LT-5)
 */

import React, { useEffect } from 'react';
import { Swords, FlaskConical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompetitorInsights } from '@/hooks/useCompetitorInsights';
import type { BrandTest } from '@/types/competitorInsights';

interface TestingLiftTabProps {
  /** Avatar whose recorded tests are shown. */
  avatarId?: string;
}

/** Render the lift delta (result - baseline) when both are present. */
function liftLabel(test: BrandTest): string {
  if (test.result_value == null || test.baseline_value == null) return '—';
  const delta = test.result_value - test.baseline_value;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}`;
}

export function TestingLiftTab({ avatarId }: TestingLiftTabProps): React.ReactElement {
  const { brandTests, loadBrandTests } = useCompetitorInsights();

  useEffect(() => {
    if (avatarId) void loadBrandTests(avatarId);
  }, [avatarId, loadBrandTests]);

  if (!avatarId) {
    return (
      <p className="text-sm text-muted-foreground">
        Open the funnel for a specific brand to see its lift tests.
      </p>
    );
  }

  const competitorInformed = brandTests.filter((t) => t.competitor_insight_applied).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Testing &amp; lift</CardTitle>
        </div>
        <CardDescription>
          {brandTests.length === 0
            ? 'No lift tests recorded yet. Draft a countermeasure from a competitor analysis to start one.'
            : `${brandTests.length} test(s) recorded — ${competitorInformed} informed by competitor analysis.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {brandTests.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Lift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brandTests.map((test) => (
                <TableRow key={test.id}>
                  <TableCell className="font-medium">{test.name}</TableCell>
                  <TableCell>
                    {test.competitor_insight_applied ? (
                      <Badge variant="default" className="gap-1">
                        <Swords className="h-3 w-3" />
                        Competitor-informed
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Standard</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{test.primary_metric ?? '—'}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{test.status}</TableCell>
                  <TableCell className="text-right tabular-nums">{liftLabel(test)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
