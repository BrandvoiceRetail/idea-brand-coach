/**
 * ExportReadinessModal Component
 *
 * Pre-export gate that shows brand readiness assessment before generating
 * the markdown export. Displays:
 * - Weighted completion progress bar
 * - Section warnings by severity (critical/warning/info)
 * - Strengths list (sections >= 75% complete)
 * - Quick wins (top 3 highest-weight empty fields)
 * - "Export Anyway" and "Continue Building" action buttons
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Lightbulb,
  ShieldAlert,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { ExportReadiness, QuickWin, SectionStrength, SectionWarning, WarningSeverity } from '@/hooks/v2/useExportReadiness';

// ============================================================================
// Types
// ============================================================================

interface ExportReadinessModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when user clicks "Export Anyway" */
  onExportAnyway: () => void;
  /** Callback when user clicks a quick win field to navigate to it */
  onQuickWinClick?: (fieldId: string) => void;
  /** Readiness data from useExportReadiness hook */
  readiness: ExportReadiness;
}

// ============================================================================
// Sub-components
// ============================================================================

/** Severity icon mapping */
function SeverityIcon({ severity }: { severity: WarningSeverity }): JSX.Element {
  switch (severity) {
    case 'critical':
      return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
  }
}

/** Severity badge variant mapping */
function severityBadgeVariant(severity: WarningSeverity): 'destructive' | 'secondary' | 'outline' {
  switch (severity) {
    case 'critical': return 'destructive';
    case 'warning': return 'secondary';
    case 'info': return 'outline';
  }
}

/** Progress bar color based on completion */
function progressColor(percent: number): string {
  if (percent >= 75) return '[&>div]:bg-green-500';
  if (percent >= 50) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-destructive';
}

/** Warning list item */
function WarningItem({ warning }: { warning: SectionWarning }): JSX.Element {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <SeverityIcon severity={warning.severity} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{warning.chapterTitle}</span>
          <Badge variant={severityBadgeVariant(warning.severity)} className="text-[10px] px-1.5 py-0">
            {warning.severity}
          </Badge>
          <span className="text-xs text-muted-foreground">{warning.completionPercent}%</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{warning.message}</p>
      </div>
    </li>
  );
}

/** Strength list item */
function StrengthItem({ strength }: { strength: SectionStrength }): JSX.Element {
  return (
    <li className="flex items-center gap-2 py-1">
      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
      <span className="text-sm">{strength.chapterTitle}</span>
      <span className="text-xs text-muted-foreground ml-auto">{strength.completionPercent}%</span>
    </li>
  );
}

/** Quick win list item */
function QuickWinItem({
  quickWin,
  onClick,
}: {
  quickWin: QuickWin;
  onClick?: (fieldId: string) => void;
}): JSX.Element {
  return (
    <li
      className={`flex items-start gap-2 py-1.5 rounded-md px-2 -mx-2 ${
        onClick ? 'hover:bg-muted/50 cursor-pointer transition-colors' : ''
      }`}
      onClick={() => onClick?.(quickWin.fieldId)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(quickWin.fieldId);
        }
      }}
    >
      <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{quickWin.fieldLabel}</span>
          <span className="text-xs text-muted-foreground">({quickWin.chapterTitle})</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{quickWin.impactDescription}</p>
      </div>
    </li>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ExportReadinessModal({
  isOpen,
  onClose,
  onExportAnyway,
  onQuickWinClick,
  readiness,
}: ExportReadinessModalProps): JSX.Element {
  const { completionPercent, filledFields, totalFields, warnings, strengths, quickWins, isReady } = readiness;

  const handleExportAnyway = (): void => {
    onClose();
    onExportAnyway();
  };

  const handleQuickWinClick = (fieldId: string): void => {
    onClose();
    onQuickWinClick?.(fieldId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReady ? (
              <Trophy className="h-5 w-5 text-green-500" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            )}
            Export Readiness
          </DialogTitle>
          <DialogDescription>
            {isReady
              ? 'Your brand strategy is looking strong. Review the details below before exporting.'
              : 'Your brand strategy has some gaps. Review below and decide whether to export now or keep building.'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Completion</span>
            <span className="text-muted-foreground">{filledFields} / {totalFields} fields ({completionPercent}%)</span>
          </div>
          <Progress value={completionPercent} className={`h-3 ${progressColor(completionPercent)}`} />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Sections with Gaps ({warnings.length})
            </h4>
            <ul className="space-y-0.5 max-h-40 overflow-y-auto">
              {warnings.map((warning) => (
                <WarningItem key={warning.chapterId} warning={warning} />
              ))}
            </ul>
          </div>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Strengths ({strengths.length})
            </h4>
            <ul className="space-y-0.5">
              {strengths.map((strength) => (
                <StrengthItem key={strength.chapterId} strength={strength} />
              ))}
            </ul>
          </div>
        )}

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Quick Wins
            </h4>
            <p className="text-xs text-muted-foreground">
              Fill these high-impact fields to strengthen your export the most.
            </p>
            <ul className="space-y-0.5">
              {quickWins.map((quickWin) => (
                <QuickWinItem
                  key={quickWin.fieldId}
                  quickWin={quickWin}
                  onClick={onQuickWinClick ? handleQuickWinClick : undefined}
                />
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Continue Building
          </Button>
          <Button onClick={handleExportAnyway}>
            <Download className="h-4 w-4 mr-2" />
            Export Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
