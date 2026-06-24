import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecognitionScreen } from '../RecognitionScreen';

/**
 * Movement 1 (Recognition) — IDEA-APP-ENTRY-001 v1.1.
 *
 * These tests encode Trevor's acceptance criteria as an executable guard:
 *   AC#1 — no product references, no framework vocabulary, no "Trust Gap" terms;
 *          entirely about the customer's experience.
 *   AC#9 — no buyer-state names (Assessor, Protector, Expresser, Connector) in any
 *          user-facing element.
 * (AC#8, no CAPTURE element names, is satisfied by the same clean copy; the
 *  framework-vocabulary guard below covers the relevant cases.)
 */
describe('RecognitionScreen (Movement 1 — Recognition)', () => {
  it('mirrors the customer experience and ends on the unanswered "why"', () => {
    render(<RecognitionScreen onContinue={vi.fn()} />);
    expect(
      screen.getByText(/looked at that listing more times than you can count/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nobody has been able to tell you why/i)).toBeInTheDocument();
  });

  it('advances via the customer-voiced CTA, not a product CTA', () => {
    const onContinue = vi.fn();
    render(<RecognitionScreen onContinue={onContinue} />);
    const cta = screen.getByRole('button', { name: /show me why/i });
    fireEvent.click(cta);
    expect(onContinue).toHaveBeenCalledTimes(1);
    // The Movement-3 product CTA must NOT appear on Movement 1.
    expect(screen.queryByText(/find my trust gap/i)).not.toBeInTheDocument();
  });

  it('contains no product, framework, Trust-Gap, or buyer-state vocabulary (AC#1, AC#9)', () => {
    const { container } = render(<RecognitionScreen onContinue={vi.fn()} />);
    const text = container.textContent ?? '';
    const forbidden: RegExp[] = [
      /trust gap/i,
      /brand coach/i,
      /\bIDEA\b/,
      /framework/i,
      /diagnostic/i,
      /decision trigger/i,
      /\bavatar/i,
      /\b(Assessor|Protector|Expresser|Connector)\b/,
    ];
    for (const re of forbidden) {
      expect(text, `Movement 1 must not contain ${re}`).not.toMatch(re);
    }
  });
});
