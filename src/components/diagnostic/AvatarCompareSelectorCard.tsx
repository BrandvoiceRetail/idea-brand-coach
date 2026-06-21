/**
 * AvatarCompareSelectorCard — Feature Map Loop 09 B2 (side-by-side compare).
 *
 * A read-only checklist on the diagnostic/funnel surface that lets the user pick
 * which avatars to COMPARE against the brand baseline. Selection is a SET (the
 * multi-avatar context model); the page fetches each selected avatar's overlay
 * and renders the comparison. This card holds no fetch logic — it only emits the
 * chosen id set via {@link AvatarCompareSelectorCardProps.onChange}.
 *
 * NOTE: this is comparison selection, NOT a context switch — picking avatars here
 * never mutates the active retrieval set (no blended coaching).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { Avatar } from '@/types/avatar';

export interface AvatarCompareSelectorCardProps {
  /** Avatars the user can compare (templates are filtered out by the caller). */
  avatars: Avatar[];
  /** Currently-selected avatar ids to compare against the brand baseline. */
  selectedIds: string[];
  /** Emits the next selected-id set when a checkbox toggles. */
  onChange: (ids: string[]) => void;
}

export function AvatarCompareSelectorCard({
  avatars,
  selectedIds,
  onChange,
}: AvatarCompareSelectorCardProps): JSX.Element | null {
  // Nothing to compare against when the user has no avatars.
  if (avatars.length === 0) return null;

  const selected = new Set(selectedIds);

  const toggle = (avatarId: string): void => {
    const next = new Set(selected);
    if (next.has(avatarId)) {
      next.delete(avatarId);
    } else {
      next.add(avatarId);
    }
    // Preserve the avatars-list order so the comparison columns are stable.
    onChange(avatars.filter((avatar) => next.has(avatar.id)).map((avatar) => avatar.id));
  };

  return (
    <Card data-testid="avatar-compare-selector">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" />
          Compare avatars
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Pick the avatars to see side by side against your brand baseline. This is a read-only
          comparison — it does not change your coaching context.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {avatars.map((avatar) => {
          const checked = selected.has(avatar.id);
          const checkboxId = `compare-avatar-${avatar.id}`;
          return (
            <label
              key={avatar.id}
              htmlFor={checkboxId}
              className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={() => toggle(avatar.id)}
                aria-label={`Compare ${avatar.name}`}
              />
              <span className="flex-1 text-sm font-medium">{avatar.name}</span>
              {avatar.is_primary && (
                <Badge variant="outline" className="shrink-0">
                  Primary
                </Badge>
              )}
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
