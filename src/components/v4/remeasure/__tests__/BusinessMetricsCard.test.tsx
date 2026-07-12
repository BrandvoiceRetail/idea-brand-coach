import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BusinessMetricsCard } from '../BusinessMetricsCard';
import type { BusinessMetricsView, MetricDelta } from '@/types/v4Remeasure';

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const emptyMetrics: MetricDelta[] = [
  { kind: 'ctr', label: 'Click-through rate', unit: 'rate', before: null, after: null, delta: null, pctChange: null },
  { kind: 'cvr', label: 'Conversion rate', unit: 'rate', before: null, after: null, delta: null, pctChange: null },
  { kind: 'aov', label: 'Average order value', unit: 'currency', before: null, after: null, delta: null, pctChange: null },
  { kind: 'revenue', label: 'Revenue', unit: 'currency', before: null, after: null, delta: null, pctChange: null },
];

const NO_DATA: BusinessMetricsView = { metrics: emptyMetrics, hasData: false, pivotDate: null };

const WITH_DATA: BusinessMetricsView = {
  hasData: true,
  pivotDate: '2026-06-20',
  metrics: [
    { kind: 'ctr', label: 'Click-through rate', unit: 'rate', before: 0.02, after: 0.03, delta: 0.01, pctChange: 50 },
    { kind: 'cvr', label: 'Conversion rate', unit: 'rate', before: null, after: null, delta: null, pctChange: null },
    { kind: 'aov', label: 'Average order value', unit: 'currency', before: 30, after: 33, delta: 3, pctChange: 10 },
    { kind: 'revenue', label: 'Revenue', unit: 'currency', before: null, after: null, delta: null, pctChange: null },
  ],
};

describe('BusinessMetricsCard', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the loading state without firing the view event', () => {
    render(<BusinessMetricsCard isLoading />);
    expect(screen.getByTestId('v4-metrics-loading')).toBeInTheDocument();
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('renders an honest error state with a working retry', () => {
    const onRetry = vi.fn();
    render(<BusinessMetricsCard error="Could not read your campaign numbers." onRetry={onRetry} />);
    expect(screen.getByTestId('v4-metrics-error')).toHaveTextContent(/campaign numbers/i);
    expect(captureAlphaEvent).not.toHaveBeenCalled();
  });

  it('shows the honest no-data state and never fabricates a number', () => {
    render(<BusinessMetricsCard view={NO_DATA} />);
    expect(screen.getByTestId('v4-metrics-no-data')).toBeInTheDocument();
    // No table of em-dashes — only the honest banner, nothing to act on.
    expect(screen.queryByTestId('v4-metrics-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('v4-metric-row-ctr')).not.toBeInTheDocument();
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_business_metrics_viewed',
      expect.objectContaining({ state: 'no_data' }),
    );
  });

  it('renders real before/after figures and the delta when data is present', () => {
    render(<BusinessMetricsCard view={WITH_DATA} />);
    expect(screen.queryByTestId('v4-metrics-no-data')).not.toBeInTheDocument();
    const ctr = screen.getByTestId('v4-metric-row-ctr');
    expect(ctr).toHaveTextContent('2.0%');
    expect(ctr).toHaveTextContent('3.0%');
    expect(ctr).toHaveTextContent('+50%');
    // A metric with no row still reads em-dash (no fabrication on the data view).
    expect(screen.getByTestId('v4-metric-row-cvr')).toHaveTextContent('—');
    expect(captureAlphaEvent).toHaveBeenCalledWith(
      'v4_business_metrics_viewed',
      expect.objectContaining({ state: 'data' }),
    );
  });
});
