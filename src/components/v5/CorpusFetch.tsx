/**
 * CorpusFetch — /v5 step ②: the three fetch steps + the review count-up.
 *
 * DRIVEN BY REAL PROGRESS, not timers: the parent ticks `stepIndex` as each
 * await resolves (import → reviews read → scope/analysis prepared) and passes
 * the REAL review count when known. The count-up animation is presentation on
 * top of a real number, never a fabricated one.
 */
import { useEffect, useState } from 'react';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import { V5Stage } from './V5Chrome';

export interface CorpusFetchProps {
  /** Listing label shown in the chip (title when known, else the ASIN). */
  listingLabel: string;
  /** 0 = reading listing, 1 = fetching reviews, 2 = preparing analysis; 3 = all done. */
  stepIndex: number;
  /** Real review count once the corpus is read (null while unknown). */
  reviewCount: number | null;
  /** Skip the count-up animation (express / reduced motion). */
  instant?: boolean;
}

const STEPS = [
  { icon: '📄', title: 'Reading your listing', sub: 'Title, bullets, trust signals' },
  { icon: '⭐', title: 'Fetching your reviews', sub: 'Pulling the corpus for analysis' },
  { icon: '🔬', title: 'Preparing forensic analysis', sub: 'Classifying emotional language patterns' },
] as const;

const COUNT_TICK_MS = 40;

export function CorpusFetch({
  listingLabel,
  stepIndex,
  reviewCount,
  instant = false,
}: CorpusFetchProps): JSX.Element {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reviewCount === null) return;
    if (instant) {
      setShown(reviewCount);
      return;
    }
    const t = window.setInterval(() => {
      setShown((c) => {
        const next = c + Math.max(1, Math.ceil(reviewCount / 16));
        if (next >= reviewCount) {
          window.clearInterval(t);
          return reviewCount;
        }
        return next;
      });
    }, COUNT_TICK_MS);
    return () => window.clearInterval(t);
  }, [reviewCount, instant]);

  return (
    <V5Stage className="text-center">
      <GlassEyebrow>Avatar 2.0 · analysis in progress</GlassEyebrow>
      <h1 className="font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
        Reading your brand through
        <br />
        your customers&apos; eyes
      </h1>

      <GlassPanel sheen={false} className="mx-auto mb-9 mt-5 inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13px] text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-idea-d shadow-[0_0_8px_hsl(var(--idea-d))]" aria-hidden />
        {listingLabel}
      </GlassPanel>

      <div className="mx-auto mb-8 flex max-w-[400px] flex-col text-left" role="status" aria-live="polite">
        {STEPS.map((step, i) => {
          const done = stepIndex > i;
          const active = stepIndex === i;
          return (
            <div
              key={step.title}
              className={`flex items-center gap-3.5 border-b border-foreground/[0.06] px-1 py-3.5 transition-opacity ${
                active ? 'opacity-100' : done ? 'opacity-60' : 'opacity-30'
              }`}
            >
              <div
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border text-[13px] ${
                  done
                    ? 'border-idea-d bg-idea-d/15'
                    : active
                      ? 'animate-pulse border-gold-warm bg-gold-warm/15'
                      : 'border-border bg-foreground/[0.05]'
                }`}
                aria-hidden
              >
                {done ? '✓' : step.icon}
              </div>
              <div>
                <div className="text-[15px] text-foreground">{step.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground/80">{step.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {reviewCount !== null && (
        <div>
          <div className="font-display text-5xl font-extrabold leading-none tracking-tight text-gold-warm">
            {shown}
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground">
            {reviewCount === 1 ? 'review found.' : 'reviews found.'} Beginning the Avatar build.
          </div>
        </div>
      )}
    </V5Stage>
  );
}
