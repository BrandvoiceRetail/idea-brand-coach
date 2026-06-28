import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecisionBoard } from '../DecisionBoard';
import { findTierViolations } from '@/lib/v4/megapromptParse';
import type { PositioningMove } from '@/types/v4Analyse';

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

const MOVES: PositioningMove[] = [
  {
    id: 'move-a',
    headline: 'The protector who never misses',
    rationale: 'Buyers keep saying it survives the drop their old one failed.',
    criteriaScores: [
      { criterion: 'Ownable', score: 8, why: 'No rival claims it.' },
      { criterion: 'True', score: 9, why: 'Backed by review language.' },
    ],
    composite: 8.5,
  },
  {
    id: 'move-b',
    headline: 'The one you stop thinking about',
    rationale: 'Reviews describe set-and-forget reliability.',
    criteriaScores: [
      { criterion: 'Ownable', score: 6, why: 'Adjacent to a competitor angle.' },
      { criterion: 'Surprising', score: 7, why: 'Reframes the category.' },
    ],
    composite: 6.5,
  },
];

describe('DecisionBoard', () => {
  it('shows the honest empty state and emits nothing when there are no moves', () => {
    render(<DecisionBoard moves={[]} onChooseMove={vi.fn()} />);
    expect(screen.getByTestId('decision-board-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('decision-board-cards')).not.toBeInTheDocument();
  });

  it('shows the loading state and never a card while in flight', () => {
    render(<DecisionBoard moves={[]} onChooseMove={vi.fn()} isLoading />);
    expect(screen.getByTestId('decision-board-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('decision-board-empty')).not.toBeInTheDocument();
  });

  it('shows the honest error state with a working retry — no fabricated moves', () => {
    const onRetry = vi.fn();
    render(<DecisionBoard moves={[]} onChooseMove={vi.fn()} error="engine timeout" onRetry={onRetry} />);
    expect(screen.getByTestId('decision-board-error')).toHaveTextContent(/couldn't generate moves/i);
    expect(screen.queryByTestId('decision-board-cards')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('decision-board-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a card per move with its composite + criteria scores', () => {
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    expect(screen.getByTestId('decision-board-move-move-a')).toBeInTheDocument();
    expect(screen.getByTestId('decision-board-move-move-b')).toBeInTheDocument();
    expect(screen.getByTestId('move-composite-move-a')).toHaveTextContent('8.5');
    expect(screen.getByTestId('move-criteria-move-a')).toHaveTextContent('Ownable');
  });

  it('calls onChooseMove with the full move on selection', () => {
    const onChooseMove = vi.fn();
    render(<DecisionBoard moves={MOVES} onChooseMove={onChooseMove} />);
    fireEvent.click(screen.getByTestId('move-choose-move-b'));
    expect(onChooseMove).toHaveBeenCalledWith(MOVES[1]);
  });

  it('marks the selected move as chosen', () => {
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} selectedMoveId="move-a" />);
    const card = screen.getByTestId('decision-board-move-move-a');
    expect(card).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('move-choose-move-a')).toHaveTextContent(/chosen/i);
  });

  it('emits moves_shown (populated) and move_selected (on pick)', async () => {
    const { captureAlphaEvent } = await import('@/lib/posthogClient');
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_decision_board_moves_shown', { count: 2 });
    fireEvent.click(screen.getByTestId('move-choose-move-a'));
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_decision_board_move_selected', {
      move_id: 'move-a',
      composite: 8.5,
    });
  });

  it('flips to a compare view across moves', () => {
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    fireEvent.click(screen.getByTestId('decision-board-compare-toggle'));
    const table = screen.getByTestId('decision-board-compare');
    expect(table).toHaveTextContent('Composite');
    expect(table).toHaveTextContent('Ownable');
    expect(table).toHaveTextContent('Surprising');
  });

  it('marks the highest-composite move as the best fit and only that one', () => {
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    expect(screen.getByTestId('move-bestfit-move-a')).toBeInTheDocument();
    expect(screen.queryByTestId('move-bestfit-move-b')).not.toBeInTheDocument();
  });

  it('exposes a "Why #1?" affordance that reveals a composite explanation derived from real scores', () => {
    render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    // Collapsed by default — no fabricated narrative shown until asked.
    expect(screen.queryByTestId('move-why-move-a')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('move-why-toggle-move-a'));
    const why = screen.getByTestId('move-why-move-a');
    // Numbers must trace to the moves passed in: top composite, lead over runner-up.
    expect(why).toHaveTextContent('composite of 8.5');
    expect(why).toHaveTextContent('2 ahead'); // 8.5 - 6.5
    expect(why).toHaveTextContent('The one you stop thinking about');
  });

  it('shows no "Why #1?" ranking explanation when there is only one move', () => {
    render(<DecisionBoard moves={[MOVES[0]]} onChooseMove={vi.fn()} />);
    expect(screen.queryByTestId('move-why-toggle-move-a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('move-bestfit-move-a')).not.toBeInTheDocument();
  });

  it('leaks no Tier-C internals in its rendered copy', () => {
    const { container } = render(<DecisionBoard moves={MOVES} onChooseMove={vi.fn()} />);
    expect(findTierViolations(container.textContent ?? '')).toEqual([]);
  });
});
