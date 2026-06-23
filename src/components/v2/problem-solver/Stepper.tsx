/**
 * Problem-Solver flow — the navy top stepper (demo's `.stepper`).
 *
 * Eight clickable chips with a per-step number, label, and an optional FREE/BETA
 * tag. The current step is highlighted; completed steps get a gold check dot.
 * Clicking a chip jumps to that step (the flow shell decides whether a jump is
 * permitted — e.g. it will not let you skip the auth gate).
 */

import { PS_COLORS, PS_STEPS, type ProblemSolverStep } from './theme';

interface StepperProps {
  current: ProblemSolverStep;
  onJump: (step: ProblemSolverStep) => void;
}

export function Stepper({ current, onJump }: StepperProps): JSX.Element {
  return (
    <nav
      aria-label="Diagnostic progress"
      className="flex items-center gap-1 overflow-x-auto px-3.5 py-2.5"
      style={{ background: PS_COLORS.navy }}
    >
      {PS_STEPS.map((s, i) => {
        const isOn = s.step === current;
        const isDone = s.step < current;
        return (
          <div key={s.step} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onJump(s.step)}
              aria-current={isOn ? 'step' : undefined}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition-colors"
              style={{
                background: isOn ? PS_COLORS.navyMid : 'transparent',
                color: isOn ? '#fff' : 'rgba(255,255,255,.62)',
              }}
            >
              <span
                className="grid h-[18px] w-[18px] place-items-center rounded-full text-[10px]"
                style={{
                  background: isOn || isDone ? PS_COLORS.gold : 'rgba(255,255,255,.12)',
                  color: isOn || isDone ? PS_COLORS.navy : '#fff',
                }}
              >
                {isDone ? '✓' : s.step === 8 ? '✦' : s.step}
              </span>
              <span className={isOn ? 'inline' : 'hidden sm:inline'}>{s.label}</span>
              {s.tag && (
                <span
                  className="rounded-full px-1.5 py-px text-[8.5px] font-extrabold"
                  style={
                    s.tag === 'FREE'
                      ? { background: PS_COLORS.green, color: '#fff' }
                      : { background: 'rgba(255,255,255,.16)', color: '#fff' }
                  }
                >
                  {s.tag}
                </span>
              )}
            </button>
            {i < PS_STEPS.length - 1 && (
              <span aria-hidden style={{ color: 'rgba(255,255,255,.3)', fontSize: 11 }}>
                {i === 6 ? '·' : '›'}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
