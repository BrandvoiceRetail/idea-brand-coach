import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from '@/integrations/supabase/client';
import { FigmaIntegrationService } from '@/services/FigmaIntegrationService';

const invokeMock = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe('FigmaIntegrationService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns the edge-function payload on success', async () => {
    invokeMock.mockResolvedValue({
      data: { connected: false, connection: null, imports: [] },
      error: null,
    });
    const status = await FigmaIntegrationService.getStatus();
    expect(status.connected).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('figma-status', { body: undefined });
  });

  it('throws the in-body error message when the function returns { error }', async () => {
    invokeMock.mockResolvedValue({
      data: { error: 'No access to that Figma file' },
      error: null,
    });
    await expect(FigmaIntegrationService.importFile('abc123')).rejects.toThrow(
      'No access to that Figma file',
    );
  });

  it('surfaces a transport error message', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(FigmaIntegrationService.getStatus()).rejects.toThrow('boom');
  });

  it('passes the redirectUri through to figma-oauth-start', async () => {
    invokeMock.mockResolvedValue({ data: { url: 'https://figma/oauth', state: 's' }, error: null });
    await FigmaIntegrationService.startConnect('https://app/integrations/figma/callback');
    expect(invokeMock).toHaveBeenCalledWith('figma-oauth-start', {
      body: { redirectUri: 'https://app/integrations/figma/callback' },
    });
  });
});
