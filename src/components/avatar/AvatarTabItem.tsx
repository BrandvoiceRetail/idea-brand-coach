import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getCompletionLabel, getCompletionVariant } from '@/hooks/useAvatarCompletion';
import type { Avatar } from '@/types/avatar';

interface AvatarTabItemProps extends React.HTMLAttributes<HTMLButtonElement> {
  avatar: Avatar;
  isActive?: boolean;
  onDelete?: (avatarId: string) => void;
}

/**
 * AvatarTabItem Component
 *
 * Displays an individual avatar tab with name and completion badge.
 * Supports active state styling and optional delete functionality.
 */
export const AvatarTabItem = React.forwardRef<HTMLButtonElement, AvatarTabItemProps>(
  ({ avatar, isActive = false, onDelete, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-muted/50',
          className
        )}
        role="tab"
        aria-selected={isActive}
        aria-label={`${avatar.name} - ${getCompletionLabel(avatar.completion_percentage)}`}
        {...props}
      >
        <span className="truncate max-w-[120px]">{avatar.name}</span>
        <Badge
          variant={getCompletionVariant(avatar.completion_percentage)}
          className="text-xs"
        >
          {avatar.completion_percentage}%
        </Badge>
      </button>
    );
  }
);

AvatarTabItem.displayName = 'AvatarTabItem';
