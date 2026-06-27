import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyseRun } from '../AnalyseRun';
import type { AnalyseRunStep } from '@/types/v4Analyse';

const step = (id: AnalyseRunStep['id'], status: AnalyseRunStep['status'], finding: string | null): AnalyseRunStep => ({
  id,
  label: 'Trust Gap',
  tool: 'Trust Gap',
  rationale: 'Where buyers hesitate.',
  status,
  finding,
});

describe('AnalyseRun — no-fabrication build-theatre', () => {
  it('renders an honest empty state when there are no steps', () => {
    render(<AnalyseRun steps={[]} />);
    expect(screen.getByTestId('analyse-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('analyse-timeline')).not.toBeInTheDocument();
  });

  it('shows a loading/running timeline with NO finding on the running step', () => {
    const steps = [step('gap_trigger', 'running', null)];
    render(<AnalyseRun steps={steps} />);
    expect(screen.getByTestId('analyse-step-gap_trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('analyse-finding-gap_trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('analyse-recognition')).not.toBeInTheDocument();
  });

  it('renders a grounded finding ONLY for done steps and fires onComplete once', () => {
    const onComplete = vi.fn();
    const steps = [
      step('avatar', 'done', 'Your customer is a busy parent fighting poor sleep.'),
      step('gap_trigger', 'needs_input', null),
    ];
    render(<AnalyseRun steps={steps} onComplete={onComplete} />);
    expect(screen.getByTestId('analyse-finding-avatar')).toHaveTextContent(/busy parent/i);
    expect(screen.queryByTestId('analyse-finding-gap_trigger')).not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('surfaces honest needs_input and error banners instead of fabricated findings', () => {
    const steps = [step('gap_trigger', 'failed', null)];
    render(
      <AnalyseRun
        steps={steps}
        needsInput={[{ slot: 0, question: 'I need your live listing or reviews to score the Trust Gap.', why: 'No score from a paragraph alone.' }]}
        runError="Couldn't reach the coach — try again."
      />,
    );
    expect(screen.getByTestId('analyse-needs-input')).toHaveTextContent(/live listing or reviews/i);
    expect(screen.getByTestId('analyse-run-error')).toHaveTextContent(/couldn't reach the coach/i);
    expect(screen.queryByTestId('analyse-finding-gap_trigger')).not.toBeInTheDocument();
  });
});
