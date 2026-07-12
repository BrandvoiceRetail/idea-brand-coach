/**
 * Problem-Solver flow — small presentational primitives shared by the screens.
 *
 * BrandBar, Eyebrow, ScreenHeading, Lede + the buttons/card reproduce the demo's
 * repeated chrome so each screen stays focused on its own content. Pure
 * presentational — no state, no engine calls.
 *
 * These now use the v23 SEMANTIC TOKENS (and the shared `.glass` utility) instead
 * of hardcoded PS_COLORS, so every screen follows the active light/dark theme and
 * matches the /v4 shell it lives in — no more dark island in a light app.
 */

/** The brand header strip with the gold "IB" mark (demo `nav.brand`). */
export function BrandBar({ note }: { note: string }): JSX.Element {
  return (
    <div className="flex h-[54px] items-center justify-between border-b border-border bg-foreground px-5 text-background">
      <div className="flex items-center gap-2.5 text-sm font-extrabold">
        <span className="grid h-[26px] w-[26px] place-items-center rounded-md bg-gold-warm text-xs font-black text-foreground">
          IB
        </span>
        IDEA <span className="text-gold-warm">Brand Coach</span>
      </div>
      <div className="text-xs font-bold tracking-wide text-background/60">{note}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-gold-warm">
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
    <h1 className="font-display mb-2 text-[22px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[27px]">
      {children}
      {accent && <span className="text-gold-warm"> {accent}</span>}
    </h1>
  );
}

export function Lede({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="mb-4 max-w-xl text-[15px] text-muted-foreground">{children}</p>;
}

/** A gold pill button matching the spec mock `.btn-gold`. */
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
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#E7A412] to-[#B97D06] px-5 py-3 text-sm font-extrabold text-[#1a1206] shadow-[0_10px_28px_rgba(212,150,10,0.34)] transition-transform hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-warm focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:translate-y-0 disabled:opacity-50 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

/** A ghost (outlined glass) button matching the spec mock `.btn-ghost`. */
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
      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-foreground/[0.04] px-5 py-3 text-sm font-extrabold text-foreground backdrop-blur transition-colors hover:bg-foreground/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-warm"
    >
      {children}
    </button>
  );
}

/** A card matching the demo `.card` — now a themed token surface. */
export function PSCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`mb-4 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-card ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
