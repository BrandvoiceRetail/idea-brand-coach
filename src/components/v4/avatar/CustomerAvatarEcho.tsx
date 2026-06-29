/**
 * CustomerAvatarEcho — the in-stage "seeing as {customer}" echo (UX spec:
 * ux-design-avatar-control.md — Direction D). A lightweight, read-at-a-glance
 * reminder of which customer(s) the funnel is being judged as, docked in the
 * sticky SpineStepper so it rides every /v4 stage. Opens the SAME
 * CustomerAvatarMenu as the rail chip — one control, two anchors.
 *
 * Hidden when there is no active customer (honest empty — nothing to echo).
 */
import { useAvatarContext } from '@/contexts/AvatarContext';
import { CustomerAvatarMenu, avatarInitials, summarizeAvatarSet } from './CustomerAvatarMenu';

export function CustomerAvatarEcho(): JSX.Element | null {
  const { avatars, contextAvatarIds } = useAvatarContext();
  const { label, focusName, count } = summarizeAvatarSet(avatars, contextAvatarIds);
  if (count === 0) return null;

  const initials = avatarInitials(focusName || null);
  const ariaLabel =
    count > 1
      ? `Funnel seen as ${count} customers, focus ${focusName} — switch customer`
      : `Seeing the funnel as ${label} — switch customer`;

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid="customer-avatar-echo"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-background/15 bg-background/5 px-2.5 py-1 text-xs text-background/70 outline-none transition-colors hover:text-background focus-visible:ring-2 focus-visible:ring-gold-warm"
    >
      <span
        aria-hidden
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-gold-warm text-[9px] font-semibold text-gold-warm"
      >
        {initials}
      </span>
      <span className="hidden sm:inline">seeing as</span>
      <span className="max-w-[9rem] truncate font-medium text-background/90" title={label}>
        {label}
      </span>
    </button>
  );

  return <CustomerAvatarMenu trigger={trigger} side="bottom" align="end" />;
}
