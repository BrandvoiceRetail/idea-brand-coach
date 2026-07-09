/**
 * TheatreBeat — one beat of the /v5 Avatar build theatre: evidence panel →
 * "What this reveals" interpretation → the distilled field panel (chips /
 * text / list / quote variants). Everything rendered is artifact text; this
 * component only arranges it. The interpretation label is EXACTLY
 * "What this reveals" (never an engine/stage label).
 *
 * CHOREOGRAPHY (Trevor's Dynamic Avatar 2.0 mock-up, 2026-06-25): within a
 * beat, evidence lines stagger in one by one, the interpretation lands after
 * a dwell on the evidence, the field panel follows, and its content
 * populates piece by piece — chips pop in sequence, list items step in, and
 * prose TYPES OUT with a gold cursor. All of it is presentation over real
 * artifact text (the content exists in full from the first render for
 * screen readers and reduced-motion users; `instant` renders everything
 * immediately).
 */
import { useEffect, useRef, useState } from 'react';
import { GlassPanel } from '@/components/v2/problem-solver/glass';
import type { BeatField, TheatreBeatData } from './beatModel';

/* ── Mock-up timing constants (ms) ─────────────────────────────────────── */
const EVIDENCE_STAGGER = 420;
const REVEALS_AFTER_EVIDENCE = 700;
const PANEL_AFTER_REVEALS = 2000;
const CONTENT_AFTER_PANEL = 400;
const CHIP_STAGGER = 120;
const LIST_STAGGER = 300;
const TYPE_CHAR_MS = 18;

/** Staggered-entrance wrapper: view-in animation, delayed, fill-mode backwards. */
function Enter({
  delayMs,
  instant,
  className,
  children,
}: {
  delayMs: number;
  instant: boolean;
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={`${instant ? '' : 'animate-view-in [animation-fill-mode:backwards]'} ${className ?? ''}`}
      style={instant ? undefined : { animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * Typewriter prose: the full text is ALWAYS in the DOM (visually hidden while
 * typing) so screen readers and copy/paste see real content; the visible layer
 * types over it with a gold caret.
 */
function TypedText({
  text,
  startDelayMs,
  instant,
}: {
  text: string;
  startDelayMs: number;
  instant: boolean;
}): JSX.Element {
  const [count, setCount] = useState(instant ? text.length : 0);
  const started = useRef(false);

  useEffect(() => {
    if (instant || started.current) return;
    started.current = true;
    let interval: number | undefined;
    const kickoff = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            if (interval) window.clearInterval(interval);
            return c;
          }
          return c + 1;
        });
      }, TYPE_CHAR_MS);
    }, startDelayMs);
    return () => {
      window.clearTimeout(kickoff);
      if (interval) window.clearInterval(interval);
    };
  }, [instant, startDelayMs, text.length]);

  const typing = count < text.length;
  return (
    <span aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      {typing && (
        <span
          aria-hidden
          className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-gold-warm"
        />
      )}
    </span>
  );
}

function Chips({
  chips,
  startDelayMs = 0,
  instant = true,
}: {
  chips: string[];
  startDelayMs?: number;
  instant?: boolean;
}): JSX.Element {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={chip}
          className={`rounded-full border border-border bg-foreground/[0.06] px-3 py-1 font-mono text-xs text-foreground/75 ${
            instant ? '' : 'animate-view-in [animation-fill-mode:backwards]'
          }`}
          style={instant ? undefined : { animationDelay: `${startDelayMs + i * CHIP_STAGGER}ms` }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function FieldBody({
  field,
  startDelayMs,
  instant,
}: {
  field: BeatField;
  startDelayMs: number;
  instant: boolean;
}): JSX.Element {
  switch (field.kind) {
    case 'chips':
      return <Chips chips={field.chips} startDelayMs={startDelayMs} instant={instant} />;
    case 'text':
      return (
        <div className="space-y-2">
          {field.lines.map((line, i) => (
            <p key={line.label} className="text-sm leading-relaxed text-foreground/75">
              <span className="font-bold uppercase tracking-wide text-gold-warm">
                {line.label}:
              </span>{' '}
              <TypedText
                text={line.text}
                // Lines type one after another; later lines wait for earlier ones.
                startDelayMs={
                  startDelayMs +
                  field.lines.slice(0, i).reduce((ms, l) => ms + l.text.length * TYPE_CHAR_MS, 0)
                }
                instant={instant}
              />
            </p>
          ))}
        </div>
      );
    case 'list':
      return (
        <div>
          {field.items.map((item, i) => (
            <div
              key={item}
              className={`mb-1.5 flex gap-2.5 text-sm leading-snug text-foreground/75 ${
                instant ? '' : 'animate-view-in [animation-fill-mode:backwards]'
              }`}
              style={instant ? undefined : { animationDelay: `${startDelayMs + i * LIST_STAGGER}ms` }}
            >
              <span className="shrink-0 pt-0.5 text-[11px] font-extrabold text-gold-warm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </div>
          ))}
          {field.footnote && (
            <Enter
              delayMs={startDelayMs + field.items.length * LIST_STAGGER}
              instant={instant}
            >
              <p className="mt-2 text-xs italic text-muted-foreground">{field.footnote}</p>
            </Enter>
          )}
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold leading-relaxed text-foreground">{field.heading}</p>
          <blockquote className="border-l-2 border-gold-warm/40 pl-3.5 font-mono text-sm leading-relaxed text-foreground/70">
            &ldquo;
            <TypedText text={field.quote} startDelayMs={startDelayMs} instant={instant} />
            &rdquo;
          </blockquote>
          {field.resolution && (
            <Enter
              delayMs={startDelayMs + field.quote.length * TYPE_CHAR_MS + 300}
              instant={instant}
            >
              <p className="text-sm leading-relaxed text-foreground/75">
                <span className="font-bold uppercase tracking-wide text-gold-warm">
                  Recommended response:
                </span>{' '}
                {field.resolution}
              </p>
            </Enter>
          )}
        </div>
      );
  }
}

export function TheatreBeat({
  beat,
  instant = false,
}: {
  beat: TheatreBeatData;
  /** Render everything immediately (skip / reduced motion / already seen). */
  instant?: boolean;
}): JSX.Element {
  // ── Choreography timeline (each block enters relative to beat mount) ──
  const evidenceCount = (beat.evidence?.length ?? 0) + (beat.chipGroups?.length ?? 0);
  const evidenceEndMs = 200 + evidenceCount * EVIDENCE_STAGGER;
  const revealsAtMs = evidenceEndMs + REVEALS_AFTER_EVIDENCE;
  const panelAtMs = (beat.reveals ? revealsAtMs + PANEL_AFTER_REVEALS : evidenceEndMs + 400);
  const contentAtMs = panelAtMs + CONTENT_AFTER_PANEL;

  return (
    <section className="animate-view-in mb-8" aria-label={beat.railLabel}>
      {/* Beat header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-gold-warm text-[13px] font-extrabold text-background">
          {beat.index}
        </div>
        <div>
          <div className="text-lg font-extrabold text-foreground">{beat.title}</div>
          <div className="text-[13px] text-muted-foreground/90">{beat.description}</div>
        </div>
      </div>

      {/* Evidence — lines slide in one by one */}
      {(beat.evidence?.length || beat.chipGroups?.length) && (
        <GlassPanel sheen={false} className="mb-3.5 px-6 py-5">
          {beat.evidenceLabel && (
            <div className="mb-3.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground/80">
              {beat.evidenceLabel}
            </div>
          )}
          {beat.evidence?.map((line, i) => (
            <Enter
              key={line.text}
              delayMs={200 + i * EVIDENCE_STAGGER}
              instant={instant}
              className="mb-2 border-l-2 border-gold-warm/35 px-3 py-1.5 font-mono text-sm text-foreground/70"
            >
              {line.text}
              {line.note && (
                <span className="ml-2 font-sans text-[10px] text-muted-foreground/70">{line.note}</span>
              )}
            </Enter>
          ))}
          {beat.chipGroups?.map((group, g) => (
            <Enter
              key={group.heading}
              delayMs={200 + ((beat.evidence?.length ?? 0) + g) * EVIDENCE_STAGGER}
              instant={instant}
              className="mb-3 last:mb-0"
            >
              <div className="text-xs font-semibold text-foreground/80">{group.heading}</div>
              <Chips chips={group.chips} />
              {group.note && (
                <div className="mt-1.5 text-[11px] text-muted-foreground/70">{group.note}</div>
              )}
            </Enter>
          ))}
        </GlassPanel>
      )}

      {/* What this reveals — lands after a dwell on the evidence */}
      {beat.reveals && (
        <Enter
          delayMs={revealsAtMs}
          instant={instant}
          className="mb-3.5 flex items-start gap-3 rounded-xl border border-gold-warm/30 bg-gold-warm/[0.06] px-5 py-4"
        >
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-warm text-[11px] font-extrabold text-background" aria-hidden>
            →
          </div>
          <div>
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-gold-warm">
              {beat.revealsLabel}
            </div>
            <p className="text-sm leading-relaxed text-foreground/85">{beat.reveals}</p>
          </div>
        </Enter>
      )}

      {/* Distilled field — populates piece by piece */}
      {beat.panel && (
        <Enter delayMs={panelAtMs} instant={instant}>
          <GlassPanel className="px-6 py-5">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
              {beat.panel.label}
            </div>
            <div className="mb-2.5 text-base font-extrabold text-foreground">{beat.panel.heading}</div>
            <FieldBody
              field={beat.panel.field}
              // Relative to its own entrance (CSS delays are absolute from mount,
              // so content offsets include the panel's entrance time).
              startDelayMs={contentAtMs}
              instant={instant}
            />
          </GlassPanel>
        </Enter>
      )}
    </section>
  );
}
