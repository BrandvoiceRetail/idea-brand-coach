import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { ChatMessageList } from '@/components/v2/ChatMessageList';

type Props = ComponentProps<typeof ChatMessageList>;

/**
 * Covers the first-run (FTUE) starter prompts in the empty chat state.
 */
describe('ChatMessageList — first-run starter prompts', () => {
  const baseProps = (overrides: Partial<Props> = {}): Props => ({
    messages: [],
    isStreaming: false,
    streamingContent: null,
    isSending: false,
    isExtractingFromDoc: false,
    messageExtractions: {},
    fieldValues: {},
    isFieldLocked: () => false,
    onFieldClick: vi.fn(),
    onAcceptAllFromMessage: vi.fn(),
    onFieldAccept: vi.fn(),
    onReopenReview: vi.fn(),
    messagesEndRef: { current: null },
    ...overrides,
  });

  it('renders tappable starter prompts in the empty state and seeds the first message on click', () => {
    const onQuickStart = vi.fn();
    render(<ChatMessageList {...baseProps({ onQuickStart })} />);

    expect(screen.getByText('Welcome to Brand Coach')).toBeInTheDocument();
    expect(screen.getByText(/Not sure where to start/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /define my brand's purpose/i }));
    expect(onQuickStart).toHaveBeenCalledWith(
      "Help me define my brand's purpose — the deeper reason it exists.",
    );
  });

  it('omits the starter prompts when onQuickStart is not provided (e.g. a gap-opener owns the empty state)', () => {
    render(<ChatMessageList {...baseProps()} />);

    expect(screen.getByText('Welcome to Brand Coach')).toBeInTheDocument();
    expect(screen.queryByText(/Not sure where to start/i)).not.toBeInTheDocument();
  });
});
