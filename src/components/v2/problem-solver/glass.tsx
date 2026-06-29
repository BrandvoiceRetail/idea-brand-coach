/**
 * Dark-liquid-glass component kit for the diagnose surface.
 *
 * Ports the spec mock (`_bmad-output/planning-artifacts/trust-gap-diagnostic-mock.html`)
 * into reusable React pieces, driven by the shared `.glass` / `.glass-strong` /
 * `.sheen` utilities (index.css) so they follow the active light/dark theme. UK
 * English throughout. Motion honours `prefers-reduced-motion` via `.animate-view-in`.
 *
 * Source spec: ux-design-entry-experience.md §"Visual & Interaction Language" +
 * §"Component inventory".
 */
import { cn } from '@/lib/utils';

/** A single lit glass surface. `strong` = the hero-weight panel; `sheen` adds the wet-glass specular. */
export function GlassPanel({
  strong = false,
  sheen = true,
  className,
  children,
  ...rest
}: {
  strong?: boolean;
  sheen?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn(strong ? 'glass-strong' : 'glass', sheen && 'sheen', className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * The centred stage for ONE movement (one screen, one job). Provides the ambient
 * gold-lit backdrop the glass refracts and vertically centres a narrow column.
 */
export function MovementShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="glass-stage flex min-h-[60vh] w-full flex-col items-center justify-center py-6">
      <div className={cn('animate-view-in mx-auto w-full max-w-[460px]', className)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Cinematic Recognition hero — the cliff/chasm image fades in behind everything,
 * with a glass mirror panel floating over it. The image is decorative.
 */
export function CinematicHero({
  image,
  children,
}: {
  image?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="glass-stage relative flex min-h-[68vh] w-full flex-col items-center justify-center py-8">
      {image && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-[1] overflow-hidden">
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-70"
            style={{ backgroundImage: `url('${image}')` }}
          />
          <div className="absolute inset-0" style={{ background: 'var(--cine-tint)' }} />
        </div>
      )}
      <div className="animate-view-in mx-auto w-full max-w-[460px]">{children}</div>
    </div>
  );
}

/** Gold uppercase eyebrow used across the movements + results. */
export function GlassEyebrow({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-3.5 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-gold-warm">
      {children}
    </div>
  );
}

/** Slim gold progress hairline for the four-question flow. */
export function ProgressHairline({ value }: { value: number }): JSX.Element {
  return (
    <div className="my-5 h-[3px] overflow-hidden rounded-full bg-foreground/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#B97D06] to-[#E7A412] shadow-[0_0_12px_rgba(212,150,10,0.5)] transition-[width] duration-500 ease-[cubic-bezier(0.22,0.8,0.3,1)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export interface QuestionScaleProps {
  index: number; // 0-based
  total: number;
  question: string;
  hint?: string;
  ends: [string, string]; // [low label, high label]
  value?: number; // 1-5 selected
  onAnswer: (value: number) => void;
}

/** One question at a time — a 1–5 radiogroup scale (arrow-key navigable). */
export function QuestionScale({
  index,
  total,
  question,
  hint,
  ends,
  value,
  onAnswer,
}: QuestionScaleProps): JSX.Element {
  return (
    <GlassPanel className="animate-view-in p-6">
      <div className="mb-2 text-[0.74rem] font-bold uppercase tracking-wide text-muted-foreground">
        Question {index + 1} of {total}
      </div>
      <div className="font-display mb-1.5 text-[1.34rem] font-medium leading-snug text-foreground">
        {question}
      </div>
      {hint && <div className="mb-5 text-[0.86rem] text-muted-foreground">{hint}</div>}
      <div
        role="radiogroup"
        aria-label={question}
        className="mb-3.5 grid grid-cols-5 gap-2.5"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${n} of 5`}
              onClick={() => onAnswer(n)}
              className={cn(
                'font-display rounded-2xl border py-3 text-[1.15rem] font-semibold backdrop-blur transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-warm',
                selected
                  ? 'border-transparent bg-gradient-to-br from-[#E7A412] to-[#B97D06] text-[#1a1206] shadow-[0_10px_26px_rgba(212,150,10,0.4)]'
                  : 'border-border bg-foreground/[0.04] text-foreground hover:-translate-y-[3px] hover:border-gold-warm/40 hover:bg-gold-warm/10',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between text-[0.74rem] text-muted-foreground">
        <span>1 · {ends[0]}</span>
        <span>{ends[1]} · 5</span>
      </div>
    </GlassPanel>
  );
}

/** Component 0 — the finding, large display, faint gold glow (results hero, AC#5). */
export function Component0Hero({
  eyebrow = 'What we can already see',
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <GlassPanel strong className="animate-view-in p-7">
      <GlassEyebrow>{eyebrow}</GlassEyebrow>
      <div className="font-display text-[1.6rem] font-bold leading-[1.22] text-foreground [text-shadow:0_0_26px_rgba(212,150,10,0.12)]">
        {children}
      </div>
    </GlassPanel>
  );
}

export interface PillarRow {
  name: string;
  /** 0–100 */
  value: number;
  weak?: boolean;
  /** display label e.g. "12/25" */
  display: string;
}

/** Trust Gap score + four-pillar breakdown — recedes BELOW the finding (AC#5). */
export function ScorePillars({
  score,
  pillars,
}: {
  score: number; // 0-100
  pillars: PillarRow[];
}): JSX.Element {
  return (
    <GlassPanel className="mt-4 p-6">
      <div className="mb-[18px] flex items-baseline gap-3">
        <div className="font-display text-[2.5rem] font-semibold leading-none text-foreground">
          {Math.round(score)}
          <small className="text-[1.1rem] font-medium text-muted-foreground">/100</small>
        </div>
        <div className="text-[0.74rem] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
          Trust&nbsp;Gap
          <br />
          Score
        </div>
      </div>
      <div className="grid gap-2.5">
        {pillars.map((p) => (
          <div key={p.name} className="grid grid-cols-[100px_1fr_40px] items-center gap-2.5">
            <div className="text-[0.82rem] text-muted-foreground">{p.name}</div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,0.8,0.3,1)]',
                  p.weak
                    ? 'bg-gradient-to-r from-[#7a3b2e] to-[#c4623f]'
                    : 'bg-gradient-to-r from-[#8a6512] to-[#E7A412]',
                )}
                style={{ width: `${Math.max(0, Math.min(100, p.value))}%` }}
              />
            </div>
            <div className="text-right text-[0.8rem] tabular-nums text-muted-foreground">
              {p.display}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/** The Diagnose→Analyse→Fix→Re-measure→Defend loop diagram + its one line (AC#6). */
export function DefenceLoop({
  active = 'Diagnose',
  note = 'Your Trust Gap Score is the start of the loop, not the end of it. The gap closes. Competitors move. The engine watches both.',
}: {
  active?: string;
  note?: string;
}): JSX.Element {
  const nodes = ['Diagnose', 'Analyse', 'Fix', 'Re-measure', 'Defend'];
  return (
    <GlassPanel className="mt-4 p-6">
      <div className="mb-3.5 flex flex-wrap items-center justify-center gap-1.5">
        {nodes.map((node, i) => (
          <span key={node} className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold',
                node === active
                  ? 'border-gold-warm/40 bg-gold-warm/10 text-gold-warm'
                  : 'border-border bg-foreground/[0.05] text-muted-foreground',
              )}
            >
              {node}
            </span>
            {i < nodes.length - 1 && <span className="text-[0.8rem] text-muted-foreground">→</span>}
          </span>
        ))}
      </div>
      <p className="text-center text-[0.84rem] leading-relaxed text-muted-foreground">{note}</p>
    </GlassPanel>
  );
}
