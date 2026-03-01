/**
 * AvatarContextMenu Component
 *
 * Provides right-click context menu for avatar tabs with options:
 * - Rename: Update avatar name
 * - Duplicate: Create a copy of the avatar
 * - Delete: Remove avatar (with confirmation)
 */

import * as React from 'react';
import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBrand } from '@/contexts/BrandContext';
import { useToast } from '@/hooks/use-toast';
import { validateAvatarName, getDefaultAvatar } from '@/lib/avatar-utils';
import { Edit, Copy, Trash2, Loader2 } from 'lucide-react';
import type { Avatar } from '@/types/avatar';

interface AvatarContextMenuProps {
  avatar: Avatar;
  children: React.ReactNode;
}

/**
 * AvatarContextMenu wraps an avatar tab item and provides right-click
 * context menu with rename, duplicate, and delete options.
 */
export function AvatarContextMenu({ avatar, children }: AvatarContextMenuProps): JSX.Element {
  const { updateAvatar, deleteAvatar, createAvatar, avatarsList } = useBrand();
  const { toast } = useToast();

  // Rename dialog state
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Duplicate loading state
  const [isDuplicating, setIsDuplicating] = useState(false);

  /**
   * Open rename dialog and initialize with current name
   */
  const handleRenameClick = (): void => {
    setNewName(avatar.name);
    setIsRenameDialogOpen(true);
  };

  /**
   * Handle rename submission
   */
  const handleRename = async (): Promise<void> => {
    const trimmedName = newName.trim();

    // Validate name
    const validationError = validateAvatarName(trimmedName);
    if (validationError) {
      toast({
        title: 'Invalid Name',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    // Check if name is unchanged
    if (trimmedName === avatar.name) {
      setIsRenameDialogOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      await updateAvatar(avatar.id, { name: trimmedName });
      toast({
        title: 'Avatar Renamed',
        description: `Successfully renamed to "${trimmedName}"`,
      });
      setIsRenameDialogOpen(false);
    } catch (error) {
      console.error('[AvatarContextMenu] Failed to rename avatar:', error);
      toast({
        title: 'Rename Failed',
        description: 'Failed to rename avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * Handle duplicate avatar
   * Creates a copy with " (Copy)" appended to name
   */
  const handleDuplicate = async (): Promise<void> => {
    setIsDuplicating(true);
    try {
      // Generate unique copy name
      let copyName = `${avatar.name} (Copy)`;
      let copyNumber = 1;

      // Ensure unique name
      while (avatarsList.some((a) => a.name === copyName)) {
        copyNumber++;
        copyName = `${avatar.name} (Copy ${copyNumber})`;
      }

      // Create new avatar with same metadata but 0% completion
      await createAvatar({
        name: copyName,
        metadata: avatar.metadata,
      });

      toast({
        title: 'Avatar Duplicated',
        description: `Created "${copyName}"`,
      });
    } catch (error) {
      console.error('[AvatarContextMenu] Failed to duplicate avatar:', error);
      toast({
        title: 'Duplicate Failed',
        description: 'Failed to duplicate avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  /**
   * Handle delete avatar
   */
  const handleDelete = async (): Promise<void> => {
    // Prevent deleting last avatar
    if (avatarsList.length === 1) {
      toast({
        title: 'Cannot Delete',
        description: 'You must have at least one avatar.',
        variant: 'destructive',
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAvatar(avatar.id);
      toast({
        title: 'Avatar Deleted',
        description: `"${avatar.name}" has been deleted.`,
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('[AvatarContextMenu] Failed to delete avatar:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle rename dialog keyboard events
   */
  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !isRenaming) {
      e.preventDefault();
      handleRename();
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleRenameClick}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Rename</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDuplicate} disabled={isDuplicating}>
            {isDuplicating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            <span>{isDuplicating ? 'Duplicating...' : 'Duplicate'}</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Delete</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Avatar</DialogTitle>
            <DialogDescription>
              Enter a new name for your avatar. This will help you identify it later.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              placeholder="Avatar name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              disabled={isRenaming}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isRenaming || !newName.trim()}>
              {isRenaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Avatar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{avatar.name}"? This action cannot be undone and
              all avatar data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
