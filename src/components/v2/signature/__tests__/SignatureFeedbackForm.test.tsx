import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { SignatureFeedbackForm } from '../SignatureFeedbackForm';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { supabase } from '@/integrations/supabase/client';
import { captureAlphaEvent, getPostHogDistinctId } from '@/lib/posthogClient';

vi.mock('@/contexts/AvatarContext');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
  getPostHogDistinctId: vi.fn(),
}));

const OPTIONS = ['Signature A', 'Signature B', 'Signature C'];

function renderForm(): void {
  render(
    <SignatureFeedbackForm
      chosenSignature="Signature B"
      signatureOptions={OPTIONS}
      sessionId="session-9"
    />,
  );
}

describe('SignatureFeedbackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(useAvatarContext).mockReturnValue({
      currentAvatar: { id: 'avatar-1' },
    } as ReturnType<typeof useAvatarContext>);
    vi.mocked(getPostHogDistinctId).mockReturnValue('ph-distinct-1');
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { success: true }, error: null });
  });

  it('fires feedback_modal_opened on mount', () => {
    renderForm();

    expect(captureAlphaEvent).toHaveBeenCalledWith('feedback_modal_opened');
  });

  it('renders both hypothesis questions and the free-text field', () => {
    renderForm();

    expect(screen.getByText('Did your Trust Gap score feel right?')).toBeInTheDocument();
    expect(screen.getByText('Does this Signature feel right?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/missed, surprised/i)).toBeInTheDocument();
  });

  it('disables submit until both questions are answered', async () => {
    const user = userEvent.setup();
    renderForm();

    const submit = screen.getByRole('button', { name: /send feedback/i });
    expect(submit).toBeDisabled();

    // Answer q1 only
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    expect(submit).toBeDisabled();

    // Answer q2
    await user.click(screen.getAllByRole('button', { name: 'Partially' })[1]);
    expect(submit).toBeEnabled();
  });

  it('submits the feedback row with the PostHog join key and all context', async () => {
    localStorage.setItem(
      'diagnosticData',
      JSON.stringify({ scores: { insight: 60, distinctive: 40, empathetic: 80, authentic: 70, overall: 62 } }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'No' })[1]);
    await user.type(screen.getByPlaceholderText(/missed, surprised/i), 'Too generic');
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('save-feedback-event', {
        body: {
          moment: 'moment_1',
          posthogDistinctId: 'ph-distinct-1',
          avatarId: 'avatar-1',
          sessionId: 'session-9',
          chosenSignature: 'Signature B',
          signatureOptions: OPTIONS,
          scores: { insight: 60, distinctive: 40, empathetic: 80, authentic: 70, overall: 62 },
          q1ScoreFeltRight: 'yes',
          q2SignatureFeltRight: 'no',
          q3WhatsOff: 'Too generic',
        },
      });
    });
  });

  it('shows the thank-you state and fires feedback_submitted + thank_you_viewed', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[1]);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });
    expect(captureAlphaEvent).toHaveBeenCalledWith('feedback_submitted', { q1: 'yes', q2: 'yes' });
    expect(captureAlphaEvent).toHaveBeenCalledWith('thank_you_viewed');
  });

  it('handles a missing avatar and empty q3', async () => {
    vi.mocked(useAvatarContext).mockReturnValue({ currentAvatar: null } as ReturnType<typeof useAvatarContext>);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getAllByRole('button', { name: 'Partially' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Partially' })[1]);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'save-feedback-event',
        expect.objectContaining({
          body: expect.objectContaining({
            avatarId: null,
            q3WhatsOff: null,
            posthogDistinctId: 'ph-distinct-1',
          }),
        }),
      );
    });
  });

  it('shows an inline error and stays submittable when the write fails', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getAllByRole('button', { name: 'Yes' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Yes' })[1]);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i);
    });
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeEnabled();
    expect(captureAlphaEvent).not.toHaveBeenCalledWith('feedback_submitted', expect.anything());
    expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument();
  });
});
