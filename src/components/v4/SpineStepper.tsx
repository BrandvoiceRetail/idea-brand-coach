/**
 * SpineStepper — the sticky Diagnose → Analyse → Fix → Re-measure → Defend
 * progress rail shown at the top of every /v4 screen. Reads the active stage
 * from the current route and renders past / current / upcoming beats as an
 * inline black bar with a gold active beat (matches the v23 app design).
 *
 * Mobile-first: horizontally scrollable, no overflow at 375px; each beat is a
 * tap target that navigates to its stage.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { V4_SPINE, activeStageFor } from '@/config/v4';
import { useSpineCompletion } from '@/hooks/useSpineCompletion';

export function SpineStepper(): JSX.Element {
  const { pathname } = useLocation();
  const active = activeStageFor(pathname);
  const completion = useSpineCompletion();

  return (
    <nav
      aria-label="Brand journey progress"
      className="v4-chrome sticky top-12 z-20 w-full bg-foreground md:top-0"
    >
      <ol className="flex items-center gap-1 overflow-x-auto px-3 py-2.5 sm:px-4">
        {V4_SPINE.map((stage, i) => {
          const isDone = completion[stage.key];
          const isCurrent = active?.key === stage.key;
          return (
            <li key={stage.key} className="flex shrink-0 items-center gap-1">
              <NavLink
                to={stage.path}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors',
                  isCurrent
                    ? 'bg-gold-warm text-foreground'
                    : 'text-background/55 hover:text-background',
                )}
              >
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold',
                    isCurrent ? 'bg-foreground/20 text-background' : 'bg-background/15 text-background/80',
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {stage.label}
              </NavLink>
              {i < V4_SPINE.length - 1 && (
                <span aria-hidden className="px-0.5 text-sm text-background/30">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
