/**
 * AvatarTabNavigation Component
 *
 * Responsive tab navigation for switching between multiple avatars.
 * - Mobile (<md): Fixed bottom positioning
 * - Desktop (md+): Static top positioning
 * - Supports 100+ avatars with ScrollArea
 * - Create new avatar button
 */

import * as React from 'react';
import { useState } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { AvatarTabItem } from './AvatarTabItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AvatarTabNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Responsive mode
   * - 'mobile': Fixed bottom positioning
   * - 'desktop': Static top positioning
   * - 'auto': Responsive (bottom on mobile, top on desktop)
   * @default 'auto'
   */
  mode?: 'mobile' | 'desktop' | 'auto';
}

/**
 * AvatarTabNavigation component displays a responsive tab navigation
 * for switching between multiple avatars
 */
export function AvatarTabNavigation({
  mode = 'auto',
  className,
  ...props
}: AvatarTabNavigationProps): JSX.Element {
  const {
    currentAvatarId,
    avatarsList,
    switchAvatar,
    createAvatar,
    isLoadingAvatars,
  } = useBrand();

  const { toast } = useToast();

  // Dialog state for creating new avatar
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAvatarName, setNewAvatarName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  /**
   * Handle creating a new avatar
   */
  const handleCreateAvatar = async (): Promise<void> => {
    if (!newAvatarName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your avatar.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      await createAvatar({ name: newAvatarName.trim() });
      setIsCreateDialogOpen(false);
      setNewAvatarName('');
    } catch (error) {
      // Error already handled by createAvatar (shows toast)
      console.error('[AvatarTabNavigation] Failed to create avatar:', error);
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle switching to a different avatar
   */
  const handleSwitchAvatar = (avatarId: string): void => {
    if (avatarId === currentAvatarId) return;
    switchAvatar(avatarId);
  };

  /**
   * Handle dialog keyboard events
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !isCreating) {
      e.preventDefault();
      handleCreateAvatar();
    }
  };

  // Determine responsive classes based on mode
  const getContainerClasses = (): string => {
    if (mode === 'mobile') {
      return 'fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60';
    }
    if (mode === 'desktop') {
      return 'border-b bg-background';
    }
    // mode === 'auto'
    return 'md:border-b md:bg-background md:static fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:backdrop-blur-none md:supports-[backdrop-filter]:bg-background';
  };

  return (
    <div
      className={cn(getContainerClasses(), className)}
      role="tablist"
      aria-label="Avatar navigation"
      {...props}
    >
      <div className="flex items-center gap-2 p-2">
        {/* Scrollable avatar tabs */}
        <ScrollArea className="flex-1 w-full">
          <div className="flex gap-1 min-w-min px-1">
            {isLoadingAvatars ? (
              <div className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading avatars...
              </div>
            ) : avatarsList.length === 0 ? (
              <div className="flex items-center justify-center py-3 px-4 text-sm text-muted-foreground">
                No avatars yet. Create your first avatar!
              </div>
            ) : (
              avatarsList.map((avatar) => (
                <AvatarTabItem
                  key={avatar.id}
                  avatar={avatar}
                  isActive={avatar.id === currentAvatarId}
                  onClick={() => handleSwitchAvatar(avatar.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Create new avatar button */}
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIsCreateDialogOpen(true)}
          aria-label="Create new avatar"
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Avatar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Avatar</DialogTitle>
            <DialogDescription>
              Give your new customer avatar a descriptive name to help you identify it later.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              placeholder="e.g., Tech-Savvy Millennial, Budget-Conscious Parent"
              value={newAvatarName}
              onChange={(e) => setNewAvatarName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAvatar}
              disabled={isCreating || !newAvatarName.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Avatar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
