/**
 * CustomerAvatarChip — the primary trigger for the global Customer Avatar control
 * (UX spec: ux-design-avatar-control.md — Direction D). Lives at the TOP of the v4
 * sidebar rail (`full`) and in the mobile top bar (`compact`), mirroring how
 * `ProfileMenu` (the account owner, bottom of the rail) splits full/compact.
 *
 * Owner ≠ customer: this chip uses a gold OUTLINE initial (the account owner uses a
 * SOLID gold initial), and sits at the opposite end of the shell.
 */
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { CustomerAvatarMenu, avatarInitials, summarizeAvatarSet } from './CustomerAvatarMenu';

export interface CustomerAvatarChipProps {
  /** `full` = desktop sidebar rail (initial + label + chevron); `compact` = mobile top bar (initial only). */
  variant?: 'full' | 'compact';
}

export function CustomerAvatarChip({ variant = 'full' }: CustomerAvatarChipProps): JSX.Element {
  const { avatars, contextAvatarIds } = useAvatarContext();
  const { label, focusName, count } = summarizeAvatarSet(avatars, contextAvatarIds);
  const initials = avatarInitials(focusName || null);
  const ariaLabel =
    count > 1
      ? `Switch customer — ${count} customers in the funnel analysis, focus ${focusName}`
      : `Switch customer — currently ${label}`;

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid="customer-avatar-chip"
      className={cn(
        'flex items-center gap-2 rounded-md outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-gold-warm',
        variant === 'full'
          ? 'mx-3 mb-1 mt-1 min-h-[44px] w-[calc(100%-1.5rem)] px-3 py-2 text-left hover:bg-background/10'
          : 'min-h-[44px] min-w-[44px] justify-center p-1.5 hover:bg-background/10',
      )}
    >
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold-warm text-xs font-semibold text-gold-warm"
      >
        {initials}
      </span>
      {variant === 'full' && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] leading-tight text-background/55">
              {count > 1 ? 'Funnel analysis' : 'Working as'}
            </span>
            <span className="block truncate text-sm font-medium leading-tight text-background" title={label}>
              {label}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-background/50" aria-hidden />
        </>
      )}
    </button>
  );

  return (
    <CustomerAvatarMenu
      trigger={trigger}
      side={variant === 'full' ? 'top' : 'bottom'}
      align={variant === 'full' ? 'start' : 'end'}
    />
  );
}
