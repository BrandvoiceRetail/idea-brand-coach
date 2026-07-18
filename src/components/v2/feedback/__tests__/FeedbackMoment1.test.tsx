import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { FeedbackMoment1 } from '../FeedbackMoment1';
import { useFeedbackEvent } from '@/hooks/v2/useFeedbackEvent';

vi.mock('@/hooks/v2/useFeedbackEvent');

const recordEvent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  recordEvent.mockResolvedValue({ ok: true, id: 'evt-1' });
  vi.mocked(useFeedbackEvent).mockReturnValue({
    isSubmitting: false,
    error: null,
    recordEvent,
  });
});

const POSITIONING_STATEMENT = "They aren't buying a binder, they're buying the feeling of a finished collection.";

describe('FeedbackMoment1', () => {
  it('renders nothing when closed', () => {
    render(<FeedbackMoment1 open={false} onClose={vi.fn()} chosenPositioningStatement={POSITIONING_STATEMENT} />);
    expect(screen.queryByText(/did the score feel right/i)).not.toBeInTheDocument();
  });

  it('shows the three v3-framed prompts when open', () => {
    render(<FeedbackMoment1 open onClose={vi.fn()} chosenPositioningStatement={POSITIONING_STATEMENT} />);
    expect(screen.getByText(/did the score feel right/i)).toBeInTheDocument();
    expect(screen.getByText(/did the positioning statement feel right/i)).toBeInTheDocument();
    expect(screen.getByText(/what'?s off/i)).toBeInTheDocument();
    // v3 framing, NOT the older "Draft Canvas" wording
    expect(screen.queryByText(/draft canvas/i)).not.toBeInTheDocument();
  });

  it('submits a moment_1 event with chosen_positioning_statement, scores and free_text, then thanks', async () => {
    const onClose = vi.fn();
    render(<FeedbackMoment1 open onClose={onClose} chosenPositioningStatement={POSITIONING_STATEMENT} sessionId="sess-9" />);

    fireEvent.click(within(screen.getByRole('group', { name: /did the score feel right/i })).getByRole('button', { name: /^yes$/i }));
    fireEvent.click(within(screen.getByRole('group', { name: /did the positioning statement feel right/i })).getByRole('button', { name: /^no$/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'score felt high' } });

    fireEvent.click(screen.getByRole('button', { name: /submit|send feedback/i }));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(1));
    expect(recordEvent).toHaveBeenCalledWith({
      moment: 'moment_1',
      sessionId: 'sess-9',
      payload: {
        chosen_positioning_statement: POSITIONING_STATEMENT,
        scores: { score_felt_right: 'yes', positioning_statement_felt_right: 'no' },
        free_text: 'score felt high',
      },
    });
    // thank-you state (title; description also contains "Thanks", so match the title phrase)
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });

  it('logs a skipped event when dismissed without submitting', async () => {
    const onClose = vi.fn();
    render(<FeedbackMoment1 open onClose={onClose} chosenPositioningStatement={POSITIONING_STATEMENT} />);

    fireEvent.click(screen.getByRole('button', { name: /skip|not now|dismiss/i }));

    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(1));
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        moment: 'moment_1',
        payload: expect.objectContaining({ skipped: true, chosen_positioning_statement: POSITIONING_STATEMENT }),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does NOT log a skip after a successful submit when the dialog then closes', async () => {
    const onClose = vi.fn();
    render(<FeedbackMoment1 open onClose={onClose} chosenPositioningStatement={POSITIONING_STATEMENT} />);
    fireEvent.click(screen.getByRole('button', { name: /submit|send feedback/i }));
    await waitFor(() => expect(recordEvent).toHaveBeenCalledTimes(1));

    // close from the thank-you state ("Done"; avoid matching shadcn's sr-only "Close" X)
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(recordEvent).toHaveBeenCalledTimes(1); // no extra skip write
    expect(recordEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ skipped: true }) }),
    );
  });
});
