/**
 * CreateAvatarDialog
 *
 * Prompts for a custom avatar name when creating a new avatar from the V2 coach.
 * Presentational + self-contained input state; the actual create is delegated via `onCreate`.
 * Validates a non-empty, non-duplicate name (case-insensitive) before enabling submit, so the
 * (user_id, name) unique constraint surfaces as a clear inline message rather than a generic error.
 */

import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

interface CreateAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names of existing avatars, for case-insensitive duplicate detection. */
  existingNames: string[];
  /** Create the avatar with the given name. Resolves true on success. */
  onCreate: (name: string) => Promise<boolean>;
}

export function CreateAvatarDialog({
  open,
  onOpenChange,
  existingNames,
  onCreate,
}: CreateAvatarDialogProps): JSX.Element {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const trimmed = name.trim();
  const isDuplicate = existingNames.some(
    existing => existing.trim().toLowerCase() === trimmed.toLowerCase()
  );
  const canSubmit = trimmed.length > 0 && !isDuplicate && !isCreating;

  const reset = (): void => {
    setName('');
    setIsCreating(false);
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setIsCreating(true);
    const created = await onCreate(trimmed);
    setIsCreating(false);
    if (created) {
      reset();
      onOpenChange(false);
    }
    // On failure the create path surfaces its own toast; keep the dialog open.
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Avatar</DialogTitle>
          <DialogDescription>
            Give your customer avatar a name. You can refine its details later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-avatar-name">Avatar name</Label>
          <Input
            id="new-avatar-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Budget-Conscious Parent"
            autoFocus
            maxLength={80}
            aria-invalid={isDuplicate}
          />
          {isDuplicate && (
            <p className="text-sm text-destructive">
              An avatar named “{trimmed}” already exists.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Avatar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
