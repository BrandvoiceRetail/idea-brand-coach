/**
 * Avatar Selector Component
 * Compact dropdown for switching between customer personas
 */

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Loader2 } from "lucide-react";
import { usePersistedField } from "@/hooks/usePersistedField";
import { useToast } from "@/hooks/use-toast";

/**
 * Interface for Avatar metadata
 */
interface Avatar {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

/**
 * Props for the AvatarSelector component
 */
interface AvatarSelectorProps {
  onSelectAvatar?: (avatarId: string) => void;
  className?: string;
  showCard?: boolean;
}

/**
 * Avatar Selector Component
 * Provides a dropdown interface for selecting between customer avatars
 */
export function AvatarSelector({
  onSelectAvatar,
  className = "",
  showCard = true,
}: AvatarSelectorProps): JSX.Element {
  const { toast } = useToast();

  // Persisted field for storing avatars list (JSON array)
  const avatarsField = usePersistedField({
    fieldIdentifier: 'multi_avatar_list',
    category: 'avatar',
    defaultValue: '[]',
    debounceDelay: 500
  });

  // Persisted field for active avatar ID
  const activeAvatarField = usePersistedField({
    fieldIdentifier: 'active_avatar_id',
    category: 'avatar',
    defaultValue: '',
    debounceDelay: 300
  });

  /**
   * Parse avatars from persisted JSON
   */
  const parseAvatars = (): Avatar[] => {
    try {
      const parsed = JSON.parse(avatarsField.value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const avatars = parseAvatars();
  const activeAvatarId = activeAvatarField.value;
  const activeAvatar = avatars.find(a => a.id === activeAvatarId);

  /**
   * Handle avatar selection
   */
  const handleSelectAvatar = (avatarId: string): void => {
    activeAvatarField.onChange(avatarId);
    onSelectAvatar?.(avatarId);

    const selectedAvatar = avatars.find(a => a.id === avatarId);
    if (selectedAvatar) {
      toast({
        title: "Avatar Selected",
        description: `Now working with ${selectedAvatar.name}.`
      });
    }
  };

  /**
   * Render the selector component
   */
  const renderSelector = (): JSX.Element => {
    if (avatarsField.isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading avatars...</span>
        </div>
      );
    }

    if (avatars.length === 0) {
      return (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span>No avatars created yet</span>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Select value={activeAvatarId} onValueChange={handleSelectAvatar}>
          <SelectTrigger className={className}>
            <SelectValue placeholder="Select an avatar">
              {activeAvatar ? (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{activeAvatar.name}</span>
                </div>
              ) : (
                "Select an avatar"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {avatars.map((avatar) => (
              <SelectItem key={avatar.id} value={avatar.id}>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{avatar.name}</span>
                    {avatar.description && (
                      <span className="text-xs text-muted-foreground">
                        {avatar.description}
                      </span>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeAvatar && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(activeAvatar.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  };

  // Return with or without card wrapper based on showCard prop
  if (showCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Customer Avatar
          </CardTitle>
          <CardDescription>
            Select which customer persona to work with
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderSelector()}
        </CardContent>
      </Card>
    );
  }

  return <div className={className}>{renderSelector()}</div>;
}
