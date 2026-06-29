import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiagnosisScreen } from '../DiagnosisScreen';
import { PrescriptionScreen } from '../PrescriptionScreen';
import { QuestionScale } from '../glass';

/**
 * The dark-liquid-glass entry arc (ux-design-entry-experience.md):
 *   Movement 2 (Diagnosis) names the Trust Gap AFTER describing the mechanism (AC#2);
 *   Movement 3 (Prescription) puts credentials last + the entry CTA (AC#3, AC#10);
 *   QuestionScale presents one 1–5 question at a time as a radiogroup (AC#4).
 */
describe('Glass entry arc', () => {
  it('Movement 2 (Diagnosis) names the Trust Gap and advances on "Go on"', () => {
    const onContinue = vi.fn();
    render(<DiagnosisScreen onContinue={onContinue} />);
    // The name appears only AFTER the mechanism is described (AC#2).
    expect(screen.getByText('Trust Gap')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go on/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('Movement 3 (Prescription) puts credentials last and uses the entry CTA', () => {
    const onContinue = vi.fn();
    render(<PrescriptionScreen onContinue={onContinue} />);
    expect(screen.getByText(/35 years/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /find my trust gap/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('QuestionScale is a 1–5 radiogroup that reports the chosen value', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionScale
        index={0}
        total={4}
        question="Does your hero image speak to the moment?"
        ends={['All specs', 'Speaks to the moment']}
        onAnswer={onAnswer}
      />,
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByText(/Question 1 of 4/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
    expect(onAnswer).toHaveBeenCalledWith(4);
  });
});
