/**
 * CompletenessRing — a small SVG progress ring for the Context Card's
 * "how much do I know" signal. Pure presentational; no fabrication risk.
 */
interface CompletenessRingProps {
  /** Slots satisfied. */
  filled: number;
  /** Total slots. */
  total: number;
  /** Pixel diameter (default 44). */
  size?: number;
}

export function CompletenessRing({ filled, total, size = 44 }: CompletenessRingProps): JSX.Element {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(Math.max(filled / safeTotal, 0), 1);
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const complete = filled >= total;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${filled} of ${total} details captured`}
      data-testid="completeness-ring"
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={complete ? 'hsl(var(--idea-d))' : 'hsl(var(--gold-warm))'}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">
        {filled}/{total}
      </span>
    </div>
  );
}
