/**
 * useCanvaConnection — react-query state + mutations for the Canva integration.
 *
 * Owns the connection status query (`['canva','status']`) plus imperative
 * helpers for connecting, disconnecting, listing live designs, and managing
 * imports. All work is delegated to `canvaService` (which talks to the
 * `canva-*` edge functions). Errors are surfaced with a `console.error` (for
 * debugging) plus a non-technical `sonner` toast.
 */

import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { canvaService } from '@/services/canva/canvaService';
import type { CanvaDesign, CanvaStatus, CanvaSyncResponse, ImportedDesign } from '@/services/canva/types';

export const CANVA_STATUS_QUERY_KEY = ['canva', 'status'] as const;

/** Log + toast a Canva failure with a friendly fallback message. */
function reportError(context: string, error: unknown, friendly: string): void {
  console.error(`[Canva] ${context}:`, error);
  toast.error(friendly);
}

export interface UseCanvaConnection {
  /** Latest connection status, or undefined before the first load. */
  status: CanvaStatus | undefined;
  /** True while the status query is loading. */
  isLoading: boolean;
  /** Convenience flag derived from `status.connected`. */
  isConnected: boolean;

  /** True while the authorize URL is being minted / redirecting. */
  isConnecting: boolean;
  /** Start the OAuth flow and redirect the browser to Canva. */
  connect: (returnPath?: string) => Promise<void>;
  /** True while disconnecting. */
  isDisconnecting: boolean;
  /** Disconnect the Canva account. */
  disconnect: () => Promise<void>;

  /** Live designs loaded from Canva (empty until `loadDesigns` runs). */
  designs: CanvaDesign[];
  /** True while designs are loading. */
  isLoadingDesigns: boolean;
  /** Pagination cursor for the next page of designs, if any. */
  designsContinuation: string | undefined;
  /** Fetch a page of live designs (pass a continuation to page). */
  loadDesigns: (continuation?: string) => Promise<void>;

  /** Designs imported into the Brand Coach. */
  imports: ImportedDesign[];
  /** True while imports are loading. */
  isLoadingImports: boolean;
  /** Fetch the imported-designs list. */
  loadImports: () => Promise<void>;
  /** Import a live design; updates local imports on success. */
  importDesign: (design: CanvaDesign) => Promise<void>;
  /** Set of canva design ids currently being imported (for per-card spinners). */
  importingIds: ReadonlySet<string>;
  /** Remove an imported design by its canva design id. */
  removeImport: (canvaDesignId: string) => Promise<void>;

  /** Latest Brand Coach context-sync result (after an explicit sync), or null. */
  coachContext: CanvaSyncResponse | null;
  /** True while syncing the imported designs into the coach context. */
  isSyncing: boolean;
  /** Re-summarize the imported designs into the Brand Coach context. */
  syncToCoach: () => Promise<void>;
}

export function useCanvaConnection(): UseCanvaConnection {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery<CanvaStatus>({
    queryKey: CANVA_STATUS_QUERY_KEY,
    queryFn: () => canvaService.getStatus(),
    // Status is only meaningful for an authenticated user.
    enabled: !!user,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [designs, setDesigns] = useState<CanvaDesign[]>([]);
  const [designsContinuation, setDesignsContinuation] = useState<string | undefined>(undefined);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(false);

  const [imports, setImports] = useState<ImportedDesign[]>([]);
  const [isLoadingImports, setIsLoadingImports] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  const [coachContext, setCoachContext] = useState<CanvaSyncResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const connect = useCallback(async (returnPath?: string): Promise<void> => {
    setIsConnecting(true);
    try {
      const { url } = await canvaService.startConnect(returnPath);
      window.location.assign(url);
      // No state reset on success — the browser is navigating away.
    } catch (error) {
      reportError('startConnect', error, "We couldn't start the Canva connection. Please try again.");
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsDisconnecting(true);
    try {
      await canvaService.disconnect();
      await queryClient.invalidateQueries({ queryKey: CANVA_STATUS_QUERY_KEY });
      setDesigns([]);
      setDesignsContinuation(undefined);
      setImports([]);
      toast.success('Canva disconnected.');
    } catch (error) {
      reportError('disconnect', error, "We couldn't disconnect Canva. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  }, [queryClient]);

  const loadDesigns = useCallback(async (continuation?: string): Promise<void> => {
    setIsLoadingDesigns(true);
    try {
      const res = await canvaService.listDesigns(continuation);
      // Append when paging, replace on a fresh load.
      setDesigns((prev) => (continuation ? [...prev, ...res.designs] : res.designs));
      setDesignsContinuation(res.continuation);
    } catch (error) {
      reportError('listDesigns', error, "We couldn't load your Canva designs. Please try again.");
    } finally {
      setIsLoadingDesigns(false);
    }
  }, []);

  const loadImports = useCallback(async (): Promise<void> => {
    setIsLoadingImports(true);
    try {
      const result = await canvaService.listImports();
      setImports(result);
    } catch (error) {
      reportError('listImports', error, "We couldn't load your imported designs. Please try again.");
    } finally {
      setIsLoadingImports(false);
    }
  }, []);

  const importDesign = useCallback(async (design: CanvaDesign): Promise<void> => {
    setImportingIds((prev) => new Set(prev).add(design.id));
    try {
      const imported = await canvaService.addImport({
        id: design.id,
        title: design.title,
        thumbnailUrl: design.thumbnailUrl,
        editUrl: design.editUrl,
        viewUrl: design.viewUrl,
      });
      // De-dupe by canva design id in case the same design is imported twice.
      setImports((prev) => [
        imported,
        ...prev.filter((d) => d.canvaDesignId !== imported.canvaDesignId),
      ]);
      toast.success('Design added to Brand Coach.');
    } catch (error) {
      reportError('addImport', error, "We couldn't add that design. Please try again.");
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(design.id);
        return next;
      });
    }
  }, []);

  const removeImport = useCallback(async (canvaDesignId: string): Promise<void> => {
    setImportingIds((prev) => new Set(prev).add(canvaDesignId));
    try {
      await canvaService.removeImport(canvaDesignId);
      setImports((prev) => prev.filter((d) => d.canvaDesignId !== canvaDesignId));
      toast.success('Design removed.');
    } catch (error) {
      reportError('removeImport', error, "We couldn't remove that design. Please try again.");
    } finally {
      setImportingIds((prev) => {
        const next = new Set(prev);
        next.delete(canvaDesignId);
        return next;
      });
    }
  }, []);

  const syncToCoach = useCallback(async (): Promise<void> => {
    setIsSyncing(true);
    try {
      const result = await canvaService.syncToCoach();
      setCoachContext(result);
      if (result.coachUpdated) {
        toast.success(
          result.count > 0
            ? `Synced ${result.count} design${result.count === 1 ? '' : 's'} into your Brand Coach.`
            : 'Brand Coach context cleared.',
        );
      } else {
        toast.error("We couldn't update your Brand Coach context. Please try again.");
      }
    } catch (error) {
      reportError('syncToCoach', error, "We couldn't sync your designs to the Brand Coach. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isConnected: !!statusQuery.data?.connected,
    isConnecting,
    connect,
    isDisconnecting,
    disconnect,
    designs,
    isLoadingDesigns,
    designsContinuation,
    loadDesigns,
    imports,
    isLoadingImports,
    loadImports,
    importDesign,
    importingIds,
    removeImport,
    coachContext,
    isSyncing,
    syncToCoach,
  };
}
