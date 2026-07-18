/**
 * Integration test for the Moment 1 trigger wiring: picking a Positioning Statement option must open
 * the self-contained FeedbackMoment1 modal with the chosen Positioning Statement. usePositioningStatementReveal is
 * mocked to land directly on the 'options' stage; useFeedbackEvent is mocked (no real write).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositioningStatementReveal } from '../PositioningStatementReveal';
import { usePositioningStatementReveal } from '@/hooks/v2/usePositioningStatementReveal';
import { useFeedbackEvent } from '@/hooks/v2/useFeedbackEvent';

vi.mock('@/hooks/v2/usePositioningStatementReveal');
vi.mock('@/hooks/v2/useFeedbackEvent');

const OPTIONS = [
  "They aren't buying a binder, they're buying a finished collection.",
  "They aren't buying storage, they're buying the end of worry.",
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useFeedbackEvent).mockReturnValue({
    isSubmitting: false,
    error: null,
    recordEvent: vi.fn().mockResolvedValue({ ok: true, id: 'evt' }),
  });
  vi.mocked(usePositioningStatementReveal).mockReturnValue({
    stage: 'options',
    reviews: '',
    setReviews: vi.fn(),
    options: OPTIONS,
    isInference: false,
    selectedIndex: null,
    surprise: null,
    error: null,
    reveal: vi.fn(),
    pickOption: vi.fn(),
    answerSurprise: vi.fn(),
    backToOptions: vi.fn(),
    reset: vi.fn(),
  });
});

describe('PositioningStatementReveal → Moment 1 feedback trigger', () => {
  it('opens the FeedbackMoment1 modal after the user picks an option', () => {
    render(<PositioningStatementReveal messages={[]} fieldValues={{}} />);

    // open the Positioning Statement dialog (lands on the mocked 'options' stage)
    fireEvent.click(screen.getByRole('button', { name: /reveal positioning/i }));
    // feedback prompt not shown yet
    expect(screen.queryByText(/did the score feel right/i)).not.toBeInTheDocument();

    // pick the first option
    fireEvent.click(screen.getByRole('button', { name: OPTIONS[0] }));

    // the self-contained feedback modal is now open with its three prompts
    expect(screen.getByText(/did the score feel right/i)).toBeInTheDocument();
    expect(screen.getByText(/did the positioning statement feel right/i)).toBeInTheDocument();
    expect(screen.getByText(/what'?s off/i)).toBeInTheDocument();
  });
});
