/**
 * GroundedStrip — the "🔒 Grounded in…" provenance row.
 *
 * WHAT: A compact, props-driven strip that names which brand fields
 * (Signature / avatar / positioning …) actually powered a generated output, each
 * marked present (✓) or missing (⚠ "output may drift"). Mirrors the desktop
 * mockup's `.grounded` strip so every generated surface can show its provenance.
 *
 * WHY: The production bar is NO FABRICATION. Showing the user exactly which of
 * their real brand fields fed an output — and flagging the ones that were missing
 * so the result "may drift" — keeps the coach honest and makes weak grounding
 * visible instead of silent.
 *
 * Honest empty: when no fields are supplied the strip says the output isn't
 * grounded in any brand fields yet (and how to fix that). It NEVER invents a
 * field or a checkmark to look more grounded than it is.
 */
import { AlertTriangle, Check, Lock } from 'lucide-react';

/** One brand field that may (or may not) power an output. */
export interface GroundedField {
  /** Everyday brand-field label (Tier-A), e.g. "Signature", "Avatar", "Positioning". */
  label: string;
  /** Whether the field was present/usable for this output. */
  present: boolean;
  /** Shown when not present — what's missing / why the output may drift. */
  note?: string;
}

export interface GroundedStripProps {
  /** The brand fields behind the output. Empty → honest "not grounded yet" state. */
  fields: GroundedField[];
  /** Optional extra classes for layout from the parent. */
  className?: string;
}

/**
 * Render the provenance strip. `fields` drives everything; an empty list renders
 * the honest no-data message rather than a misleading "fully grounded" badge.
 */
export function GroundedStrip({ fields, className }: GroundedStripProps): JSX.Element {
  const base =
    'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground';
  const root = className ? `${base} ${className}` : base;

  if (fields.length === 0) {
    return (
      <div className={root} data-testid="v4-grounded-strip" data-grounded="empty">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          Not grounded in any brand fields yet — add your Signature and avatar so this output is
          built from your real brand.
        </span>
      </div>
    );
  }

  return (
    <div className={root} data-testid="v4-grounded-strip" data-grounded="fields">
      <span className="flex items-center gap-1 font-medium text-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 text-gold-warm" aria-hidden="true" />
        Grounded in
      </span>
      {fields.map((field) => (
        <span
          key={field.label}
          className="flex items-center gap-1"
          data-testid={`v4-grounded-field-${field.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {field.present ? (
            <>
              <Check className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
              <span>{field.label}</span>
            </>
          ) : (
            <span className="flex items-center gap-1 font-medium text-gold-warm">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {field.label}
                {field.note ? ` — ${field.note}` : ' — missing, output may drift'}
              </span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
