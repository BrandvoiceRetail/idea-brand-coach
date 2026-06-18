import { Check, ChevronDown, Plus, MoreVertical, Pencil, Copy, Trash2, Star, FlaskConical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared avatar data shape used across header components
 */
export interface AvatarData {
  id: string;
  name: string;
  image_url?: string | null;
  /** Whether this avatar is the brand's primary (the star). */
  is_primary?: boolean;
}

/**
 * Props for AvatarHeaderDropdown component
 */
interface AvatarHeaderDropdownProps {
  currentAvatar: AvatarData | null;
  avatars: AvatarData[];
  onAvatarSelect: (avatarId: string) => void;
  onCreateAvatar: () => void;
  /** Rename an avatar (opens the rename dialog in the parent). */
  onRenameAvatar: (avatarId: string) => void;
  /** Duplicate an avatar (one-click). */
  onDuplicateAvatar: (avatarId: string) => void;
  /** Delete an avatar (opens the delete-confirm in the parent). */
  onDeleteAvatar: (avatarId: string) => void;
  /** Mark an avatar as the brand's primary. */
  onSetPrimaryAvatar: (avatarId: string) => void;
  /** Open the forensic build flow for an avatar. */
  onForensicBuild: (avatarId: string) => void;
  className?: string;
}

/**
 * AvatarHeaderDropdown component
 *
 * Displays current avatar in the header with a dropdown to switch avatars, create
 * new ones, and (per row) a kebab submenu of CRUD actions: rename, duplicate,
 * set-primary, forensic build, delete. The primary avatar shows a star. All state
 * is owned externally — this component is presentational with callbacks (P4b §4.5).
 */
export function AvatarHeaderDropdown({
  currentAvatar,
  avatars,
  onAvatarSelect,
  onCreateAvatar,
  onRenameAvatar,
  onDuplicateAvatar,
  onDeleteAvatar,
  onSetPrimaryAvatar,
  onForensicBuild,
  className,
}: AvatarHeaderDropdownProps): JSX.Element {
  const displayName = currentAvatar?.name || "Select Avatar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "flex items-center gap-2 min-w-[180px] justify-between",
            className
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            {currentAvatar?.is_primary && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            )}
            <span className="truncate">{displayName}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        {avatars.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground text-sm">
            No avatars yet
          </DropdownMenuItem>
        ) : (
          avatars.map((avatar) => (
            <div key={avatar.id} className="flex items-center">
              <DropdownMenuItem
                onClick={() => onAvatarSelect(avatar.id)}
                className="flex flex-1 items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {avatar.is_primary && (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                  )}
                  <span className="font-medium truncate">{avatar.name}</span>
                </span>
                {currentAvatar?.id === avatar.id && (
                  <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                )}
              </DropdownMenuItem>

              {/* Per-avatar kebab CRUD submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="px-2 py-1.5 cursor-pointer [&>svg:last-child]:hidden"
                  aria-label={`Manage ${avatar.name}`}
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onRenameAvatar(avatar.id)} className="cursor-pointer gap-2">
                    <Pencil className="h-4 w-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicateAvatar(avatar.id)} className="cursor-pointer gap-2">
                    <Copy className="h-4 w-4" />
                    <span>Duplicate</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onSetPrimaryAvatar(avatar.id)}
                    disabled={avatar.is_primary}
                    className="cursor-pointer gap-2"
                  >
                    <Star className="h-4 w-4" />
                    <span>{avatar.is_primary ? "Primary" : "Set as primary"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onForensicBuild(avatar.id)} className="cursor-pointer gap-2">
                    <FlaskConical className="h-4 w-4" />
                    <span>Forensic build</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteAvatar(avatar.id)}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </div>
          ))
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onCreateAvatar}
          className="flex items-center gap-2 cursor-pointer text-primary"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Avatar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
