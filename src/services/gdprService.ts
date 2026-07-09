/**
 * gdprService — client gateway to the GDPR edge functions (data export and
 * account erasure). Follows the FigmaIntegrationService precedent: plain
 * functions over `supabase.functions.invoke` (never raw fetch), Result-style
 * returns, user-facing toasts left to the caller.
 */
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface GdprExportResult {
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface GdprDeleteResult {
  deleted: boolean;
  error: string | null;
}

async function extractErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through
    }
  }
  return error instanceof Error ? error.message : fallback;
}

/** Art. 15/20 — fetch the caller's complete data export (JSON document). */
export async function requestDataExport(): Promise<GdprExportResult> {
  const { data, error } = await supabase.functions.invoke('gdpr-export', { body: {} });
  if (error) {
    return { data: null, error: await extractErrorMessage(error, 'Export failed') };
  }
  const payload = (data as { export?: Record<string, unknown>; error?: string }) ?? {};
  if (payload.error) return { data: null, error: String(payload.error) };
  return { data: payload.export ?? null, error: null };
}

/** Trigger a browser download of the export as a JSON file. */
export function downloadExportFile(exportData: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `idea-brand-coach-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Art. 17 — erase the caller's account and all personal data. */
export async function deleteAccount(): Promise<GdprDeleteResult> {
  const { data, error } = await supabase.functions.invoke('gdpr-delete-account', {
    body: { confirm: 'DELETE' },
  });
  if (error) {
    return { deleted: false, error: await extractErrorMessage(error, 'Deletion failed') };
  }
  const payload = (data as { deleted?: boolean; error?: string }) ?? {};
  if (payload.error) return { deleted: false, error: String(payload.error) };
  return { deleted: payload.deleted === true, error: null };
}
