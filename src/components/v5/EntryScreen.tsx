/**
 * EntryScreen — /v5 step ①: paste one ASIN or Amazon URL, start the read.
 *
 * Mirrors the mockup's entry copy. Input is normalised via `extractAsin`
 * (raw ASIN or /dp/ URL). Returning users are prefilled with their most
 * recently imported listing. The cold-start branch is one click away so a
 * low-review seller is never dead-ended.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { extractAsin } from '@/utils/asinParser';
import { GlassEyebrow } from '@/components/v2/problem-solver/glass';
import { V5Stage } from './V5Chrome';

export interface EntryScreenProps {
  /** Prefill for returning users (their stored listing). */
  defaultValue?: string;
  /** Title of the prefilled listing, when known. */
  defaultTitle?: string | null;
  /** True while the session/products prefill is loading or a run is starting. */
  isStarting?: boolean;
  /** Start the read with a normalised ASIN. */
  onStart: (asin: string) => void;
  /** Jump to the honest cold-start screen. */
  onColdStart: () => void;
}

export function EntryScreen({
  defaultValue = '',
  defaultTitle,
  isStarting = false,
  onStart,
  onColdStart,
}: EntryScreenProps): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const asin = extractAsin(value);

  const handleStart = (): void => {
    setTouched(true);
    if (asin) onStart(asin);
  };

  return (
    <V5Stage className="pt-10 text-center">
      <GlassEyebrow>Alpha · Step 1, Analyse</GlassEyebrow>
      <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
        Show me your listing.
        <br />
        I&apos;ll read it the way a buyer does.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Not what your customers said. What their language reveals about the part of the brain
        making the decision.
      </p>

      <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
        <input
          className="flex-1 rounded-xl border border-border bg-foreground/[0.04] px-4 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-gold-warm/50"
          placeholder="Paste your ASIN or Amazon URL"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleStart();
          }}
          aria-label="Your ASIN or Amazon URL"
          disabled={isStarting}
        />
        <Button
          type="button"
          variant="brand"
          className="min-h-12 rounded-xl px-6 text-[15px] font-extrabold"
          onClick={handleStart}
          disabled={isStarting || (touched && !asin)}
        >
          {isStarting ? 'Starting…' : 'Read my listing →'}
        </Button>
      </div>
      {defaultTitle && value === defaultValue && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your stored listing: <span className="text-foreground/80">{defaultTitle}</span>
        </p>
      )}
      {touched && value.trim() !== '' && !asin && (
        <p className="mt-2 text-sm text-amber-500">
          That doesn&apos;t look like an ASIN or an Amazon product URL yet.
        </p>
      )}

      <button
        type="button"
        className="mt-6 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        onClick={onColdStart}
      >
        New product with only a few reviews? →
      </button>
    </V5Stage>
  );
}
