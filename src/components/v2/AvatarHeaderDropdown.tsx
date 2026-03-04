import * as React from "react";
import { Check, Loader2, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Avatar interface for dropdown list
 */
interface Avatar {
  id: string;
  name: string;
  completionPercentage: number;
}

/**
 * Props for AvatarHeaderDropdown component
 */
interface AvatarHeaderDropdownProps {
  className?: string;
}

/**
 * AvatarHeaderDropdown component
 *
 * Displays current avatar in header with dropdown to switch avatars or create new ones.
 * Uses dropdown-menu for avatar selection and dialog for creating new avatars.
 *
 * @example
 * ```tsx
 * <AvatarHeaderDropdown />
 * ```
 */
export function AvatarHeaderDropdown({ className }: AvatarHeaderDropdownProps): JSX.Element {
  // State for dialog
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [newAvatarName, setNewAvatarName] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);

  // TODO: Replace with useBrand() hook when avatar management methods are added
  // const { currentAvatarId, avatarsList, switchAvatar, createAvatar, isLoadingAvatars } = useBrand();

  // Temporary mock data until BrandContext is extended
  const [currentAvatarId, setCurrentAvatarId] = React.useState<string | null>("1");
  const [avatarsList] = React.useState<Avatar[]>([
    { id: "1", name: "Primary Customer", completionPercentage: 75 },
    { id: "2", name: "Secondary Audience", completionPercentage: 45 },
  ]);
  const [isLoadingAvatars] = React.useState(false);

  // Get current avatar name for display
  const getCurrentAvatarName = (): string => {
    if (!currentAvatarId) {
      return "Select Avatar";
    }
    const currentAvatar = avatarsList.find(avatar => avatar.id === currentAvatarId);
    return currentAvatar?.name || "Select Avatar";
  };

  // Handle avatar selection
  const handleAvatarSwitch = (avatarId: string): void => {
    // TODO: Replace with switchAvatar(avatarId) when available
    setCurrentAvatarId(avatarId);
  };

  // Handle create new avatar
  const handleCreateAvatar = async (): Promise<void> => {
    if (!newAvatarName.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      // TODO: Replace with createAvatar(newAvatarName) when available
      await new Promise(resolve => setTimeout(resolve, 500)); // Mock API call

      // Reset form and close dialog
      setNewAvatarName("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to create avatar:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle dialog cancel
  const handleDialogCancel = (): void => {
    setNewAvatarName("");
    setIsDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex items-center gap-2 min-w-[180px] justify-between",
              className
            )}
          >
            <span className="truncate">{getCurrentAvatarName()}</span>
            {isLoadingAvatars && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[240px]">
          {avatarsList.map((avatar) => (
            <DropdownMenuItem
              key={avatar.id}
              onClick={() => handleAvatarSwitch(avatar.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex flex-col gap-1 flex-1">
                <span className="font-medium">{avatar.name}</span>
                <span className="text-xs text-muted-foreground">
                  {avatar.completionPercentage}% complete
                </span>
              </div>
              {currentAvatarId === avatar.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 cursor-pointer text-primary"
          >
            <Plus className="h-4 w-4" />
            <span>Create New Avatar</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Avatar</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="avatar-name">Avatar Name</Label>
              <Input
                id="avatar-name"
                placeholder="e.g., Enterprise Customer"
                value={newAvatarName}
                onChange={(e) => setNewAvatarName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateAvatar();
                  }
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDialogCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAvatar}
              disabled={!newAvatarName.trim() || isCreating}
            >
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
