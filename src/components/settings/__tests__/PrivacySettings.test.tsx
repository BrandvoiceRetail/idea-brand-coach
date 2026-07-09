import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { PrivacySettings } from '../PrivacySettings';

const mockRequestDataExport = vi.hoisted(() => vi.fn());
const mockDownloadExportFile = vi.hoisted(() => vi.fn());
const mockDeleteAccount = vi.hoisted(() => vi.fn());
const mockRecordConsentDecision = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/services/gdprService', () => ({
  requestDataExport: mockRequestDataExport,
  downloadExportFile: mockDownloadExportFile,
  deleteAccount: mockDeleteAccount,
}));
vi.mock('@/services/consentService', () => ({
  recordConsentDecision: mockRecordConsentDecision,
}));

function renderPage(): void {
  render(
    <MemoryRouter>
      <PrivacySettings />
    </MemoryRouter>,
  );
}

describe('PrivacySettings (GDPR self-service)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('analytics toggle writes the consent store AND the durable ledger', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('switch'));

    expect(JSON.parse(localStorage.getItem('idea.consent.v1') ?? '{}').analytics).toBe('granted');
    expect(mockRecordConsentDecision).toHaveBeenCalledWith('analytics', true, 'settings');
  });

  it('downloads the export when the edge function succeeds', async () => {
    mockRequestDataExport.mockResolvedValue({ data: { format: 'x' }, error: null });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Download my data/i }));

    await waitFor(() => {
      expect(mockDownloadExportFile).toHaveBeenCalledWith({ format: 'x' });
    });
  });

  it('keeps the final delete action DISABLED until the user types DELETE', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Delete my account and data/i }));

    const confirmButton = await screen.findByRole('button', { name: /Delete everything/i });
    expect(confirmButton).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText(/Type DELETE to confirm/i), 'DELETE');
    expect(confirmButton).toBeEnabled();
  });

  it('only calls the erasure service after typed confirmation', async () => {
    mockDeleteAccount.mockResolvedValue({ deleted: false, error: 'nope' });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Delete my account and data/i }));
    await userEvent.type(await screen.findByPlaceholderText(/Type DELETE to confirm/i), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: /Delete everything/i }));

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    });
  });
});
