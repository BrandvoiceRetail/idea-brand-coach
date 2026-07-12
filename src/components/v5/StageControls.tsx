/**
 * StageControls — the /v5 theatre pacing controls: pause (hold reveals) and
 * skip (reveal everything already computed). With reduced motion the theatre
 * does not auto-advance at all, so a "Next" button steps through instead.
 * These control PRESENTATION pacing only — the compute keeps running.
 */
import { Button } from '@/components/ui/button';

export interface StageControlsProps {
  paused: boolean;
  onTogglePause: () => void;
  onSkip: () => void;
  /** Reduced-motion mode: show a Next stepper instead of pause. */
  reducedMotion: boolean;
  /** True when a next beat is computed and ready to reveal. */
  nextReady: boolean;
  onNext: () => void;
  /** Hide entirely once every beat is on screen. */
  allRevealed: boolean;
}

export function StageControls({
  paused,
  onTogglePause,
  onSkip,
  reducedMotion,
  nextReady,
  onNext,
  allRevealed,
}: StageControlsProps): JSX.Element | null {
  if (allRevealed) return null;

  return (
    <div className="sticky bottom-4 z-40 mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-background/85 px-3 py-2 backdrop-blur-md">
      {reducedMotion ? (
        <Button
          type="button"
          size="sm"
          variant="brand"
          className="rounded-full"
          onClick={onNext}
          disabled={!nextReady}
        >
          {nextReady ? 'Next →' : 'Reading…'}
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-foreground"
          onClick={onTogglePause}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="rounded-full text-muted-foreground hover:text-foreground"
        onClick={onSkip}
      >
        Skip ahead
      </Button>
    </div>
  );
}
