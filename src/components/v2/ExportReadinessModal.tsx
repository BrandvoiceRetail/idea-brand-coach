import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Lightbulb, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExportReadiness,
  ReadinessWarning,
  QuickWin,
} from '@/hooks/v2/useExportReadiness';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportReadinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readiness: ExportReadiness;
  onExportAnyway: () => void;
  onContinueBuilding: () => void;
  onQuickWinClick?: (fieldId: string, chapterId: string) => void;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<ReadinessWarning['severity'], {
  badge: 'destructive' | 'default' | 'secondary';
  text: string;
  bg: string;
}> = {
  critical: { badge: 'destructive', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
  warning: { badge: 'default', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  info: { badge: 'secondary', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
};

function progressIndicatorClass(percent: number): string {
  if (percent >= 75) return '[&>div]:bg-green-500';
  if (percent >= 40) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WarningItem({ warning }: { warning: ReadinessWarning }): JSX.Element {
  const style = SEVERITY_STYLES[warning.severity];
  return (
    <div className={cn('flex items-start gap-3 rounded-md border px-3 py-2.5', style.bg)}>
      <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', style.text)} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', style.text)}>{warning.section}</span>
          <Badge variant={style.badge} className="text-[10px] leading-tight">
            {warning.severity}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{warning.impact}</p>
      </div>
    </div>
  );
}

function StrengthItem({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
      <span>{text}</span>
    </div>
  );
}

function QuickWinItem({
  quickWin,
  onClick,
}: {
  quickWin: QuickWin;
  onClick?: () => void;
}): JSX.Element {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 text-left',
        onClick && 'cursor-pointer transition-colors hover:bg-accent'
      )}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{quickWin.fieldLabel}</p>
        <p className="text-xs text-muted-foreground">{quickWin.impact}</p>
      </div>
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExportReadinessModal({
  open,
  onOpenChange,
  readiness,
  onExportAnyway,
  onContinueBuilding,
  onQuickWinClick,
}: ExportReadinessModalProps): JSX.Element {
  const { overallPercent, warnings, strengths, quickWins } = readiness;

  const hasWarnings = warnings.length > 0;
  const hasStrengths = strengths.length > 0;
  const hasQuickWins = quickWins.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Brand Strategy
          </DialogTitle>
          <DialogDescription>
            Review your brand profile completeness before generating the strategy document.
          </DialogDescription>
        </DialogHeader>

        {/* Overall progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Completion</span>
            <span className="tabular-nums">{overallPercent}%</span>
          </div>
          <Progress
            value={overallPercent}
            className={cn('h-2.5', progressIndicatorClass(overallPercent))}
          />
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Potential Gaps</h4>
            <div className="space-y-2">
              {warnings.slice(0, 5).map(warning => (
                <WarningItem key={warning.section} warning={warning} />
              ))}
              {warnings.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{warnings.length - 5} more sections with gaps
                </p>
              )}
            </div>
          </div>
        )}

        {/* Strengths */}
        {hasStrengths && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Strengths</h4>
            <div className="space-y-1.5">
              {strengths.map(text => (
                <StrengthItem key={text} text={text} />
              ))}
            </div>
          </div>
        )}

        {/* Quick wins */}
        {hasQuickWins && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Quick Wins</h4>
            <div className="space-y-2">
              {quickWins.map(qw => (
                <QuickWinItem
                  key={qw.fieldId}
                  quickWin={qw}
                  onClick={
                    onQuickWinClick
                      ? () => onQuickWinClick(qw.fieldId, qw.chapterId)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onExportAnyway}>
            Export Anyway
          </Button>
          <Button onClick={onContinueBuilding}>
            Continue Building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
