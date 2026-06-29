/**
 * Shared funnel-metric formatter — the single source of truth for rendering a
 * metric value in its natural unit across the Fix screens (FunnelMap,
 * FunnelPieceDetail, …).
 *
 * WHY THIS EXISTS: the percent case was duplicated across two components and
 * drifted — FunnelMap scaled fractions ×100 (correct) while FunnelPieceDetail did
 * not, so a CVR of 0.05 (5%) rendered as "0.1%" (≈50× understatement). One
 * formatter, one behaviour, no drift.
 *
 * UNITS: percent metrics may arrive as a FRACTION (derived cvr = orders ÷ clicks
 * = 0.05) or already as a PERCENTAGE from the source — so values ≤ 1 are scaled
 * ×100 and larger values are taken as-is. NEVER fabricates: a null/NaN value
 * renders as the honest em-dash.
 */
import type { MetricFormat } from '@/config/v4Funnel';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatMetricValue(value: number | null, format: MetricFormat): string {
  if (value === null || Number.isNaN(value)) return '—';
  switch (format) {
    case 'percent': {
      // Fraction (≤1) → ×100; an already-percentage source value is taken as-is.
      const pct = value <= 1 ? value * 100 : value;
      return `${pct.toFixed(1)}%`;
    }
    case 'currency':
      return value >= 1000 ? `$${compact.format(value)}` : `$${value.toFixed(2)}`;
    case 'ratio':
      return `${value.toFixed(1)}×`;
    case 'count':
    default:
      return value >= 10000 ? compact.format(value) : Math.round(value).toLocaleString('en-US');
  }
}
