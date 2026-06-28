import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InClaudeScreen } from '../InClaudeScreen';

/**
 * S8 (terminal screen) must never be a dead-end. The original bug: it offered
 * only "Stay ahead" (back) and "Restart", with no way back into the main app —
 * a user who finished the diagnostic from the /v4 spine was stranded.
 *
 * These tests guard the exit affordances added to fix that.
 */
describe('InClaudeScreen — terminal exits', () => {
  it('always offers Back/Restart', () => {
    render(<InClaudeScreen onBack={vi.fn()} onRestart={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByRole('button', { name: /stay ahead/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument();
  });

  it('shows a forward CTA + a quiet "Back to home" when a next destination is given', () => {
    const onContinue = vi.fn();
    const onHome = vi.fn();
    render(
      <InClaudeScreen
        onBack={vi.fn()}
        onRestart={vi.fn()}
        onContinue={onContinue}
        continueLabel="Continue to Analyse"
        onHome={onHome}
      />,
    );

    const forward = screen.getByRole('button', { name: /continue to analyse/i });
    fireEvent.click(forward);
    expect(onContinue).toHaveBeenCalledTimes(1);

    const home = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(home);
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('falls back to a single "back to home" CTA when there is no next destination (v2/v3 callers)', () => {
    const onHome = vi.fn();
    render(<InClaudeScreen onBack={vi.fn()} onRestart={vi.fn()} onHome={onHome} />);

    // No forward continue when no destination was supplied…
    expect(screen.queryByRole('button', { name: /continue to/i })).not.toBeInTheDocument();
    // …but the flow is still escapable.
    const home = screen.getByRole('button', { name: /back to home/i });
    fireEvent.click(home);
    expect(onHome).toHaveBeenCalledTimes(1);
  });
});
