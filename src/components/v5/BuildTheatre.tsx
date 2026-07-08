/**
 * BuildTheatre — /v5 step ③: the live Avatar build. Renders the progress rail,
 * the beats revealed so far (each only after its stage has really computed),
 * an honest "still reading" line while the next stage runs, the run-error
 * state with retry, and the co-sign panel once all four beats are on screen.
 * Presentation order is the narrative order; the compute order is the hook's.
 */
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassEyebrow } from '@/components/v2/problem-solver/glass';
import { V5Stage } from './V5Chrome';
import { TheatreBeat } from './TheatreBeat';
import { StageControls } from './StageControls';
import { CoSignPanel } from './CoSignPanel';
import type { CoSignRead, TheatreBeatData } from './beatModel';

export interface BuildTheatreProps {
  /** One entry per beat in presentation order; null while not yet computed. */
  beats: Array<TheatreBeatData | null>;
  /** How many beats are revealed on screen. */
  shownBeats: number;
  isRunning: boolean;
  runError: string | null;
  onRetry: () => void;
  /** Co-sign, once every beat is revealed. */
  showCoSign: boolean;
  coSignRead: CoSignRead;
  onCoSign: (soundsRight: boolean) => void;
  coSignDisabled: boolean;
  /** Pacing controls. */
  paused: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
  /** Skip has been pressed: pacing is over, beats reveal the moment they compute. */
  skipArmed: boolean;
  reducedMotion: boolean;
  onNext: () => void;
}

const RAIL = ['Vocabulary', 'Motivation', 'Trust signals', 'Objection', 'Decision check'] as const;

export function BuildTheatre({
  beats,
  shownBeats,
  isRunning,
  runError,
  onRetry,
  showCoSign,
  coSignRead,
  onCoSign,
  coSignDisabled,
  paused,
  onTogglePause,
  onSkip,
  skipArmed,
  reducedMotion,
  onNext,
}: BuildTheatreProps): JSX.Element {
  const railActive = showCoSign ? RAIL.length - 1 : Math.min(shownBeats, RAIL.length - 1);
  const nextReady = shownBeats < beats.length && beats[shownBeats] != null;
  const allRevealed = shownBeats >= beats.length;
  const waitingOnEngine = !allRevealed && !nextReady && isRunning && !runError;

  return (
    <V5Stage wide>
      <div className="mb-1 text-center">
        <GlassEyebrow>Building your customer, from their own words</GlassEyebrow>
      </div>

      {/* Progress rail — a filling gold track + per-stage states, not just a
          faint underline (Trevor: "very low key, I almost missed it"). */}
      <div className="mb-9" role="list" aria-label="Build progress">
        <div className="mb-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-foreground/40">
          Step {Math.min(railActive + 1, RAIL.length)} of {RAIL.length}
        </div>
        <div className="flex">
          {RAIL.map((label, i) => {
            const done = i < railActive;
            const active = i === railActive;
            return (
              <div
                key={label}
                role="listitem"
                aria-current={active ? 'step' : undefined}
                className={`flex-1 pb-2.5 text-center text-[10px] font-extrabold uppercase tracking-wide transition-colors sm:text-[11px] ${
                  active ? 'text-gold-warm' : done ? 'text-foreground/55' : 'text-foreground/25'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {done && <span aria-hidden="true" className="text-gold-warm/80">✓</span>}
                  {active && (
                    <span
                      aria-hidden="true"
                      className={`inline-block h-1.5 w-1.5 rounded-full bg-gold-warm ${reducedMotion ? '' : 'animate-pulse'}`}
                    />
                  )}
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {/* The track: fills gold as the build advances. */}
        <div className="h-[3px] overflow-hidden rounded-full bg-foreground/[0.08]">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-gold-warm/70 to-gold-warm ${
              reducedMotion ? '' : 'transition-[width] duration-700 ease-out'
            }`}
            style={{ width: `${((showCoSign ? RAIL.length : railActive + 0.5) / RAIL.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Revealed beats */}
      {beats.slice(0, shownBeats).map((beat) => (beat ? <TheatreBeat key={beat.id} beat={beat} /> : null))}

      {/* Honest engine-wait line (the next stage is genuinely still computing) */}
      {waitingOnEngine && (
        <div className="mb-6 flex items-center gap-2.5 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-gold-warm" />
          {skipArmed
            ? 'Skipping ahead. I am still reading your reviews, each part appears the moment it is ready.'
            : 'Still reading your reviews. The next part appears the moment it is ready.'}
        </div>
      )}

      {/* Run failure — honest, retryable */}
      {runError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="mb-3 text-sm leading-relaxed text-destructive">
            The build stopped and I will not fill the gap with guesses: {runError}
          </p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}

      {/* Co-sign */}
      {showCoSign && <CoSignPanel read={coSignRead} onAnswer={onCoSign} disabled={coSignDisabled} />}

      {!runError && !showCoSign && !skipArmed && (
        <StageControls
          paused={paused}
          onTogglePause={onTogglePause}
          onSkip={onSkip}
          reducedMotion={reducedMotion}
          nextReady={nextReady}
          onNext={onNext}
          allRevealed={allRevealed}
        />
      )}
    </V5Stage>
  );
}
