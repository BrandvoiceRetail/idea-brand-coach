/**
 * Movement 2 — Diagnosis. Explains the mechanism (the quiet trust-check a buyer's
 * brain runs before deciding), THEN names it — "a Trust Gap" — and says it is
 * measurable (AC#2: name only after describing). Glass body card over the lit dark.
 *
 * Pure presentational. The shell owns the transition to Movement 3 (Prescription).
 */

import { ArrowRight } from 'lucide-react';
import { GlassPanel, MovementShell } from './glass';
import { GoldButton } from './primitives';

export function DiagnosisScreen({ onContinue }: { onContinue: () => void }): JSX.Element {
  return (
    <MovementShell>
      <GlassPanel className="px-7 py-8">
        <p className="mb-[1.1em] text-[1.04rem] leading-relaxed text-muted-foreground">
          The reason the standard fixes don&rsquo;t work is that they address what your customer{' '}
          <em>says</em> about your brand. What decides whether they buy is something else: the quiet check
          their brain runs in the seconds before deciding &mdash; and it isn&rsquo;t reading your bullet
          points. It&rsquo;s asking one question about trust, and something in your brand is failing it.
        </p>
        <p className="font-display border-l-2 border-gold-warm pl-4 text-[1.5rem] font-semibold leading-snug text-foreground">
          That gap has a name. It&rsquo;s a <span className="text-gold-warm">Trust Gap</span>. And it&rsquo;s
          measurable.
        </p>
      </GlassPanel>

      <div className="mt-6">
        <GoldButton onClick={onContinue} className="w-full">
          Go on
          <ArrowRight className="h-4 w-4" />
        </GoldButton>
      </div>
    </MovementShell>
  );
}
