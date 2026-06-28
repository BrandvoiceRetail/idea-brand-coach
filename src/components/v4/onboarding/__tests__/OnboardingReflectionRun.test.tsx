import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingReflectionRun } from '../OnboardingReflectionRun';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { ReflectionStep, AvatarPortrait } from '@/types/onboardingReflection';

const PORTRAIT: AvatarPortrait = {
  who: 'busy parents',
  problem: 'poor sleep',
  desire: 'rest',
  channel: 'Amazon',
};

const STEPS: ReflectionStep[] = [
  { id: 'read_back', label: 'Reading it back', tool: 'review read-back', rationale: 'Your own words.', status: 'done', finding: "Here's what I heard: you're RestWell, and you sell a sleep supplement for busy parents." },
  { id: 'avatar_sketch', label: 'Sketching your customer', tool: 'avatar build', rationale: 'Who you serve.', status: 'running', finding: null },
  { id: 'trust_gap', label: 'Trust Gap', tool: 'Trust Gap', rationale: 'Where buyers hesitate.', status: 'needs_input', finding: null },
];

const baseProps = {
  steps: STEPS,
  isRunning: false,
  hasRun: true,
  needsInput: [{ slot: 0, question: 'I need your live listing or reviews to score the Trust Gap.', why: 'No score from a paragraph alone.' }],
  runError: null,
  portrait: PORTRAIT,
  answerableSlots: [],
  onAnswer: vi.fn(),
  onConfirm: vi.fn(),
  onEdit: vi.fn(),
};

describe('OnboardingReflectionRun — no-fabrication invariants', () => {
  it('renders a finding ONLY for done steps; never for non-done steps', () => {
    render(<OnboardingReflectionRun {...baseProps} />);
    expect(screen.getByTestId('reflection-finding-read_back')).toBeInTheDocument();
    expect(screen.queryByTestId('reflection-finding-avatar_sketch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reflection-finding-trust_gap')).not.toBeInTheDocument();
  });

  it('promotes the read-back finding to the restatement hero (the thing the user confirms)', () => {
    render(<OnboardingReflectionRun {...baseProps} />);
    const hero = screen.getByTestId('reflection-restatement');
    expect(hero).toHaveTextContent(/here's what i heard/i);
    expect(hero).toHaveTextContent(/RestWell/);
  });

  it('shows the honest run-level note (not a fabricated score) when nothing is inline-answerable', () => {
    render(<OnboardingReflectionRun {...baseProps} />);
    expect(screen.getByTestId('reflection-needs-input')).toHaveTextContent(/live listing or reviews/i);
  });

  it('hides the run-level note in favour of inline gap-fill when a slot is answerable', () => {
    render(
      <OnboardingReflectionRun
        {...baseProps}
        answerableSlots={[{ key: 'customer', question: 'Who is it for?' }]}
      />,
    );
    expect(screen.queryByTestId('reflection-needs-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('answer-gap-customer')).toBeInTheDocument();
  });

  it('leaks no Tier-C internals across any step string it renders', () => {
    const all = STEPS.flatMap((s) => [s.label, s.tool, s.rationale, s.finding ?? '']);
    for (const text of all) {
      expect(findTierViolations(text)).toEqual([]);
    }
  });
});

describe('OnboardingReflectionRun — confirm + answer interactions', () => {
  it('attaches confirm/reject to a STATEMENT and enables it when a restatement exists', () => {
    render(<OnboardingReflectionRun {...baseProps} />);
    expect(screen.getByTestId('reflection-confirm-gate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sounds right/i })).toBeEnabled();
  });

  it('renders NO confirm gate (you cannot confirm a question) when read-back produced no statement', () => {
    const noFindings = STEPS.map((s) => ({ ...s, status: 'needs_input' as const, finding: null }));
    render(<OnboardingReflectionRun {...baseProps} steps={noFindings} />);
    expect(screen.queryByTestId('reflection-confirm-gate')).not.toBeInTheDocument();
    expect(screen.getByTestId('reflection-restatement-empty')).toBeInTheDocument();
  });

  it('answers a gap inline: Add calls onAnswer with the slot key + typed value', () => {
    const onAnswer = vi.fn();
    render(
      <OnboardingReflectionRun
        {...baseProps}
        onAnswer={onAnswer}
        answerableSlots={[{ key: 'customer', question: 'Who is it for?' }]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Who is it for?'), { target: { value: 'new parents' } });
    fireEvent.click(screen.getByTestId('answer-gap-add-customer'));
    expect(onAnswer).toHaveBeenCalledWith('customer', 'new parents');
  });
});
