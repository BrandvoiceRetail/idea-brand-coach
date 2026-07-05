/**
 * TheatreBeat — one beat of the /v5 Avatar build theatre: evidence panel →
 * "What this reveals" interpretation → the distilled field panel (chips /
 * text / list / quote variants). Everything rendered is artifact text; this
 * component only arranges it. The interpretation label is EXACTLY
 * "What this reveals" (never an engine/stage label).
 */
import { GlassPanel } from '@/components/v2/problem-solver/glass';
import type { BeatField, TheatreBeatData } from './beatModel';

function Chips({ chips }: { chips: string[] }): JSX.Element {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-border bg-foreground/[0.06] px-3 py-1 font-mono text-xs text-foreground/75"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function FieldBody({ field }: { field: BeatField }): JSX.Element {
  switch (field.kind) {
    case 'chips':
      return <Chips chips={field.chips} />;
    case 'text':
      return (
        <div className="space-y-2">
          {field.lines.map((line) => (
            <p key={line.label} className="text-sm leading-relaxed text-foreground/75">
              <span className="font-bold uppercase tracking-wide text-gold-warm">
                {line.label}:
              </span>{' '}
              {line.text}
            </p>
          ))}
        </div>
      );
    case 'list':
      return (
        <div>
          {field.items.map((item, i) => (
            <div key={item} className="mb-1.5 flex gap-2.5 text-sm leading-snug text-foreground/75">
              <span className="shrink-0 pt-0.5 text-[11px] font-extrabold text-gold-warm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{item}</span>
            </div>
          ))}
          {field.footnote && (
            <p className="mt-2 text-xs italic text-muted-foreground">{field.footnote}</p>
          )}
        </div>
      );
    case 'quote':
      return (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold leading-relaxed text-foreground">{field.heading}</p>
          <blockquote className="border-l-2 border-gold-warm/40 pl-3.5 font-mono text-sm leading-relaxed text-foreground/70">
            &ldquo;{field.quote}&rdquo;
          </blockquote>
          {field.resolution && (
            <p className="text-sm leading-relaxed text-foreground/75">
              <span className="font-bold uppercase tracking-wide text-gold-warm">
                How to resolve it:
              </span>{' '}
              {field.resolution}
            </p>
          )}
        </div>
      );
  }
}

export function TheatreBeat({ beat }: { beat: TheatreBeatData }): JSX.Element {
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

      {/* Evidence */}
      {(beat.evidence?.length || beat.chipGroups?.length) && (
        <GlassPanel sheen={false} className="mb-3.5 px-6 py-5">
          {beat.evidenceLabel && (
            <div className="mb-3.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground/80">
              {beat.evidenceLabel}
            </div>
          )}
          {beat.evidence?.map((line) => (
            <div
              key={line.text}
              className="mb-2 border-l-2 border-gold-warm/35 px-3 py-1.5 font-mono text-sm text-foreground/70"
            >
              {line.text}
              {line.note && (
                <span className="ml-2 font-sans text-[10px] text-muted-foreground/70">{line.note}</span>
              )}
            </div>
          ))}
          {beat.chipGroups?.map((group) => (
            <div key={group.heading} className="mb-3 last:mb-0">
              <div className="text-xs font-semibold text-foreground/80">{group.heading}</div>
              <Chips chips={group.chips} />
              {group.note && (
                <div className="mt-1.5 text-[11px] text-muted-foreground/70">{group.note}</div>
              )}
            </div>
          ))}
        </GlassPanel>
      )}

      {/* What this reveals */}
      {beat.reveals && (
        <div className="mb-3.5 flex items-start gap-3 rounded-xl border border-gold-warm/30 bg-gold-warm/[0.06] px-5 py-4">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-warm text-[11px] font-extrabold text-background" aria-hidden>
            →
          </div>
          <div>
            <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-gold-warm">
              What this reveals
            </div>
            <p className="text-sm leading-relaxed text-foreground/85">{beat.reveals}</p>
          </div>
        </div>
      )}

      {/* Distilled field */}
      {beat.panel && (
        <GlassPanel className="px-6 py-5">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-gold-warm">
            {beat.panel.label}
          </div>
          <div className="mb-2.5 text-base font-extrabold text-foreground">{beat.panel.heading}</div>
          <FieldBody field={beat.panel.field} />
        </GlassPanel>
      )}
    </section>
  );
}
