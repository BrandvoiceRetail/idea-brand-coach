/**
 * useFigmaIntegration — loads Figma connection status and exposes the connect /
 * disconnect / import actions used by the Integrations settings UI.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  FigmaIntegrationService,
  type FigmaStatus,
  type FigmaImport,
} from '@/services/FigmaIntegrationService';
import { ROUTES } from '@/config/routes';
import { captureAlphaEvent } from '@/lib/posthogClient';

/** sessionStorage key for the client-side CSRF check on the OAuth round-trip. */
export const FIGMA_STATE_KEY = 'figma_oauth_state';

/** The OAuth redirect URI — must match the Figma app's configured callback. */
export function figmaRedirectUri(): string {
  return `${window.location.origin}${ROUTES.FIGMA_CALLBACK}`;
}

export interface UseFigmaIntegration {
  status: FigmaStatus | null;
  loading: boolean;
  error: string | null;
  importing: boolean;
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  importFile: (fileUrlOrKey: string) => Promise<FigmaImport | null>;
}

export function useFigmaIntegration(): UseFigmaIntegration {
  const [status, setStatus] = useState<FigmaStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await FigmaIntegrationService.getStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Figma status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async (): Promise<void> => {
    captureAlphaEvent('figma_connect_started');
    try {
      const { url, state } = await FigmaIntegrationService.startConnect(figmaRedirectUri());
      sessionStorage.setItem(FIGMA_STATE_KEY, state);
      window.location.href = url; // full-page redirect to Figma's consent screen
    } catch (e) {
      // Surfaces the figma-oauth-start backend failure (e.g. 500 not_configured) into PostHog.
      captureAlphaEvent('figma_connect_failed', { error_type: e instanceof Error ? e.name : 'unknown' });
      toast.error(e instanceof Error ? e.message : 'Could not start Figma connection');
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      await FigmaIntegrationService.disconnect();
      captureAlphaEvent('figma_disconnected');
      toast.success('Figma disconnected');
      await refresh();
    } catch (e) {
      captureAlphaEvent('figma_disconnect_failed', { error_type: e instanceof Error ? e.name : 'unknown' });
      toast.error(e instanceof Error ? e.message : 'Could not disconnect Figma');
    }
  }, [refresh]);

  const importFile = useCallback(
    async (fileUrlOrKey: string): Promise<FigmaImport | null> => {
      setImporting(true);
      captureAlphaEvent('figma_import_started');
      try {
        const { import: imported } = await FigmaIntegrationService.importFile(fileUrlOrKey);
        captureAlphaEvent('figma_import_completed');
        toast.success(`Imported "${imported.file_name ?? 'design'}" into your brand context`);
        await refresh();
        return imported;
      } catch (e) {
        captureAlphaEvent('figma_import_failed', { error_type: e instanceof Error ? e.name : 'unknown' });
        toast.error(e instanceof Error ? e.message : 'Could not import from Figma');
        return null;
      } finally {
        setImporting(false);
      }
    },
    [refresh],
  );

  return { status, loading, error, importing, refresh, connect, disconnect, importFile };
}
