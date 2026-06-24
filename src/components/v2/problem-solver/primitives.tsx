/**
 * Problem-Solver flow — small presentational primitives shared by the screens.
 *
 * BrandBar (the navy header with the gold "IB" mark), Eyebrow, ScreenHeading,
 * and Lede reproduce the demo's repeated chrome so each screen stays focused on
 * its own content. Pure presentational — no state, no engine calls.
 */

import { PS_COLORS } from './theme';

/** The navy brand header strip with the contextual note (demo `nav.brand`). */
export function BrandBar({ note }: { note: string }): JSX.Element {
  return (
    <div
      className="flex h-[54px] items-center justify-between px-5"
      style={{ background: PS_COLORS.navy }}
    >
      <div className="flex items-center gap-2.5 text-sm font-extrabold text-white">
        <span
          className="grid h-[26px] w-[26px] place-items-center rounded-md text-xs font-black"
          style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
        >
          IB
        </span>
        IDEA <span style={{ color: PS_COLORS.gold }}>Brand Coach</span>
      </div>
      <div className="text-xs font-bold tracking-wide" style={{ color: 'rgba(255,255,255,.6)' }}>
        {note}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em]"
      style={{ color: PS_COLORS.gold }}
    >
      {children}
    </div>
  );
}

/** Big screen heading. Pass `accent` to gold-highlight a trailing phrase. */
export function ScreenHeading({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: string;
}): JSX.Element {
  return (
    <h1
      className="mb-2 text-[22px] font-extrabold leading-tight tracking-tight sm:text-[27px]"
      style={{ color: PS_COLORS.navy }}
    >
      {children}
      {accent && <span style={{ color: PS_COLORS.gold }}> {accent}</span>}
    </h1>
  );
}

export function Lede({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <p className="mb-4 max-w-xl text-[15px]" style={{ color: PS_COLORS.g500 }}>
      {children}
    </p>
  );
}

/** A gold pill button matching the demo `.btn.gold`. */
export function GoldButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-extrabold transition-opacity disabled:opacity-50 ${className ?? ''}`}
      style={{ background: PS_COLORS.gold, color: PS_COLORS.navy }}
    >
      {children}
    </button>
  );
}

/** A ghost (outlined) button matching the demo `.btn.ghost`. */
export function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-[10px] border bg-white px-5 py-3 text-sm font-extrabold"
      style={{ borderColor: '#D0D5DD', color: PS_COLORS.navy }}
    >
      {children}
    </button>
  );
}

/** A card matching the demo `.card`. */
export function PSCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`mb-4 rounded-2xl border bg-white p-5 ${className ?? ''}`}
      style={{ borderColor: PS_COLORS.line, boxShadow: '0 1px 3px rgba(16,24,40,.10)' }}
    >
      {children}
    </div>
  );
}
