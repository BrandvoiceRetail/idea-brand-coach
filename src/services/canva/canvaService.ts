/**
 * Canva Connect service — thin typed wrappers over the `canva-*` edge functions.
 *
 * Every method calls `supabase.functions.invoke('canva-...')`, which auto-attaches
 * the signed-in user's JWT. The frontend learns connection status and design data
 * ONLY through these functions — it never touches the Canva token tables, so the
 * auto-generated `types.ts` stays untouched and tokens never reach the browser.
 *
 * Each method surfaces the `error` returned by `invoke` (and any non-2xx error
 * payload the function returns) by throwing a `CanvaServiceError`; callers (the
 * hook) translate that into a `sonner` toast.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AddImportDesign,
  AddImportResponse,
  CanvaDesign,
  CanvaStatus,
  CanvaSyncResponse,
  DisconnectResponse,
  ImportedDesign,
  ImportsRequest,
  ListDesignsResponse,
  ListImportsResponse,
  RemoveImportResponse,
  StartConnectResponse,
} from './types';

/** Typed error thrown when a `canva-*` edge function call fails. */
export class CanvaServiceError extends Error {
  /** Machine-readable slug from the function body when available (e.g. `not_connected`). */
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CanvaServiceError';
    this.code = code;
  }
}

/** Shape of an error payload an edge function may return in its body. */
interface EdgeErrorBody {
  error?: string;
}

function extractErrorCode(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'error' in data) {
    const code = (data as EdgeErrorBody).error;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Invoke a `canva-*` function and return its typed data, or throw
 * `CanvaServiceError` if the transport failed or the body carried an `error`.
 */
async function invokeCanva<TResponse>(
  fn: string,
  body?: Record<string, unknown>,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke<TResponse>(fn, { body });

  if (error) {
    // The function body (even on non-2xx) may include a machine-readable slug.
    const code = extractErrorCode(data);
    throw new CanvaServiceError(error.message || `${fn} failed`, code);
  }

  if (data == null) {
    throw new CanvaServiceError(`${fn} returned no data`);
  }

  // Defensive: a 200 body that still carries an `error` slug is a failure.
  const inlineCode = extractErrorCode(data);
  if (inlineCode) {
    throw new CanvaServiceError(`${fn} failed: ${inlineCode}`, inlineCode);
  }

  return data;
}

/**
 * Begin the OAuth connect flow. Returns the Canva authorize URL the browser
 * should navigate to.
 *
 * @param returnPath in-app path to land on after the callback (default
 *   `/v1/integrations`, resolved server-side against the request Origin).
 */
export async function startConnect(returnPath?: string): Promise<StartConnectResponse> {
  return invokeCanva<StartConnectResponse>('canva-oauth-start', { returnPath });
}

/** Read the current connection status (no tokens). */
export async function getStatus(): Promise<CanvaStatus> {
  return invokeCanva<CanvaStatus>('canva-status');
}

/** Disconnect: best-effort revoke + delete the stored connection. */
export async function disconnect(): Promise<DisconnectResponse> {
  return invokeCanva<DisconnectResponse>('canva-disconnect');
}

/**
 * List the user's live Canva designs.
 *
 * @param continuation opaque cursor from a previous page.
 */
export async function listDesigns(continuation?: string): Promise<{
  designs: CanvaDesign[];
  continuation?: string;
}> {
  return invokeCanva<ListDesignsResponse>('canva-list-designs', { continuation });
}

/** List designs the user has imported into the Brand Coach. */
export async function listImports(): Promise<ImportedDesign[]> {
  const body: ImportsRequest = { action: 'list' };
  const res = await invokeCanva<ListImportsResponse>('canva-imports', body);
  return res.designs;
}

/** Import a design into the Brand Coach. */
export async function addImport(design: AddImportDesign): Promise<ImportedDesign> {
  const body: ImportsRequest = { action: 'add', design };
  const res = await invokeCanva<AddImportResponse>('canva-imports', body);
  return res.design;
}

/** Remove a previously-imported design by its Canva design id. */
export async function removeImport(designId: string): Promise<RemoveImportResponse> {
  const body: ImportsRequest = { action: 'remove', designId };
  return invokeCanva<RemoveImportResponse>('canva-imports', body);
}

/**
 * Push the user's imported Canva designs into their Brand Coach context.
 * Imports already re-sync server-side; this drives an explicit re-sync and
 * returns the current context state for display.
 */
export async function syncToCoach(): Promise<CanvaSyncResponse> {
  return invokeCanva<CanvaSyncResponse>('canva-sync');
}

export const canvaService = {
  startConnect,
  getStatus,
  disconnect,
  listDesigns,
  listImports,
  addImport,
  removeImport,
  syncToCoach,
};
