/**
 * V4Defend — the Defend stage (Loop-5, S-17).
 *
 * WHAT: The thin wiring shell that orchestrates the Loop-5 flow inside the /v4
 * shell (sidebar + spine stepper + bottom-nav): the Signature-drift watch
 * (DriftWatchCard), the deterministic defend checklist (DefendChecklist), the
 * honest competitive-pressure teaser (CompetitorTeaserCard), and the full-loop
 * workbook export (WorkbookExportCard). ALL data-fetching is owned by
 * `useDefendRun` (the defendService seam scoped to the active avatar); this page
 * only passes data + handlers to the presentational screens, owns the workbook
 * export action + the spine-loop CTA back to Diagnose, and emits the page-level
 * funnel events.
 *
 * WHY: Pages on /v4 are thin shells (src/pages/AGENTS.md). Defend is the spine's
 * terminal "hold the gains" leg — it closes the Diagnose → Analyse → Fix →
 * Re-measure → Defend loop and points the user back to a fresh Diagnose when they
 * are ready to push the next lever.
 *
 * NO FABRICATION: drift + checklist states come from real reads (`getDrift`,
 * `getTrustGapLift`); the competitor watch is honestly "coming" (competitor reads
 * are deferred in Alpha); the workbook export surfaces the live `export_workbook`
 * engine's real note/error, never a fake download. With no avatar an honest gate
 * sends the user to Analyse.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Shield, Sparkles, ArrowRight, ChevronDown, Map } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DriftWatchCard } from '@/components/v4/defend/DriftWatchCard';
import { DefendChecklist } from '@/components/v4/defend/DefendChecklist';
import { CompetitorTeaserCard } from '@/components/v4/defend/CompetitorTeaserCard';
import { WorkbookExportCard } from '@/components/v4/defend/WorkbookExportCard';
import { useDefendRun } from '@/hooks/useDefendRun';
import { V4_ROUTES } from '@/config/v4';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';

/**
 * Page-level Loop-5 funnel events. Cast to the shared union at this single seam
 * (keeps the canonical posthogClient registry untouched) — IDs/booleans only,
 * never user-facing copy. Mirrors the V4Remeasure page telemetry pattern.
 */
type V4DefendPageEvent =
  | 'v4_defend_stage_viewed'
  | 'v4_defend_gate_blocked'
  | 'v4_defend_workbook_requested'
  | 'v4_defend_loop_restarted';

function emitPage(name: V4DefendPageEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export default function V4Defend(): JSX.Element {
  const navigate = useNavigate();
  // Roadmap items are collapsed by default so they don't sit inline as if live.
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const {
    hasAvatar,
    avatarId,
    status,
    statusLoading,
    statusError,
    exporting,
    exportResult,
    exportError,
    load,
    exportWorkbook,
  } = useDefendRun();

  // Keyed on the avatar id (not a boolean) so switching avatars while the page
  // stays mounted re-loads for the new avatar instead of keeping stale data.
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    emitPage('v4_defend_stage_viewed', { has_avatar: hasAvatar });
    if (hasAvatar && loadedForRef.current !== avatarId) {
      loadedForRef.current = avatarId;
      void load();
    } else if (!hasAvatar) {
      emitPage('v4_defend_gate_blocked', {});
    }
  }, [hasAvatar, avatarId, load]);

  const handleExport = (): void => {
    emitPage('v4_defend_workbook_requested', { drift_count: status?.drift.count ?? null });
    void exportWorkbook();
  };

  const handleRestartLoop = (): void => {
    emitPage('v4_defend_loop_restarted', { lift_confirmed: status?.liftConfirmed ?? false });
    navigate(V4_ROUTES.DIAGNOSE);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-idea-d" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Defend</h1>
          <p className="text-muted-foreground">Hold the gains — watch for drift</p>
        </div>
      </header>

      {/* Honest gate: no avatar scoped yet → send the user back to Analyse. */}
      {!hasAvatar ? (
        <Card data-testid="v4-defend-avatar-gate">
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-idea-d" />
              Let&apos;s lock in your customer first
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              The drift watch and workbook are scoped to one customer — I won&apos;t
              guess which. Build and confirm your avatar in Analyse and I&apos;ll bring
              you back here to defend the gains. Nothing is invented along the way.
            </p>
            <Button
              type="button"
              variant="brand"
              className="min-h-[40px] gap-2"
              onClick={() => navigate(V4_ROUTES.ANALYSE)}
              data-testid="v4-defend-go-analyse"
            >
              Go to Analyse
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <DriftWatchCard
            watch={status?.drift ?? null}
            hasBaseline={status?.hasBaseline ?? false}
            isLoading={statusLoading}
            error={statusError}
            onRetry={() => void load()}
            onRecheck={() => navigate(V4_ROUTES.FIX)}
          />

          <DefendChecklist
            items={status?.checklist ?? []}
            isLoading={statusLoading}
            error={statusError}
            onRetry={() => void load()}
          />

          {/* Roadmap: not-yet-live capabilities, collapsed so they don't read as
              real defend tools sitting inline next to the live drift watch. */}
          <Collapsible open={roadmapOpen} onOpenChange={setRoadmapOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-[40px] w-full justify-between gap-2"
                data-testid="v4-defend-roadmap-toggle"
              >
                <span className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-idea-d" />
                  Roadmap — what&apos;s coming to Defend
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${roadmapOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <CompetitorTeaserCard />
            </CollapsibleContent>
          </Collapsible>

          <WorkbookExportCard
            isExporting={exporting}
            result={exportResult}
            error={exportError}
            onExport={handleExport}
          />

          {/* Loop CTA — close the spine and start the next lever from Diagnose. */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Gains banked. When you&apos;re ready to push the next lever, run a fresh
              diagnostic.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[40px] gap-2"
              onClick={handleRestartLoop}
              data-testid="v4-defend-restart-loop"
            >
              <RefreshCw className="h-4 w-4" />
              Start the next loop
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
