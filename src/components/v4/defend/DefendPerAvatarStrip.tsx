/**
 * DefendPerAvatarStrip — the "how Defend lands per customer" badge strip.
 *
 * WHAT: A small presentational strip shown only when Defend considers a
 * multi-avatar SET (perAvatar.length > 1). Each badge names a customer and that
 * customer's own Defend posture (holding steady / N drifted / nothing yet),
 * derived deterministically from real per-avatar reads. The parent card's
 * headline is the weakest-link rollup of these (drift = union across the set).
 *
 * WHY: When Defend is scoped to several customers, the set headline can hide that
 * the picture differs per customer. This surfaces the breakdown honestly — never
 * an invented state. Mirrors the Fix FunnelPieceDetail per-customer strip.
 *
 * Tier-A vocabulary only; v23 semantic tokens (no hex).
 */
import type { DefendAvatarStatus, DefendVerdict } from '@/types/v4Defend';
import { cn } from '@/lib/utils';

/** Plain-language label + tone per verdict, for the per-customer breakdown strip. */
const VERDICT_LABEL: Readonly<Record<DefendVerdict, string>> = {
  holding: 'holding steady',
  drifted: 'drifted',
  none: 'nothing to defend yet',
};
const VERDICT_TONE: Readonly<Record<DefendVerdict, string>> = {
  holding: 'border-idea-d/30 bg-idea-d/5 text-idea-d',
  drifted: 'border-gold-warm/40 bg-gold-warm/10 text-gold-warm',
  none: 'border-border bg-muted text-muted-foreground',
};

/** One customer's label — uses the real drifted count when something drifted. */
function labelFor(s: DefendAvatarStatus): string {
  if (s.verdict === 'drifted') {
    return `${s.driftCount} drifted`;
  }
  return VERDICT_LABEL[s.verdict];
}

export interface DefendPerAvatarStripProps {
  /** Per-customer Defend posture; the strip self-hides unless length > 1. */
  perAvatar: DefendAvatarStatus[];
  /** Caption above the badges; defaults to the drift-watch phrasing. */
  caption?: string;
}

export function DefendPerAvatarStrip({
  perAvatar,
  caption = 'How it lands per customer',
}: DefendPerAvatarStripProps): JSX.Element | null {
  if (perAvatar.length <= 1) return null;
  return (
    <div
      className="rounded-md border border-border bg-muted/40 px-3 py-3"
      data-testid="v4-defend-per-avatar"
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {caption}
      </p>
      <ul className="flex flex-wrap gap-2">
        {perAvatar.map((s) => (
          <li
            key={s.avatarId}
            data-testid={`v4-defend-per-avatar-${s.avatarId}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              VERDICT_TONE[s.verdict],
            )}
          >
            <span className="max-w-[10rem] truncate" title={s.avatarName}>
              {s.avatarName}
            </span>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span>{labelFor(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
