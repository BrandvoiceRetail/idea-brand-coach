import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * TrevorCoachWidget — external open-request behaviour. Another /v4 surface (e.g.
 * V4Fix "Open the coach to refine") asks the floating coach to take over via the
 * CoachWidgetContext instead of routing to the legacy /v2/coach page. This suite
 * proves the widget pops open and seeds its composer from that request — the chat
 * engine is stubbed (covered elsewhere).
 */
vi.mock('@/hooks/useChat', () => ({
  useChat: () => ({ messages: [], sendMessage: vi.fn().mockResolvedValue(undefined), isSending: false }),
}));
vi.mock('@/hooks/useChatSessions', () => ({
  useChatSessions: () => ({ currentSessionId: 'session-1' }),
}));
vi.mock('@/hooks/useDocumentUpload', () => ({
  useDocumentUpload: () => ({
    documents: [],
    isUploading: false,
    fileInputRef: { current: null },
    handleFileSelect: vi.fn(),
  }),
}));
vi.mock('@/contexts/AvatarContext', () => ({
  useAvatarContext: () => ({ selectedAvatarId: null }),
}));

import { TrevorCoachWidget } from '../TrevorCoachWidget';
import { CoachWidgetProvider, useCoachWidget } from '@/contexts/CoachWidgetContext';

/** A tiny consumer that fires an open request — stands in for V4Fix's button. */
function Opener({ message }: { message?: string }): JSX.Element {
  const { openCoach } = useCoachWidget();
  return (
    <button type="button" onClick={() => openCoach(message ? { message } : undefined)}>
      open from page
    </button>
  );
}

const renderWithProvider = (message?: string): void => {
  render(
    <CoachWidgetProvider>
      <Opener message={message} />
      <TrevorCoachWidget />
    </CoachWidgetProvider>,
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('TrevorCoachWidget — external open request', () => {
  it('stays closed until something requests it (FAB only)', () => {
    renderWithProvider();
    expect(screen.queryByTestId('coach-widget-panel')).toBeNull();
    expect(screen.getByTestId('coach-widget-launcher')).toBeInTheDocument();
  });

  it('opens the panel when a page requests the coach', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('open from page'));
    expect(screen.getByTestId('coach-widget-panel')).toBeInTheDocument();
  });

  it('seeds the composer with the request message (editable, not sent)', () => {
    const seed = 'I\'m refining the fix for "Amazon Listing".';
    renderWithProvider(seed);
    fireEvent.click(screen.getByText('open from page'));
    const input = screen.getByTestId('coach-widget-input') as HTMLTextAreaElement;
    expect(input.value).toBe(seed);
  });

  it('re-opens after the user closes it (nonce re-fires on each request)', () => {
    renderWithProvider('first');
    fireEvent.click(screen.getByText('open from page'));
    fireEvent.click(screen.getByTestId('coach-widget-close'));
    expect(screen.queryByTestId('coach-widget-panel')).toBeNull();

    fireEvent.click(screen.getByText('open from page'));
    expect(screen.getByTestId('coach-widget-panel')).toBeInTheDocument();
  });
});
