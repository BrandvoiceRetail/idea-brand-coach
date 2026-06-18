/**
 * useAvatarDiagnosticCompare — Diagnostic BOTH (locked #5).
 *
 * Reads two scopes of the authenticated user's latest diagnostic in parallel:
 *   - the brand BASELINE (avatar_id NULL), and
 *   - the OVERLAY for the given avatar (avatar_id = avatarId), when an avatar is current.
 *
 * Both queries live under the avatar-scoped query-key namespace (the bleed
 * firewall, src/lib/queryKeys.ts), so the single switch path invalidates them on
 * an avatar switch and a stale overlay can never bleed across avatars.
 *
 * The page chooses what to render: the overlay when present (with the baseline as
 * the delta reference), else the baseline alone.
 */

import { useQuery } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { avatarDiagnosticKey } from '@/lib/queryKeys';
import type { DiagnosticSubmission } from '@/types/diagnostic';

export interface AvatarDiagnosticCompare {
  /** Latest brand-baseline submission (avatar_id NULL), or null. */
  baseline: DiagnosticSubmission | null | undefined;
  /** Latest overlay submission for the current avatar, or null (also null when no avatar). */
  overlay: DiagnosticSubmission | null | undefined;
  isLoading: boolean;
}

export function useAvatarDiagnosticCompare(
  avatarId: string | null | undefined,
  enabled = true,
): AvatarDiagnosticCompare {
  const { diagnosticService } = useServices();

  const baselineQuery = useQuery({
    queryKey: avatarDiagnosticKey(undefined, 'baseline'),
    queryFn: () => diagnosticService.getLatestDiagnostic(null),
    enabled,
    retry: 1,
  });

  const overlayQuery = useQuery({
    queryKey: avatarDiagnosticKey(avatarId ?? undefined, 'overlay'),
    queryFn: () => diagnosticService.getLatestDiagnostic(avatarId as string),
    // Only fetch an overlay when an avatar is actually current.
    enabled: enabled && !!avatarId,
    retry: 1,
  });

  return {
    baseline: baselineQuery.data,
    overlay: avatarId ? overlayQuery.data : null,
    isLoading: baselineQuery.isLoading || (!!avatarId && overlayQuery.isLoading),
  };
}
