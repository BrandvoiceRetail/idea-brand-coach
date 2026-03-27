import { Check, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
}

/**
 * Props for AvatarHeaderDropdown component
 */
interface AvatarHeaderDropdownProps {
  currentAvatar: AvatarData | null;
  avatars: AvatarData[];
  onAvatarSelect: (avatarId: string) => void;
  onCreateAvatar: () => void;
  className?: string;
}

/**
 * AvatarHeaderDropdown component
 *
 * Displays current avatar in header with dropdown to switch avatars or create new ones.
 * All state is managed externally — this component is purely presentational with callbacks.
 *
 * @example
 * ```tsx
 * <AvatarHeaderDropdown
 *   currentAvatar={{ id: "1", name: "Primary Customer" }}
 *   avatars={[{ id: "1", name: "Primary Customer" }, { id: "2", name: "Secondary" }]}
 *   onAvatarSelect={(id) => switchAvatar(id)}
 *   onCreateAvatar={() => openCreateDialog()}
 * />
 * ```
 */
export function AvatarHeaderDropdown({
  currentAvatar,
  avatars,
  onAvatarSelect,
  onCreateAvatar,
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
          <span className="truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px]">
        {avatars.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground text-sm">
            No avatars yet
          </DropdownMenuItem>
        ) : (
          avatars.map((avatar) => (
            <DropdownMenuItem
              key={avatar.id}
              onClick={() => onAvatarSelect(avatar.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="font-medium truncate">{avatar.name}</span>
              {currentAvatar?.id === avatar.id && (
                <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
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
