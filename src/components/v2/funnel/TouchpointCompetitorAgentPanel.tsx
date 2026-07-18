/**
 * TouchpointCompetitorAgentPanel
 *
 * Per-funnel-piece competitor agent. Tailored to ONE touchpoint: it runs a
 * grounded, IDEA-scored competitor analysis for the asset at that touchpoint and
 * renders the result — IDEA-scored competitor cards (i/d/e/a bars + rationale +
 * gap_to_our_avatar), the single strategic angle, and a "Draft countermeasure"
 * CTA that routes the strategic angle to the rewrite/test loop (ST-4).
 *
 * States: idle (Analyze CTA) -> loading -> {error | needs-input | empty | result}.
 *
 * GROUNDING GATE: scores/quotes shown here come straight from the edge fn, which
 * only scores fetched evidence; when nothing could be grounded the panel shows
 * the needs-input prompt rather than inventing competitors (plan §3).
 *
 * Plan: docs/brand-funnel-builder/COMPETITOR_AGENTS_PLAN.md (ST-3)
 */

import React, { useState } from 'react';
import { Loader2, Swords, AlertTriangle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useCompetitorInsights } from '@/hooks/useCompetitorInsights';
import { IDEA_SCORE_ROWS } from '@/config/idea';
import { isCompetitorAgentsEnabled } from '@/config/features';
import { DraftCountermeasureDialog } from './DraftCountermeasureDialog';
import type {
  CompetitorBrief,
  CompetitorEntry,
  CompetitorModality,
  IdeaScores,
} from '@/types/competitorInsights';

interface TouchpointCompetitorAgentPanelProps {
  /** The brand asset (funnel piece) this panel analyzes. */
  assetId: string;
  /** The touchpoint this asset belongs to (taxonomy id). */
  touchpointId: string;
  /** Human-readable touchpoint label, used in the CTA copy. */
  touchpointLabel: string;
  /** Avatar the insight is scoped to. */
  avatarId?: string;
  /** Analyzer modality. Defaults to marketplace-listing. */
  modality?: CompetitorModality;
  /** Discovery hint for the marketplace-listing modality. */
  category?: string;
  /** Optional avatar/Positioning Statement context the host can pass through. */
  avatarContext?: unknown;
  positioningStatementContext?: unknown;
  /** The asset's current copy — seeds the A/B test baseline (Variant A). */
  currentCopy?: string;
  /** Channel hint for the recorded test's default primary metric. */
  channel?: string;
  /**
   * Optional observation callback fired when "Draft countermeasure" is clicked.
   * The panel now owns the rewrite + test-record flow (DraftCountermeasureDialog);
   * this is kept so a host can still react (e.g. analytics / scroll).
   */
  onDraftCountermeasure?: (strategicAngle: string, assetId: string) => void;
}

/** IDEA pillar rows for one competitor's score bars (canonical, from @/config/idea). */
const IDEA_ROWS: ReadonlyArray<{ key: keyof IdeaScores; label: string }> = IDEA_SCORE_ROWS;

function IdeaScoreBars({ scores }: { scores: IdeaScores }): React.ReactElement {
  return (
    <div className="space-y-2">
      {IDEA_ROWS.map(({ key, label }) => {
        const value = Math.max(0, Math.min(100, Number(scores?.[key] ?? 0)));
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
            <Progress value={value} className="h-2 flex-1" />
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: CompetitorEntry }): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {competitor.url ? (
              <a
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {competitor.name}
              </a>
            ) : (
              competitor.name
            )}
          </CardTitle>
          {competitor.evidence_refs.length > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {competitor.evidence_refs.length} evidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <IdeaScoreBars scores={competitor.idea_scores} />
        {competitor.rationale && (
          <p className="text-sm text-muted-foreground">{competitor.rationale}</p>
        )}
        {competitor.gap_to_our_avatar && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gap to our avatar
            </p>
            <p className="mt-1 text-sm">{competitor.gap_to_our_avatar}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TouchpointCompetitorAgentPanel({
  assetId,
  touchpointId,
  touchpointLabel,
  avatarId,
  modality = 'marketplace-listing',
  category,
  avatarContext,
  positioningStatementContext,
  currentCopy,
  channel,
  onDraftCountermeasure,
}: TouchpointCompetitorAgentPanelProps): React.ReactElement {
  const { analysis, isAnalyzing, error, analyzeCompetitors } = useCompetitorInsights();
  const [dialogOpen, setDialogOpen] = useState(false);

  // COMPETITOR_AGENTS gate: the panel is exported and could be mounted outside
  // FunnelTracker; self-gate so it never renders (and never triggers a service
  // call) while the flag is off.
  if (!isCompetitorAgentsEnabled()) {
    return <></>;
  }

  const handleAnalyze = (): void => {
    void analyzeCompetitors({
      assetId,
      touchpointId,
      modality,
      avatarId,
      category,
      avatarContext,
      positioningStatementContext,
    });
  };

  // Compose the competitor brief from the analysis: the strategic angle + the
  // first grounded gap + competitor names (context only). This is what the
  // funnel-rewrite turns into a countermeasure.
  const competitorBrief: CompetitorBrief = {
    strategic_angle: analysis?.strategicAngle ?? undefined,
    gap_to_our_avatar: analysis?.competitors.find((c) => c.gap_to_our_avatar)?.gap_to_our_avatar,
    competitor_names: analysis?.competitors.map((c) => c.name).filter(Boolean) ?? [],
  };

  const handleDraftCountermeasure = (): void => {
    onDraftCountermeasure?.(analysis?.strategicAngle ?? '', assetId);
    setDialogOpen(true);
  };

  const hasResult = analysis !== null && analysis.competitors.length > 0;
  const needsInput = analysis?.needsInput ?? null;
  const isEmpty = analysis !== null && analysis.competitors.length === 0 && !needsInput;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Competitor agent</CardTitle>
        </div>
        <CardDescription>
          See how competitors handle {touchpointLabel} and where this brand can win.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Idle / re-run action */}
        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full sm:w-auto">
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing competitors...
            </>
          ) : (
            <>
              <Swords className="mr-2 h-4 w-4" />
              {hasResult ? `Re-analyze competitors for ${touchpointLabel}` : `Analyze competitors for ${touchpointLabel}`}
            </>
          )}
        </Button>

        {/* Loading */}
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-busy="true">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Gathering grounded competitor evidence and scoring against the IDEA lens...</span>
          </div>
        )}

        {/* Error */}
        {error && !isAnalyzing && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analysis failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Grounding gate: more input needed */}
        {needsInput && !isAnalyzing && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>More input needed</AlertTitle>
            <AlertDescription>{needsInput[0]?.question}</AlertDescription>
          </Alert>
        )}

        {/* Empty (no grounded competitors) */}
        {isEmpty && !isAnalyzing && (
          <p className="text-sm text-muted-foreground">
            No grounded competitors were found for this touchpoint. Try a different category or
            supply a competitor ASIN/URL.
          </p>
        )}

        {/* Result: competitor cards + strategic angle + countermeasure CTA */}
        {hasResult && !isAnalyzing && analysis && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {analysis.competitors.map((competitor, idx) => (
                <CompetitorCard key={`${competitor.name}-${idx}`} competitor={competitor} />
              ))}
            </div>

            {analysis.strategicAngle && (
              <Card className="border-primary/40 bg-primary/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Strategic angle</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{analysis.strategicAngle}</p>
                  <Button variant="secondary" size="sm" onClick={handleDraftCountermeasure}>
                    Draft countermeasure
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>

      {/* P4 lift loop: rewrite the angle into a countermeasure, then record an A/B test. */}
      <DraftCountermeasureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        assetId={assetId}
        touchpointId={touchpointId}
        touchpointLabel={touchpointLabel}
        avatarId={avatarId}
        competitorBrief={competitorBrief}
        competitiveInsightId={analysis?.insightId ?? null}
        currentCopy={currentCopy}
        avatarContext={avatarContext}
        positioningStatementContext={positioningStatementContext}
        channel={channel}
      />
    </Card>
  );
}
