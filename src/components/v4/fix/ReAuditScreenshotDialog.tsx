/**
 * ReAuditScreenshotDialog (Loop-3) — upload a screenshot of an EXISTING funnel
 * piece and re-audit it for the active avatar, in place.
 *
 * WHY: the piece detail showed a verdict but no way to feed the coach a fresh
 * screenshot of that piece. This dialog takes one image, uploads it to the piece's
 * own storage slot (no new version), and re-runs the audit scored for the current
 * avatar (the per-avatar overlay) — so "re-check THIS piece" is one upload.
 *
 * NO FABRICATION: the verdict comes from the audit seam; a failed upload/audit is
 * surfaced as an honest error, never a silent pass.
 */
import { useRef, useState } from 'react';
import { ImageUp, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reAuditPiece as defaultReAuditPiece } from '@/services/v4/fixService';
import type { DataResult, FunnelPiece } from '@/types/v4Fix';
import { captureAlphaEvent } from '@/lib/posthogClient';

export interface ReAuditScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The existing piece being re-audited. */
  pieceId: string | null;
  /** Everyday label of the piece (for the dialog copy). */
  pieceLabel: string;
  /** The avatar lens the re-audit is scored for; null disables submit. */
  avatarId: string | null;
  /** The seam (defaults to the `reAuditPiece` export); injectable for tests. */
  onReAudit?: (pieceId: string, file: File, avatarId: string | null) => Promise<DataResult<FunnelPiece>>;
  /** Called with the refreshed piece after a successful re-audit. */
  onReAudited?: (piece: FunnelPiece) => void;
}

export function ReAuditScreenshotDialog({
  open,
  onOpenChange,
  pieceId,
  pieceLabel,
  avatarId,
  onReAudit = defaultReAuditPiece,
  onReAudited,
}: ReAuditScreenshotDialogProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = (): void => {
    setFile(null);
    setError(null);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = Boolean(pieceId) && Boolean(avatarId) && Boolean(file) && !submitting;

  const handleSubmit = async (): Promise<void> => {
    if (!pieceId || !avatarId || !file) return;
    setSubmitting(true);
    setError(null);
    captureAlphaEvent('v4_piece_reaudit_submitted', { has_image: true });
    const res = await onReAudit(pieceId, file, avatarId);
    if (res.status === 'ok') {
      captureAlphaEvent('v4_piece_reaudit_succeeded', { status: res.data.status });
      onReAudited?.(res.data);
      handleOpenChange(false);
      return;
    }
    captureAlphaEvent('v4_piece_reaudit_failed', {});
    setError(res.status === 'no_data' ? res.reason : res.error);
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-audit with a screenshot</DialogTitle>
          <DialogDescription>
            Upload a current screenshot of {pieceLabel || 'this piece'} and I&apos;ll re-check it against
            your active customer. Nothing is invented — the verdict comes from what the image shows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label
            htmlFor="reaudit-screenshot"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gold-warm/40 bg-gold-warm/10 px-4 py-8 text-center transition-colors hover:bg-gold-warm/15"
          >
            <ImageUp className="h-6 w-6 text-gold-warm" />
            <span className="text-sm font-medium text-foreground">
              {file ? file.name : 'Choose a screenshot to upload'}
            </span>
            <span className="text-xs text-muted-foreground">PNG or JPG · the piece as a shopper sees it</span>
          </label>
          <Input
            id="reaudit-screenshot"
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          {!avatarId && (
            <p className="text-xs text-muted-foreground">
              Pick a customer first — the re-audit is scored for one customer at a time.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="brand" className="gap-2" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Re-auditing…
              </>
            ) : (
              'Upload & re-audit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
