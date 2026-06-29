/**
 * useSpineCompletion — derives REAL completion for each /v4 spine stage from
 * durable artifacts, so the SpineStepper's checkmarks reflect work actually done
 * rather than which route the user happens to be on.
 *
 * WHY: the stepper previously marked a stage "done" purely from route position
 * (`i < activeIndex`), so ticks appeared without the work and vanished on the
 * onboarding root (where no stage is active). This hook reads the persisted
 * artifacts instead. It is mounted by V4Layout (a persistent parent route that
 * does not remount on child navigation), so its react-query reads run once per
 * /v4 session and are cached — navigation can no longer flip completion.
 *
 * NO FABRICATION: every flag is false until its real artifact is observed; an
 * un-derivable stage stays unchecked (honest empty state) rather than guessing.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { listTests } from '@/services/v4/fixService';
import type { SpineStage } from '@/config/v4';

/** Real completion per spine stage key. */
export type SpineCompletion = Record<SpineStage['key'], boolean>;

export function useSpineCompletion(): SpineCompletion {
  const { diagnosticService } = useServices();
  const { selectedAvatarId, avatars } = useAvatarContext();

  // Diagnose ⇔ a persisted Trust Gap exists. Same query key as V4Diagnose so the
  // read is shared/deduped rather than fetched twice.
  const { data: latestDiagnostic } = useQuery({
    queryKey: ['v4-diagnose-existing', selectedAvatarId ?? 'any'],
    queryFn: () => diagnosticService.getLatestDiagnostic(selectedAvatarId ?? undefined),
    retry: 1,
    staleTime: 30_000,
  });
  const hasTrustGap = typeof latestDiagnostic?.scores?.overall === 'number';

  // Analyse ⇔ a real (non-template) customer avatar exists AND a Trust Gap exists.
  // The Decision Trigger is derived from the Trust Gap, so both must be present
  // for Analyse's deliverable (avatar + trigger) to actually exist.
  const hasRealAvatar = (avatars ?? []).some((a) => !a.is_template);
  const analyseDone = hasRealAvatar && hasTrustGap;

  // Fix ⇔ at least one test has been opened against this avatar's funnel.
  const { data: testsResult } = useQuery({
    queryKey: ['v4-spine-tests', selectedAvatarId],
    queryFn: () => listTests(selectedAvatarId),
    enabled: Boolean(selectedAvatarId),
    retry: 1,
    staleTime: 30_000,
  });
  const fixDone = testsResult?.status === 'ok' && testsResult.data.length > 0;

  return useMemo<SpineCompletion>(
    () => ({
      diagnose: hasTrustGap,
      analyse: analyseDone,
      fix: fixDone,
      // Re-measure / Defend have no durable client-readable artifact yet — stay
      // honestly unchecked rather than fabricating completion.
      remeasure: false,
      defend: false,
    }),
    [hasTrustGap, analyseDone, fixDone],
  );
}
