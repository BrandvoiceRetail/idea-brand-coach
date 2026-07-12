/**
 * WorkbookExportCard (S-17) — Loop-5 full-loop workbook export.
 *
 * WHAT: Offers a one-tap export of the full-loop workbook via the live
 * `export_workbook` engine (through `defendService.exportWorkbook`). Explicit
 * idle / exporting / success (with a real download link when the engine returns
 * one) / error states.
 *
 * WHY: Defend closes the loop — the workbook is the bankable artifact of the
 * whole Diagnose → Defend run (the product output bar). The link is shown ONLY
 * when the engine returns a real URL; on success-without-link we show the
 * engine's note. We never fabricate a download.
 *
 * Tier-A vocabulary only; v23 semantic tokens (no hex); 0 horizontal overflow at
 * 375px; tap targets ≥40px. The button-click event lives on the page (it owns the
 * action); this card fires its result-state events.
 */
import { useEffect } from 'react';
import { FileSpreadsheet, Download, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { WorkbookExport } from '@/types/v4Defend';

type V4WorkbookEvent = 'v4_defend_workbook_result';

function captureV4(name: V4WorkbookEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

export interface WorkbookExportCardProps {
  isExporting?: boolean;
  result?: WorkbookExport | null;
  error?: string | null;
  /** Start the export (page owns the action + click event). */
  onExport: () => void;
  /**
   * Honest scope note shown when Defend covers a multi-avatar SET: a set export is
   * deferred, so the workbook banks the FOCUS customer only. Null = single-avatar
   * (no note). Never fabricates a per-customer workbook it did not produce.
   */
  focusOnlyNote?: string | null;
}

export function WorkbookExportCard({
  isExporting = false,
  result = null,
  error = null,
  onExport,
  focusOnlyNote = null,
}: WorkbookExportCardProps): JSX.Element {
  useEffect(() => {
    if (isExporting) return;
    if (result) captureV4('v4_defend_workbook_result', { state: 'ok', has_link: Boolean(result.downloadUrl) });
    else if (error) captureV4('v4_defend_workbook_result', { state: 'error' });
  }, [isExporting, result, error]);

  return (
    <Card data-testid="v4-defend-workbook" className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4 text-gold-warm" />
          Full-loop workbook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Export everything from Diagnose to Defend as one workbook — your avatar,
          Trust Gap, fixes, the lift, and where you stand now.
        </p>

        {focusOnlyNote && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="v4-defend-workbook-focus-note"
          >
            {focusOnlyNote}
          </p>
        )}

        {error && (
          <div
            className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            data-testid="v4-defend-workbook-error"
          >
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              We couldn&apos;t build your workbook.
            </p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {result && (
          <div
            className="space-y-2 rounded-md border border-idea-e/30 bg-idea-e/5 p-3 text-sm"
            data-testid="v4-defend-workbook-success"
          >
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-idea-e" />
              {result.note}
            </p>
            {result.downloadUrl && (
              <Button asChild variant="brand" className="min-h-[40px] w-full gap-2 sm:w-auto">
                <a
                  href={result.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="v4-defend-workbook-download"
                >
                  <Download className="h-4 w-4" />
                  Download workbook
                </a>
              </Button>
            )}
          </div>
        )}

        <Button
          type="button"
          variant={result ? 'outline' : 'brand'}
          className="min-h-[40px] w-full gap-2 sm:w-auto"
          onClick={onExport}
          disabled={isExporting}
          data-testid="v4-defend-workbook-export"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building your workbook…
            </>
          ) : result ? (
            'Export again'
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4" />
              Export workbook
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
