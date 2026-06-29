import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import V4ConnectorSetup from '../V4ConnectorSetup';
import { captureAlphaEvent } from '@/lib/posthogClient';
import { V4_ROUTES } from '@/config/v4';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/lib/posthogClient', () => ({
  captureAlphaEvent: vi.fn(),
}));

function renderPage(): void {
  render(
    <MemoryRouter>
      <V4ConnectorSetup />
    </MemoryRouter>,
  );
}

describe('V4ConnectorSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  it('emits the viewed event once on mount', () => {
    renderPage();
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_connector_setup_viewed');
  });

  it('renders the connector + Windsor walkthroughs and the single conversational opener', () => {
    renderPage();
    expect(screen.getByTestId('connector-steps')).toBeInTheDocument();
    expect(screen.getByTestId('windsor-steps')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-url')).toHaveTextContent(
      'https://ideabrandcoach.icodemybusiness.com/mcp',
    );
    // Single casual onboarding prompt (replaces the old two-case walls of text).
    expect(screen.getByTestId('onboard-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('onboard-prompt')).toHaveTextContent(/onboard my brand/i);
    expect(screen.queryByTestId('prompt-case-a')).not.toBeInTheDocument();
    expect(screen.queryByTestId('prompt-case-b')).not.toBeInTheDocument();
  });

  it('copies the MCP URL and emits a copy event', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('mcp-url-copy'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://ideabrandcoach.icodemybusiness.com/mcp',
      ),
    );
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_connector_url_copied', { target: 'mcp_url' });
    await screen.findByText('Copied');
  });

  it('copies the onboarding prompt and emits its copy event', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('onboard-prompt-copy'));
    await waitFor(() =>
      expect(captureAlphaEvent).toHaveBeenCalledWith('v4_connector_prompt_copied', { case: 'onboard' }),
    );
  });

  it('falls back to a manual-copy hint when the clipboard API is unavailable', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    renderPage();
    fireEvent.click(screen.getByTestId('mcp-url-copy'));
    await screen.findByText('Press Ctrl+C');
    expect(captureAlphaEvent).not.toHaveBeenCalledWith('v4_connector_url_copied', {
      target: 'mcp_url',
    });
  });

  it('advances to the funnel on Done and emits the done event', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('connector-done'));
    expect(captureAlphaEvent).toHaveBeenCalledWith('v4_connector_setup_done');
    expect(navigate).toHaveBeenCalledWith(V4_ROUTES.DIAGNOSE);
  });

  it('never instructs the coach to invent metrics (no-fabrication posture)', () => {
    renderPage();
    expect(screen.getByTestId('onboard-prompt')).toHaveTextContent(/no made-up numbers/i);
  });
});
