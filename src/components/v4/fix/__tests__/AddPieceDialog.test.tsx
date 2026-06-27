import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddPieceDialog } from '../AddPieceDialog';
import type { DataResult, FunnelPiece } from '@/types/v4Fix';
import type { BrandAssetCreate } from '@/services/interfaces/IBrandFunnelService';

// Radix Select relies on pointer-capture + scrollIntoView APIs jsdom omits.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = (): boolean => false;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = (): void => {};
  }
});

/** Pick the Amazon-listing touchpoint through the Radix Select. */
async function pickAmazonListing(): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('v4-add-piece-touchpoint'));
  await user.click(await screen.findByText('Amazon listing (title, bullets, A+)'));
}

const captureAlphaEvent = vi.fn();
vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: (...args: unknown[]) => captureAlphaEvent(...args),
}));

const PIECE: FunnelPiece = {
  id: 'asset-1',
  touchpointId: 'amazon_listing_copy',
  stage: 'consideration',
  channel: 'amazon',
  status: 'doing_job',
  job: 'Convert the visit into an order.',
  storedContent: {
    title: null,
    bullets: [],
    price: null,
    rating: null,
    reviewCount: null,
    updatedAt: null,
  },
};

const VALID_CONTENT = '216-Card Toploader Binder — built for the long haul.';

function setup(overrides: Partial<React.ComponentProps<typeof AddPieceDialog>> = {}) {
  const onAdd = vi.fn<[BrandAssetCreate], Promise<DataResult<FunnelPiece>>>().mockResolvedValue({
    status: 'ok',
    data: PIECE,
  });
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  render(
    <AddPieceDialog
      open
      onOpenChange={onOpenChange}
      avatarId="avatar-1"
      onAdd={onAdd}
      onAdded={onAdded}
      {...overrides}
    />,
  );
  return { onAdd, onOpenChange, onAdded };
}

describe('AddPieceDialog', () => {
  beforeEach(() => captureAlphaEvent.mockClear());

  it('renders the dialog with the content tabs and screenshot post-Alpha note', () => {
    setup();
    expect(screen.getByTestId('v4-add-piece-dialog')).toBeInTheDocument();
    expect(screen.getByText('Paste copy')).toBeInTheDocument();
    expect(screen.getByText('Upload screenshot')).toBeInTheDocument();
  });

  it('keeps submit disabled until a touchpoint + valid content are present', () => {
    setup();
    const submit = screen.getByTestId('v4-add-piece-submit');
    expect(submit).toBeDisabled();
  });

  it('shows an honest validation hint when content is too short', () => {
    setup();
    fireEvent.change(screen.getByTestId('v4-add-piece-content'), { target: { value: 'short' } });
    expect(screen.getByTestId('v4-add-piece-content-error')).toBeInTheDocument();
  });

  it('disables submit and explains when no avatar is selected', () => {
    setup({ avatarId: null });
    expect(screen.getByTestId('v4-add-piece-no-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('v4-add-piece-submit')).toBeDisabled();
  });

  it('calls the addPiece seam, fires telemetry, and closes on success', async () => {
    const { onAdd, onAdded, onOpenChange } = setup();
    // jsdom Radix Select interaction is brittle; drive state via the content field
    // + a direct submit once a touchpoint is chosen through the hidden native value.
    fireEvent.change(screen.getByTestId('v4-add-piece-content'), {
      target: { value: VALID_CONTENT },
    });
    await pickAmazonListing();

    const submit = screen.getByTestId('v4-add-piece-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    const input = onAdd.mock.calls[0][0];
    expect(input.avatarId).toBe('avatar-1');
    expect(input.touchpointId).toBe('amazon_listing_copy');
    expect(input.contentText).toBe(VALID_CONTENT);
    expect(input.contextDescription.length).toBeGreaterThanOrEqual(8);

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(PIECE));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_add_piece_submitted', expect.any(Object));
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_add_piece_succeeded', expect.any(Object));
  });

  it('surfaces the seam error and stays open on failure', async () => {
    const onAdd = vi.fn().mockResolvedValue({ status: 'error', error: 'Could not add that piece.' });
    render(
      <AddPieceDialog open onOpenChange={vi.fn()} avatarId="avatar-1" onAdd={onAdd} />,
    );
    fireEvent.change(screen.getByTestId('v4-add-piece-content'), {
      target: { value: VALID_CONTENT },
    });
    await pickAmazonListing();
    const submit = screen.getByTestId('v4-add-piece-submit');
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(screen.getByTestId('v4-add-piece-submit-error')).toHaveTextContent(
        'Could not add that piece.',
      ),
    );
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_add_piece_failed', expect.any(Object));
  });
});
