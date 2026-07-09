/**
 * CoSignPanel — the agency beat: the seller co-signs the customer read before
 * the diagnostic runs. The echoed one-line read is drawn VERBATIM from the
 * motivation + objection artifacts (never composed copy). Both answers
 * proceed; the answer is stored and reported, not used to gate.
 */
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/v2/problem-solver/glass';
import type { CoSignRead } from './beatModel';

export interface CoSignPanelProps {
  read: CoSignRead;
  /** Called with the seller's answer; both values proceed. */
  onAnswer: (soundsRight: boolean) => void;
  disabled?: boolean;
}

export function CoSignPanel({ read, onAnswer, disabled = false }: CoSignPanelProps): JSX.Element {
  return (
    <GlassPanel strong className="animate-view-in mt-2 p-6">
      <div className="mb-3.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
        Your turn, one check before I read the decision
      </div>
      <div className="mb-3 text-[17px] font-bold text-foreground">
        Does this sound like your customer?
      </div>
      <div className="mb-5 space-y-2 border-l-2 border-gold-warm/30 pl-3.5 text-[15px] italic leading-relaxed text-foreground/80">
        {read.buyingBecause && (
          <p>
            <span className="not-italic text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Likely trigger:
            </span>{' '}
            {read.buyingBecause}
          </p>
        )}
        {read.stillAsking && (
          <p>
            <span className="not-italic text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Unresolved question:
            </span>{' '}
            {read.stillAsking}
          </p>
        )}
        {!read.buyingBecause && !read.stillAsking && (
          <p>The full read is above, built from your reviews.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button
          type="button"
          variant="brand"
          className="min-h-11 rounded-xl font-extrabold"
          onClick={() => onAnswer(true)}
          disabled={disabled}
        >
          ✓ Yes, that&apos;s them
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-xl"
          onClick={() => onAnswer(false)}
          disabled={disabled}
        >
          Not quite, but keep going
        </Button>
      </div>
      <p className="mt-3.5 text-xs text-muted-foreground">
        Either way I&apos;ll keep your answer with the profile. It makes the read yours.
      </p>
    </GlassPanel>
  );
}
