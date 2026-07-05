/**
 * ColdStart — the honest low-review branch: the engine will not guess, so the
 * seller gets three real ways forward (paste their own customer voice, read a
 * competitor's listing, or save their spot). When the engine surfaced a
 * needs_input demand, its exact questions render here. Never a dead end,
 * never fabrication.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassEyebrow, GlassPanel } from '@/components/v2/problem-solver/glass';
import { extractAsin } from '@/utils/asinParser';
import type { NeedsInputItem } from '@/types/forensicBuild';
import { V5Stage } from './V5Chrome';

/** Below this many characters a paste is too thin to read faithfully. */
const MIN_PASTE_CHARS = 80;

export interface ColdStartProps {
  /** The engine's own demand, when the run stopped on needs_input. */
  needsInput: NeedsInputItem[] | null;
  onPasteVoice: (text: string) => void;
  onCompetitor: (asin: string) => void;
  onSaveAndNotify: () => void;
  onBack: () => void;
}

export function ColdStart({
  needsInput,
  onPasteVoice,
  onCompetitor,
  onSaveAndNotify,
  onBack,
}: ColdStartProps): JSX.Element {
  const [pasted, setPasted] = useState('');
  const [competitor, setCompetitor] = useState('');
  const competitorAsin = extractAsin(competitor);
  const pasteReady = pasted.trim().length >= MIN_PASTE_CHARS;

  return (
    <V5Stage wide>
      <div className="mb-6 text-center">
        <GlassEyebrow>Before I read your customer</GlassEyebrow>
        <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground">
          You don&apos;t have enough reviews yet, and I won&apos;t guess.
        </h1>
        <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-relaxed text-muted-foreground">
          Your customer speaks through their reviews. Yours has only a few, and I refuse to put
          words in their mouth they never said. Here is how we still get you moving today:
        </p>
      </div>

      {needsInput && needsInput.length > 0 && (
        <GlassPanel sheen={false} className="mb-4 p-5">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            What I still need
          </div>
          <ul className="space-y-2">
            {needsInput.map((item) => (
              <li key={`${item.slot}-${item.question}`} className="text-sm leading-relaxed">
                <span className="font-semibold text-foreground">{item.question}</span>
                {item.why && <span className="block text-xs text-muted-foreground">{item.why}</span>}
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {/* Option 1 — paste what you have */}
      <GlassPanel className="mb-4 p-6">
        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Option 1, fastest
        </div>
        <div className="mb-1.5 text-[15px] font-extrabold text-foreground">Paste what you do have</div>
        <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
          Reviews, customer emails, Q&amp;A, DMs, support tickets, any real customer words. Even 15
          honest lines let me read them faithfully.
        </p>
        <textarea
          className="mb-3 min-h-28 w-full rounded-xl border border-border bg-foreground/[0.04] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-gold-warm/50"
          placeholder="Paste your customers' own words here, verbatim"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          aria-label="Paste your customer voice"
        />
        <Button
          type="button"
          variant="brand"
          className="min-h-11 rounded-xl font-extrabold"
          disabled={!pasteReady}
          onClick={() => onPasteVoice(pasted.trim())}
        >
          Read their words →
        </Button>
        {pasted.trim().length > 0 && !pasteReady && (
          <p className="mt-2 text-xs text-muted-foreground">
            A little more, please. I need enough real language to read it faithfully.
          </p>
        )}
      </GlassPanel>

      {/* Option 2 — competitor read */}
      <GlassPanel className="mb-4 p-6">
        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Option 2, see it work now
        </div>
        <div className="mb-1.5 text-[15px] font-extrabold text-foreground">Read a competitor instead</div>
        <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
          Watch the whole engine run on a rival&apos;s reviews. Same read, their customer. A sharp
          way to find the opening they are leaving you.
        </p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <input
            className="flex-1 rounded-xl border border-border bg-foreground/[0.04] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-gold-warm/50"
            placeholder="Competitor ASIN or Amazon URL"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            aria-label="Competitor ASIN or Amazon URL"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={!competitorAsin}
            onClick={() => competitorAsin && onCompetitor(competitorAsin)}
          >
            Analyse a competitor →
          </Button>
        </div>
      </GlassPanel>

      {/* Option 3 — save the spot */}
      <GlassPanel className="mb-4 p-6">
        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
          Option 3, when they&apos;ve spoken
        </div>
        <div className="mb-1.5 text-[15px] font-extrabold text-foreground">
          Save your spot, come back later
        </div>
        <p className="mb-3.5 text-[13px] leading-relaxed text-muted-foreground">
          Gather a few more reviews and I&apos;ll build your customer the moment you return.
          Nothing to redo.
        </p>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onSaveAndNotify}>
          Save &amp; notify me →
        </Button>
      </GlassPanel>

      <div className="text-center">
        <Button type="button" variant="ghost" className="rounded-xl text-muted-foreground" onClick={onBack}>
          ← Try another listing
        </Button>
      </div>
    </V5Stage>
  );
}
