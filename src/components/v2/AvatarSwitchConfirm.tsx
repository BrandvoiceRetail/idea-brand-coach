/**
 * AvatarSwitchConfirm — destructive-action confirmation for avatar CRUD (P4b §4.5).
 *
 * Used to gate avatar deletion (and any other irreversible avatar action). Purely
 * presentational: the parent owns open state + the confirm callback. When the
 * deleted avatar is the CURRENT one, the body warns that coaching will repoint to
 * a fallback avatar (the AvatarContext delete contract).
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AvatarSwitchConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the avatar being deleted (shown in the prompt). */
  avatarName: string;
  /** Whether the avatar being deleted is the currently active one. */
  isCurrent: boolean;
  /** Name of the fallback avatar coaching will repoint to (when isCurrent). */
  fallbackName?: string | null;
  /** Confirm callback — parent performs the delete. */
  onConfirm: () => void;
}

export function AvatarSwitchConfirm({
  open,
  onOpenChange,
  avatarName,
  isCurrent,
  fallbackName,
  onConfirm,
}: AvatarSwitchConfirmProps): JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{avatarName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the avatar and its coaching context. This cannot be undone.
            {isCurrent && fallbackName && (
              <> Coaching will switch to "{fallbackName}".</>
            )}
            {isCurrent && !fallbackName && (
              <> This is your last avatar — coaching will have no active avatar afterward.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
