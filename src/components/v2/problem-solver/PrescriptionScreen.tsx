/**
 * Movement 3 — Prescription. Describes what the IDEA Brand Coach does (reads the
 * buyer's emotional state, runs the check no other tool runs, names the one thing
 * to change), THEN the credentials (35 years + Harvard neuroscience) last (AC#3),
 * and the entry CTA "Find my Trust Gap" (AC#10). Glass body card over the lit dark.
 *
 * Pure presentational. The shell owns the transition into the four questions.
 */

import { GlassPanel, MovementShell } from './glass';
import { GoldButton } from './primitives';

export function PrescriptionScreen({ onContinue }: { onContinue: () => void }): JSX.Element {
  return (
    <MovementShell>
      <GlassPanel className="px-7 py-8">
        <p className="mb-[1.1em] text-[1.04rem] leading-relaxed text-muted-foreground">
          The IDEA Brand Coach finds the gap. It reads the emotional state your customer is in when they
          land on your listing and runs a check no other tool runs &mdash; not what they say, but what
          their language reveals about the part of the brain making the decision. Then it tells you the one
          thing to change.
        </p>
        <p className="border-t border-border pt-[18px] text-[0.86rem] leading-relaxed text-muted-foreground">
          Built on 35 years of commercial brand strategy across hundreds of real brands, and grounded in
          the published neuroscience of Harvard researchers who have spent their careers on exactly this:
          why customers almost buy, and then don&rsquo;t.
        </p>
      </GlassPanel>

      <div className="mt-6">
        <GoldButton onClick={onContinue} className="w-full">
          Find my Trust Gap
        </GoldButton>
        <p className="mt-4 text-center text-[0.82rem] leading-relaxed text-muted-foreground">
          The IDEA Brand Coach reads what your customer&rsquo;s brain is deciding about your brand and keeps
          you one step ahead of the gap.
        </p>
      </div>
    </MovementShell>
  );
}
