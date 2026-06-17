/**
 * FigmaIntegrationService
 *
 * Frontend boundary for the Figma integration. Every call goes through the
 * Supabase edge functions via `supabase.functions.invoke` (never raw fetch, and
 * never a direct DB read of the token tables — those are service-role only).
 */
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface FigmaPaletteEntry {
  hex: string;
  name?: string;
  opacity?: number;
}

export interface FigmaTypographyEntry {
  name?: string;
  fontFamily: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
}

export interface FigmaComponentEntry {
  name: string;
  key?: string;
  description?: string;
}

export interface FigmaImport {
  id: string;
  file_key: string;
  file_name: string | null;
  thumbnail_url: string | null;
  last_modified: string | null;
  palette: FigmaPaletteEntry[];
  typography: FigmaTypographyEntry[];
  components: FigmaComponentEntry[];
  pages: string[];
  summary: string | null;
  created_at: string;
  updated_at?: string;
}

export interface FigmaConnection {
  figmaUserId: string | null;
  handle: string | null;
  email: string | null;
  scope: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
}

export interface FigmaStatus {
  connected: boolean;
  connection: FigmaConnection | null;
  imports: FigmaImport[];
}

/** Pull the user-facing message out of a non-2xx edge-function response. */
async function extractErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* response body wasn't JSON — fall through */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    throw new Error(await extractErrorMessage(error, 'Figma request failed'));
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export const FigmaIntegrationService = {
  /** Current connection status + recent imports for the signed-in user. */
  getStatus(): Promise<FigmaStatus> {
    return invoke<FigmaStatus>('figma-status');
  },

  /** Begin OAuth — returns the Figma authorize URL and the CSRF state. */
  startConnect(redirectUri: string): Promise<{ url: string; state: string }> {
    return invoke<{ url: string; state: string }>('figma-oauth-start', { redirectUri });
  },

  /** Finish OAuth — exchange the authorization code for a stored connection. */
  completeConnect(params: { code: string; state: string; redirectUri: string }): Promise<{
    connected: boolean;
    handle: string | null;
    email: string | null;
  }> {
    return invoke('figma-oauth-exchange', { ...params });
  },

  /** Import a Figma file's design data (accepts a file URL or a raw key). */
  importFile(fileUrlOrKey: string): Promise<{ import: FigmaImport; coachUpdated: boolean }> {
    return invoke('figma-sync', { fileUrlOrKey });
  },

  /** Remove the Figma connection (imported design data is kept). */
  disconnect(): Promise<{ disconnected: boolean }> {
    return invoke('figma-disconnect');
  },
};
