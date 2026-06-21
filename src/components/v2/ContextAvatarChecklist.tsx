/**
 * ContextAvatarChecklist — the "one surface switches" multi-toggle.
 *
 * Presentational multi-select for the active coaching avatar SET (Multi-Avatar
 * design §2.2). A popover trigger shows the active set ("Coaching: A, B (2)");
 * the popover lists every avatar with a checkbox. Toggling routes to the owner's
 * `onToggle` (AvatarContext.toggleAvatarInContext) — which never empties the set,
 * so the LAST checked member is rendered disabled to keep ≥1 selected.
 *
 * State is owned externally; this component is pure props + callbacks.
 */

import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Minimal avatar shape this checklist needs. */
export interface ContextAvatarOption {
  id: string;
  name: string;
}

interface ContextAvatarChecklistProps {
  avatars: ContextAvatarOption[];
  /** The active context set (order = focus first). */
  selectedIds: string[];
  /** Add/remove one member — must never empty the set (owner enforces). */
  onToggle: (id: string) => void;
  className?: string;
}

/** Build the trigger label: focus-first names + count, e.g. "Coaching: A, B (2)". */
function buildTriggerLabel(avatars: ContextAvatarOption[], selectedIds: string[]): string {
  const names = selectedIds
    .map((id) => avatars.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return 'Coaching: none';
  return `Coaching: ${names.join(', ')} (${names.length})`;
}

/**
 * ContextAvatarChecklist component
 *
 * Multi-toggle for the coaching avatar SET. Reuses shadcn popover + checkbox +
 * badge primitives; the last checked member is disabled so the set stays ≥1.
 */
export function ContextAvatarChecklist({
  avatars,
  selectedIds,
  onToggle,
  className,
}: ContextAvatarChecklistProps): JSX.Element {
  const triggerLabel = buildTriggerLabel(avatars, selectedIds);
  // Removing the last member is not allowed — disable its checkbox so the set
  // never empties (mirrors toggleAvatarInContext's no-empty contract).
  const lastChecked = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('flex items-center gap-2 min-w-[180px] justify-between', className)}
          aria-label="Choose coaching avatars"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <Badge variant="secondary" className="shrink-0">
            {selectedIds.length}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-2">
        <div className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
          Coaching across
        </div>
        {avatars.length === 0 ? (
          <div className="px-1 py-1.5 text-sm text-muted-foreground">No avatars yet</div>
        ) : (
          <ul className="space-y-0.5" role="group" aria-label="Coaching avatars">
            {avatars.map((avatar) => {
              const checked = selectedIds.includes(avatar.id);
              const disabled = checked && avatar.id === lastChecked;
              return (
                <li key={avatar.id}>
                  <label
                    className={cn(
                      'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-accent',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => onToggle(avatar.id)}
                      aria-label={avatar.name}
                    />
                    <span className="truncate">{avatar.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-1.5 px-1 pt-1.5 text-[11px] text-muted-foreground border-t">
          Keep at least one avatar selected.
        </div>
      </PopoverContent>
    </Popover>
  );
}
