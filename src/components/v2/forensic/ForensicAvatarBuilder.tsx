/**
 * ForensicAvatarBuilder — the SPA forensic-build stepper dialog (§4.2).
 *
 * Surfaces the S1→S4 forensic avatar build over the DEPLOYED edge fns (via
 * useForensicAvatarBuild → ForensicBuildService → supabase.functions.invoke),
 * NEVER /mcp. Flow: evidence intake (paste verbatim reviews) → readiness gate →
 * run stages with per-stage progress → review the read-only artifacts → approve.
 * S5/signature is D2/R-015 gated and intentionally not part of this flow.
 *
 * Parent owns open state + which avatar (avatarId); this component is otherwise
 * self-contained against the hook. Presentational composition only.
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useForensicAvatarBuild, type StageStatus } from '@/hooks/useForensicAvatarBuild';
import { FORENSIC_STAGES, FORENSIC_STAGE_LABELS, type ForensicStage } from '@/types/forensicBuild';
import { ForensicArtifactReview } from './ForensicArtifactReview';

interface ForensicAvatarBuilderProps {
  avatarId: string | null;
  avatarName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Verbatim reviews preloaded from the seller's imported listings (paste fallback). */
  preloadedReviews?: string;
}

const STATUS_ICON: Record<StageStatus, JSX.Element> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  needs_input: <AlertCircle className="h-4 w-4 text-amber-500" />,
};

export function ForensicAvatarBuilder({
  avatarId,
  avatarName,
  open,
  onOpenChange,
  preloadedReviews = '',
}: ForensicAvatarBuilderProps): JSX.Element {
  const [reviews, setReviews] = useState(preloadedReviews);
  const {
    stageStatus, isRunning, needsInput, runError, artifacts, buildStatus, runBuild, approve,
  } = useForensicAvatarBuild(avatarId);

  const hasArtifacts = FORENSIC_STAGES.some((s) => artifacts[s]);
  const allDone = FORENSIC_STAGES.every((s) => stageStatus[s] === 'done') || buildStatus === 'built' || buildStatus === 'approved';
  const reviewsReady = reviews.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="forensic-avatar-builder">
        <DialogHeader>
          <DialogTitle>Forensic build — {avatarName}</DialogTitle>
          <DialogDescription>
            Mine verbatim customer reviews into a four-stage forensic avatar (vocabulary,
            job map, decision triggers, objections). Every output is grounded in the reviews.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Evidence intake + readiness */}
          <div className="space-y-1.5">
            <label htmlFor="forensic-reviews" className="text-sm font-medium">
              Customer reviews (verbatim)
            </label>
            <Textarea
              id="forensic-reviews"
              data-testid="forensic-reviews-input"
              value={reviews}
              onChange={(e) => setReviews(e.target.value)}
              placeholder="Paste your customer reviews here. The forensic build quotes them directly and cannot run without them."
              rows={5}
              disabled={isRunning}
            />
            {!reviewsReady && (
              <p className="text-xs text-muted-foreground" data-testid="forensic-readiness-hint">
                Paste reviews to enable the build. Forensics is evidence-only.
              </p>
            )}
          </div>

          {/* Stage progress */}
          <div className="space-y-1.5" data-testid="forensic-stage-progress">
            {FORENSIC_STAGES.map((stage: ForensicStage) => (
              <div key={stage} className="flex items-center gap-2 text-sm">
                {STATUS_ICON[stageStatus[stage]]}
                <span>{FORENSIC_STAGE_LABELS[stage]}</span>
              </div>
            ))}
          </div>

          {/* needs_input / error surfaces */}
          {needsInput && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm" data-testid="forensic-needs-input">
              {needsInput.map((n, i) => (
                <p key={i} className="text-amber-800">{n.question}</p>
              ))}
            </div>
          )}
          {runError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="forensic-run-error">
              {runError}
            </div>
          )}

          {/* Read-only artifact review */}
          {hasArtifacts && (
            <ScrollArea className="max-h-64 pr-2">
              <div className="space-y-2">
                {FORENSIC_STAGES.map((stage) =>
                  artifacts[stage] ? (
                    <ForensicArtifactReview key={stage} stage={stage} content={artifacts[stage]!} />
                  ) : null,
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {buildStatus && (
            <Badge variant={buildStatus === 'approved' ? 'default' : 'secondary'} className="mr-auto self-center">
              {buildStatus}
            </Badge>
          )}
          <Button
            onClick={() => void runBuild(reviews)}
            disabled={!avatarId || !reviewsReady || isRunning}
            data-testid="forensic-run-button"
          >
            {isRunning ? 'Building…' : hasArtifacts ? 'Re-run build' : 'Run build'}
          </Button>
          <Button
            variant="default"
            onClick={() => void approve()}
            disabled={!allDone || isRunning || buildStatus === 'approved'}
            data-testid="forensic-approve-button"
          >
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
