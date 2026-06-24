import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseAvatarService } from '@/services/SupabaseAvatarService';

interface UseDefaultAvatarProps {
  user: User | null;
  /** Current avatar list (only `.length` is read). */
  avatars: unknown[];
  isLoadingAvatars: boolean;
  /** Re-fetch the avatar list after a default is created, to sync in-memory state. */
  refreshAvatars: () => Promise<void>;
}

/**
 * Ensures the user has at least one avatar, creating a single "Default Avatar" when they
 * have none.
 *
 * Why the gating matters: the avatar list loads asynchronously and starts empty, so acting
 * on the initial `avatars.length === 0` race-created duplicate "Default Avatar" rows on every
 * mount. This hook only acts once a load has actually completed (an observed loading
 * true -> false transition), so it sees the *confirmed* list, and it delegates to the
 * idempotent `getOrCreateDefaultAvatar` (which also tolerates the residual multi-tab race via
 * the (user_id, name) unique index). Creation is therefore at-most-once per user.
 */
export function useDefaultAvatar({
  user,
  avatars,
  isLoadingAvatars,
  refreshAvatars,
}: UseDefaultAvatarProps): void {
  const hasLoadedOnce = useRef(false);
  const prevLoading = useRef(isLoadingAvatars);
  const isCreating = useRef(false);

  // Record that at least one avatar load has completed (loading true -> false).
  useEffect(() => {
    if (prevLoading.current && !isLoadingAvatars) {
      hasLoadedOnce.current = true;
    }
    prevLoading.current = isLoadingAvatars;
  }, [isLoadingAvatars]);

  useEffect(() => {
    if (!user?.id) return;
    if (!hasLoadedOnce.current) return; // only act on a confirmed-empty list, never the initial empty state
    if (isLoadingAvatars) return;
    if (avatars.length > 0) return;
    if (isCreating.current) return;

    let cancelled = false;

    const ensureDefaultAvatar = async () => {
      isCreating.current = true;
      try {
        const avatarService = new SupabaseAvatarService(supabase);
        await avatarService.getOrCreateDefaultAvatar();
        if (!cancelled) {
          await refreshAvatars();
        }
      } catch (error) {
        console.error('Error ensuring default avatar:', error);
      } finally {
        isCreating.current = false;
      }
    };

    ensureDefaultAvatar();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isLoadingAvatars, avatars.length, refreshAvatars]);
}
