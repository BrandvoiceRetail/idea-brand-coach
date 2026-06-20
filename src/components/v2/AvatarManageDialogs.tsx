/**
 * AvatarManageDialogs — input-bearing avatar CRUD dialogs (P4b §4.5).
 *
 * Currently owns the Rename dialog (the only avatar CRUD op that needs free-text
 * input). Duplicate / set-primary are one-click actions handled inline by the
 * caller; delete is gated by AvatarSwitchConfirm. Parent owns open state and the
 * submit callback; this stays presentational + validates a non-empty name.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RenameDialogState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current avatar name (seeds the input). */
  currentName: string;
  /** Submit callback — parent performs the rename with the new name. */
  onSubmit: (name: string) => void;
}

interface AvatarManageDialogsProps {
  rename: RenameDialogState;
}

export function AvatarManageDialogs({ rename }: AvatarManageDialogsProps): JSX.Element {
  const [name, setName] = useState(rename.currentName);

  // Re-seed the input each time the dialog opens for a (possibly different) avatar.
  useEffect(() => {
    if (rename.open) setName(rename.currentName);
  }, [rename.open, rename.currentName]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed !== rename.currentName;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    rename.onSubmit(trimmed);
    rename.onOpenChange(false);
  };

  return (
    <Dialog open={rename.open} onOpenChange={rename.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename avatar</DialogTitle>
          <DialogDescription>Give this avatar a clear, recognizable name.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="avatar-rename-input">Name</Label>
          <Input
            id="avatar-rename-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => rename.onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
