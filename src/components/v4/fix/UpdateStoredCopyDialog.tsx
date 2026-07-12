/**
 * UpdateStoredCopyDialog — update the stored copy of an EXISTING funnel piece.
 *
 * WHY: the piece detail page already knows which piece you're on, so this never
 * asks "which piece?" (the old bug routed it through AddPieceDialog, whose first
 * field is the touchpoint selector). It edits THIS piece's copy in place.
 *
 * Two ways to supply the copy, one editable box:
 *  - Paste / type it directly.
 *  - "Read from screenshot": upload an image → Claude vision transcribes the
 *    visible copy verbatim → it fills the box for you to REVIEW and edit (never a
 *    blind overwrite). Save then writes content_text + re-audits the piece.
 *
 * NO FABRICATION: the transcription is verbatim from the image; the verdict comes
 * back from the audit seam. Failures surface honestly.
 */
import { useEffect, useRef, useState } from 'react';
import { ImageUp, Loader2, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  extractCopyFromImage as defaultExtract,
  updateStoredCopy as defaultUpdate,
} from '@/services/v4/fixService';
import type { DataResult, FunnelPiece } from '@/types/v4Fix';

export interface UpdateStoredCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The existing piece whose stored copy we're updating. */
  pieceId: string | null;
  /** Everyday label of the piece (shown as read-only context — never a selector). */
  pieceLabel: string;
  /** The copy currently stored for the piece — prefills the editable box. */
  currentCopy: string;
  /** The avatar the re-audit is scored for; null disables save. */
  avatarId: string | null;
  /** Transcribe-from-screenshot seam (defaults to fixService); injectable for tests. */
  onExtract?: (pieceId: string, file: File) => Promise<DataResult<string>>;
  /** Save+re-audit seam (defaults to fixService); injectable for tests. */
  onSave?: (pieceId: string, text: string, avatarId: string | null) => Promise<DataResult<FunnelPiece>>;
  /** Called with the refreshed piece after a successful save. */
  onUpdated?: (piece: FunnelPiece) => void;
}

export function UpdateStoredCopyDialog({
  open,
  onOpenChange,
  pieceId,
  pieceLabel,
  currentCopy,
  avatarId,
  onExtract = defaultExtract,
  onSave = defaultUpdate,
  onUpdated,
}: UpdateStoredCopyDialogProps): JSX.Element {
  const [text, setText] = useState(currentCopy);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed the box from the current stored copy each time the dialog opens.
  useEffect(() => {
    if (open) {
      setText(currentCopy);
      setError(null);
      setNotice(null);
    }
  }, [open, currentCopy]);

  const busy = extracting || saving;
  const canSave = Boolean(pieceId) && Boolean(avatarId) && text.trim().length > 0 && !busy;

  const handleOpenChange = (next: boolean): void => {
    if (busy) return;
    onOpenChange(next);
  };

  const handlePickScreenshot = async (file: File): Promise<void> => {
    if (!pieceId || !file) return;
    setExtracting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await onExtract(pieceId, file);
      if (res.status === 'ok') {
        if (res.data.trim().length === 0) {
          setNotice("I couldn't read any copy in that screenshot — paste it instead.");
        } else {
          setText(res.data);
          setNotice('Read from your screenshot — review and edit before saving.');
        }
      } else {
        setError(res.status === 'no_data' ? res.reason : res.error);
      }
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!pieceId || !avatarId || text.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const res = await onSave(pieceId, text, avatarId);
    if (res.status === 'ok') {
      onUpdated?.(res.data);
      handleOpenChange(false);
      setSaving(false);
      return;
    }
    setError(res.status === 'no_data' ? res.reason : res.error);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="v4-update-stored-copy-dialog">
        <DialogHeader>
          <DialogTitle>Update stored copy</DialogTitle>
          <DialogDescription>
            The current copy for <span className="font-medium text-foreground">{pieceLabel || 'this piece'}</span>.
            Paste the new version, or read it from a screenshot — then save to re-audit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="update-stored-copy">Stored copy</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!pieceId || busy}
              onClick={() => fileRef.current?.click()}
              data-testid="v4-update-stored-copy-screenshot-btn"
            >
              {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
              {extracting ? 'Reading…' : 'Read from screenshot'}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            data-testid="v4-update-stored-copy-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePickScreenshot(f);
            }}
          />
          <Textarea
            id="update-stored-copy"
            data-testid="v4-update-stored-copy-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the listing copy / email body / page text — or read it from a screenshot."
            rows={8}
            disabled={busy}
          />
          {notice && <p className="text-xs text-muted-foreground" data-testid="v4-update-stored-copy-notice">{notice}</p>}
          {!avatarId && (
            <p className="text-xs text-muted-foreground">Pick a customer first — the re-audit is scored for one customer at a time.</p>
          )}
          {error && <p className="text-sm text-destructive" data-testid="v4-update-stored-copy-error">{error}</p>}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="brand" className="gap-2" onClick={() => void handleSave()} disabled={!canSave} data-testid="v4-update-stored-copy-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving & re-auditing…' : 'Save stored copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UpdateStoredCopyDialog;
