/**
 * useForensicAvatarBuild — drives the SPA forensic-build stepper (§4.2).
 *
 * Owns the run state for one avatar's S1→S4 forensic build against
 * ForensicBuildService (which calls the deployed edge fns directly, NOT /mcp).
 * Reads (build-state + persisted stage artifacts) live under the avatar-scoped
 * react-query namespace (`avatarScopedKey`) so the single switch-invalidation
 * predicate nukes them on an avatar switch (the bleed firewall, queryKeys.ts).
 *
 * Stage order mirrors avatarPipeline: s1 → s2 → {s3, s4} (s3/s4 run in parallel
 * after s2). A stage that returns needs_input stops the run and surfaces the
 * grounding demand; a failure stops and surfaces the error. On a full S1→S4
 * pass the build state is recorded as 'built'; approve stamps 'approved'.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { avatarScopedKey } from '@/lib/queryKeys';
import { ForensicBuildService } from '@/services/ForensicBuildService';
import {
  FORENSIC_STAGES,
  type ForensicStage,
  type StageRunResult,
  type StageArtifact,
  type NeedsInputItem,
} from '@/types/forensicBuild';

/** Per-stage progress as the run advances. */
export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'needs_input';

export interface ForensicBuildHook {
  /** Per-stage run status (for the progress UI). */
  stageStatus: Record<ForensicStage, StageStatus>;
  /** True while the S1→S4 chain is in flight. */
  isRunning: boolean;
  /** The needs_input demand when a stage stopped on missing grounding. */
  needsInput: NeedsInputItem[] | null;
  /** The error note when a stage failed. */
  runError: string | null;
  /** Persisted current artifacts per stage (the read-only review). */
  artifacts: Partial<Record<ForensicStage, StageArtifact['content']>>;
  /** Build-state status ('draft' | 'built' | 'approved') or null when not started. */
  buildStatus: 'draft' | 'built' | 'approved' | null;
  isLoadingState: boolean;
  /** Run the full S1→S4 chain with the supplied verbatim reviews. */
  runBuild: (reviews: string) => Promise<void>;
  /** Approve the built avatar (stamps avatar_build_state.status='approved'). */
  approve: () => Promise<void>;
}

const PENDING_STATUS: Record<ForensicStage, StageStatus> = {
  s1: 'pending', s2: 'pending', s3: 'pending', s4: 'pending',
};

export function useForensicAvatarBuild(avatarId: string | null): ForensicBuildHook {
  const queryClient = useQueryClient();
  const service = useMemo(() => new ForensicBuildService(), []);

  const [stageStatus, setStageStatus] = useState<Record<ForensicStage, StageStatus>>(PENDING_STATUS);
  const [isRunning, setIsRunning] = useState(false);
  const [needsInput, setNeedsInput] = useState<NeedsInputItem[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // ── Build-state read (avatar-scoped; bleed firewall) ──────────────────────
  const { data: buildState, isLoading: isLoadingState } = useQuery({
    queryKey: avatarScopedKey('artifacts', avatarId ?? 'brand', 'build-state'),
    queryFn: () => (avatarId ? service.getBuildState(avatarId) : Promise.resolve(null)),
    enabled: !!avatarId,
  });

  // ── Persisted artifacts read (avatar-scoped; the read-only review) ────────
  const { data: artifacts = {} } = useQuery({
    queryKey: avatarScopedKey('artifacts', avatarId ?? 'brand', 'forensic-stages'),
    queryFn: async () => {
      if (!avatarId) return {};
      const entries = await Promise.all(
        FORENSIC_STAGES.map(async (s) => [s, await service.getStageArtifact(s, avatarId)] as const),
      );
      return Object.fromEntries(entries.filter(([, c]) => c != null));
    },
    enabled: !!avatarId,
  });

  const invalidateScoped = useCallback(() => {
    if (!avatarId) return;
    void queryClient.invalidateQueries({ queryKey: avatarScopedKey('artifacts', avatarId) });
  }, [queryClient, avatarId]);

  const runBuild = useCallback(async (reviews: string): Promise<void> => {
    if (!avatarId) return;
    setIsRunning(true);
    setNeedsInput(null);
    setRunError(null);
    setStageStatus({ ...PENDING_STATUS });

    const setStatus = (stage: ForensicStage, status: StageStatus): void =>
      setStageStatus((prev) => ({ ...prev, [stage]: status }));

    // Mark a stage's own progress, but DON'T surface the run-level reason yet —
    // when stages run in parallel we must choose ONE reason deterministically
    // (see surfaceStop) rather than let the last setState win.
    const markStop = (r: StageRunResult): boolean => {
      if (r.status === 'needs_input') {
        setStatus(r.stage, 'needs_input');
        return true;
      }
      if (r.status === 'failed') {
        setStatus(r.stage, 'failed');
        return true;
      }
      setStatus(r.stage, 'done');
      return false;
    };

    // Surface a single run-level reason. A hard `failed` takes precedence over a
    // recoverable `needs_input` so the user sees the more actionable blocker
    // first; ties within a kind resolve to the earliest stage.
    const surfaceStop = (results: readonly StageRunResult[]): void => {
      const failed = results.find((r) => r.status === 'failed');
      if (failed && failed.status === 'failed') {
        setRunError(failed.error);
        return;
      }
      const needs = results.find((r) => r.status === 'needs_input');
      if (needs && needs.status === 'needs_input') {
        setNeedsInput(needs.needs_input);
      }
    };

    try {
      // Sequential: s1 then s2 (each grounds the next).
      for (const stage of ['s1', 's2'] as const) {
        setStatus(stage, 'running');
        const r = await service.runStage(stage, avatarId, reviews);
        if (markStop(r)) {
          surfaceStop([r]);
          return;
        }
      }
      // Parallel: s3 and s4 (both depend only on s1/s2).
      setStatus('s3', 'running');
      setStatus('s4', 'running');
      const parallel = await Promise.all([
        service.runStage('s3', avatarId, reviews),
        service.runStage('s4', avatarId, reviews),
      ]);
      const stopped = parallel.map(markStop).some(Boolean);
      if (stopped) {
        surfaceStop(parallel);
        return;
      }

      await service.recordBuildState(avatarId, [...FORENSIC_STAGES], 'built');
      toast.success('Forensic build complete');
    } catch (error) {
      console.error('[useForensicAvatarBuild] runBuild failed:', error);
      setRunError(error instanceof Error ? error.message : 'Build failed');
      toast.error('Forensic build failed');
    } finally {
      setIsRunning(false);
      invalidateScoped();
    }
  }, [avatarId, service, invalidateScoped]);

  const approve = useCallback(async (): Promise<void> => {
    if (!avatarId) return;
    try {
      await service.recordBuildState(avatarId, [...FORENSIC_STAGES], 'approved');
      invalidateScoped();
      toast.success('Avatar approved');
    } catch (error) {
      console.error('[useForensicAvatarBuild] approve failed:', error);
      toast.error('Could not approve avatar');
      throw error;
    }
  }, [avatarId, service, invalidateScoped]);

  return {
    stageStatus,
    isRunning,
    needsInput,
    runError,
    artifacts,
    buildStatus: buildState?.status ?? null,
    isLoadingState,
    runBuild,
    approve,
  };
}
