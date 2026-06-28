/**
 * useDefendRun — drives the Loop-5 (Defend) orchestration for V4Defend.
 *
 * WHAT: Owns ALL Loop-5 data-fetching through the `defendService` seam, scoped to
 * the active avatar (`AvatarContext`). Exposes the per-section state the Defend
 * screens render — the Signature-drift watch + the derived defend checklist —
 * plus the workbook-export action and its in-flight/result state.
 *
 * WHY: Pages on /v4 are thin wiring shells (see src/pages/AGENTS.md) — the
 * orchestration (read status, hold the export result) belongs in a hook so
 * V4Defend only wires data + handlers to the presentational screens and owns the
 * spine CTA. Modeled on useRemeasureRun / useFixRun.
 *
 * NO FABRICATION: every value comes from `defendService`, which degrades to
 * needs_input (no avatar) / error rather than inventing drift, a checklist state,
 * or a workbook download. The competitor row is honestly "coming"; the export
 * surfaces the engine's real note/error, never a fake link.
 */
import { useCallback, useMemo, useState } from 'react';
import { DefendService } from '@/services/v4/defendService';
import { useAvatarContext } from '@/contexts/AvatarContext';
import type { DefendResult, DefendStatus, WorkbookExport } from '@/types/v4Defend';

/** Fold a non-ok DefendResult into a single honest message for the screens. */
function messageFor(result: DefendResult<unknown>): string {
  if (result.status === 'error') return result.error;
  if (result.status === 'needs_input') {
    return result.needs_input[0]?.question ?? 'I need a little more context first.';
  }
  return 'Something went wrong.';
}

export interface DefendRunHook {
  /** True when an avatar is selected to scope the defend to (page-level gate). */
  hasAvatar: boolean;
  /** The active avatar id (null when none) — lets the page reload on a switch. */
  avatarId: string | null;

  // ── Status (drift watch + checklist) ──
  status: DefendStatus | null;
  statusLoading: boolean;
  statusError: string | null;

  // ── Workbook export ──
  exporting: boolean;
  exportResult: WorkbookExport | null;
  exportError: string | null;

  load: () => Promise<void>;
  exportWorkbook: () => Promise<void>;
}

export function useDefendRun(): DefendRunHook {
  const { selectedAvatarId } = useAvatarContext();
  const service = useMemo(() => new DefendService(), []);

  const [status, setStatus] = useState<DefendStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<WorkbookExport | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasAvatar = Boolean(selectedAvatarId);

  const load = useCallback(async (): Promise<void> => {
    if (!selectedAvatarId) return;
    setStatusLoading(true);
    setStatusError(null);
    const res = await service.getStatus(selectedAvatarId);
    if (res.status === 'ok') setStatus(res.data);
    else {
      setStatus(null);
      setStatusError(messageFor(res));
    }
    setStatusLoading(false);
  }, [service, selectedAvatarId]);

  const exportWorkbook = useCallback(async (): Promise<void> => {
    if (!selectedAvatarId) return;
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    const res = await service.exportWorkbook(selectedAvatarId);
    if (res.status === 'ok') setExportResult(res.data);
    else setExportError(messageFor(res));
    setExporting(false);
  }, [service, selectedAvatarId]);

  return {
    hasAvatar,
    avatarId: selectedAvatarId,
    status,
    statusLoading,
    statusError,
    exporting,
    exportResult,
    exportError,
    load,
    exportWorkbook,
  };
}
