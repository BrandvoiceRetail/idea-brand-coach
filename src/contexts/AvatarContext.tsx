/**
 * AvatarContext — THE single canonical avatar store + switch path.
 *
 * Multi-Avatar design §2.2 / §4.1. This context is the ONE place the "current
 * coach avatar" lives and the ONE code path every caller (V2 dropdown, V1 tabs,
 * agent set_current_avatar, onboarding, delete-fallback) funnels through. The
 * legacy `useAvatarService` event store (its localStorage key + window event)
 * is collapsed into this; those hooks now delegate here.
 *
 * setCurrentAvatar contract (the bleed firewall in motion):
 *   1. idempotent — no-op if already current
 *   2. optimistic local set + localStorage mirror (instant UI)
 *   3. set_current_avatar RPC (ownership-checked server pointer)
 *   4. ensureSessionForAvatar (thread anchor — the retrieval source of truth)
 *   5. invalidate every ['avatar', …] react-query cache (design §2.2)
 *   6. rollback local + localStorage + toast on RPC failure
 *
 * Startup priority (design §4.1): server pointer (valid) → stored localStorage
 * → auto-select first NON-TEMPLATE avatar.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAvatars } from '@/hooks/useAvatars';
import { useServices } from '@/services/ServiceProvider';
import { useAuth } from '@/hooks/useAuth';
import { AVATAR_KEY_PREFIX } from '@/lib/queryKeys';
import { Avatar } from '@/types/avatar';

/**
 * Session-follows-avatar contract (design §4.1). The chat service stamps
 * `chat_sessions.avatar_id` and exposes `ensureSessionForAvatar`; the switch
 * path defaults to that (resolved from `useServices`). Still accepted as an
 * injectable prop so tests can stub it and the context never hard-couples to
 * the chat service construction.
 */
export type EnsureSessionForAvatar = (avatarId: string) => Promise<void>;

interface AvatarContextValue {
  /** Currently selected avatar ID */
  selectedAvatarId: string | null;
  /**
   * THE single switch path. Re-scopes the whole app to `avatarId`:
   * optimistic local → RPC → session ensure → invalidate → rollback on failure.
   */
  setCurrentAvatar: (avatarId: string) => Promise<void>;
  /**
   * Delete-current fallback (design §4.1). Repoint to the given fallback (e.g.
   * the brand's primary avatar) or clear to null when the last avatar is gone.
   */
  clearCurrentAvatar: (fallbackAvatarId: string | null) => Promise<void>;
  /** The currently selected avatar object (derived from avatars list) */
  currentAvatar: Avatar | null;
  /** All avatars from useAvatars hook */
  avatars: Avatar[] | undefined;
  /** Loading state from useAvatars hook */
  isLoadingAvatars: boolean;
}

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

interface AvatarProviderProps {
  children: ReactNode;
  /**
   * Session-follows-avatar hook (design §4.1). Defaults to the chat service's
   * `ensureSessionForAvatar` (resolved from `useServices`). Override to stub it
   * in tests.
   */
  ensureSessionForAvatar?: EnsureSessionForAvatar;
}

const SELECTED_AVATAR_STORAGE_KEY = 'idea-selected-avatar-id';

function readStoredAvatarId(): string | null {
  try {
    return localStorage.getItem(SELECTED_AVATAR_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredAvatarId(avatarId: string | null): void {
  try {
    if (avatarId) localStorage.setItem(SELECTED_AVATAR_STORAGE_KEY, avatarId);
    else localStorage.removeItem(SELECTED_AVATAR_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to persist selected avatar ID:', error);
  }
}

export function AvatarProvider({ children, ensureSessionForAvatar }: AvatarProviderProps): JSX.Element {
  const { avatars, isLoading: isLoadingAvatars } = useAvatars();
  const { user } = useAuth();
  const { userProfileService, chatService } = useServices();
  const queryClient = useQueryClient();

  // Session-follows-avatar (design §4.1): default to the chat service's thread
  // ensure; an explicit prop (tests) overrides it.
  const ensureSession = useCallback<EnsureSessionForAvatar>(
    async (avatarId: string) => {
      if (ensureSessionForAvatar) {
        await ensureSessionForAvatar(avatarId);
        return;
      }
      await chatService.ensureSessionForAvatar(avatarId);
    },
    [ensureSessionForAvatar, chatService],
  );

  // Canonical current-avatar state, seeded from localStorage for instant paint.
  const [selectedAvatarId, setSelectedAvatarIdState] = useState<string | null>(readStoredAvatarId);

  // Startup resolution is STATE (not a ref) so flipping it re-runs the
  // auto-select effect — a ref flip schedules no render, which could strand the
  // app with no avatar selected if the avatars list arrived before the server
  // pointer resolved (correctness review). `startupResolvedRef` mirrors it for
  // the once-only guard inside the async startup effect.
  const [startupResolved, setStartupResolved] = useState(false);
  const startupResolvedRef = useRef(false);

  // Monotonic switch token: each setCurrentAvatar call captures the latest
  // requested target so interleaved rapid switches (A→B→C) can bail if they are
  // no longer the in-flight target, and rollback only reverts the active switch.
  const switchTokenRef = useRef(0);

  // Keep localStorage mirror in sync with canonical state.
  useEffect(() => {
    writeStoredAvatarId(selectedAvatarId);
  }, [selectedAvatarId]);

  // ── Startup priority: server pointer → stored localStorage → first non-template.
  // Runs once we have a user (server pointer is the authoritative default).
  useEffect(() => {
    if (startupResolvedRef.current || !user) return;
    let cancelled = false;

    const markResolved = (): void => {
      startupResolvedRef.current = true;
      setStartupResolved(true);
    };

    (async () => {
      // Read the server pointer through the service layer (mirrors the write
      // path setCurrentAvatarRPC) rather than a raw PostgREST query.
      const serverPointer = await userProfileService.getCurrentAvatarId();
      if (cancelled) return;

      markResolved();

      // Server pointer wins when present (the UI default mirror).
      if (serverPointer) {
        setSelectedAvatarIdState(serverPointer);
        return;
      }
      // Otherwise honor an existing stored selection; auto-select happens in the
      // avatars-loaded effect below only when neither pointer nor selection exist.
    })().catch((error) => {
      // Non-fatal — fall back to stored/auto-select. Don't block the UI.
      console.warn('[AvatarContext] Failed to read server avatar pointer:', error);
      if (!cancelled) markResolved();
    });

    return () => {
      cancelled = true;
    };
  }, [user, userProfileService]);

  // Auto-select first NON-TEMPLATE avatar only when no server pointer and no
  // stored selection resolved (design §4.1 auto-select gate). Depends on
  // `startupResolved` STATE so flipping resolution re-runs this effect even when
  // the avatars list was already loaded and stable.
  useEffect(() => {
    if (!startupResolved) return;
    if (selectedAvatarId || !avatars || avatars.length === 0) return;
    const firstReal = avatars.find((a) => !a.is_template) ?? avatars[0];
    if (firstReal) setSelectedAvatarIdState(firstReal.id);
  }, [startupResolved, selectedAvatarId, avatars]);

  // Clear selection if the selected avatar no longer exists in the list.
  useEffect(() => {
    if (selectedAvatarId && avatars && !avatars.some((a) => a.id === selectedAvatarId)) {
      setSelectedAvatarIdState(null);
    }
  }, [selectedAvatarId, avatars]);

  const currentAvatar = selectedAvatarId && avatars
    ? avatars.find((a) => a.id === selectedAvatarId) || null
    : null;

  // ── THE single switch path (design §2.2). ───────────────────────────────
  const setCurrentAvatar = useCallback(async (avatarId: string): Promise<void> => {
    if (avatarId === selectedAvatarId) return; // idempotent

    const prev = selectedAvatarId;
    // Claim this switch as the latest in-flight target. Rapid A→B→C switches each
    // bump the token; a slower call that resolves out of order checks this before
    // committing/rolling back so it cannot clobber a newer target's state.
    const token = ++switchTokenRef.current;
    const isStale = (): boolean => switchTokenRef.current !== token;

    // Optimistic local set + cache mirror for instant UI.
    setSelectedAvatarIdState(avatarId);
    writeStoredAvatarId(avatarId);

    try {
      // Ownership-checked server pointer (the UI default mirror).
      await userProfileService.setCurrentAvatarRPC(avatarId);
      // Thread anchor — retrieval scopes on the conversation's avatar (design §2.1).
      await ensureSession(avatarId);
      // A newer switch superseded us mid-flight — let it own the final state.
      if (isStale()) return;
      // Nuke every per-avatar react-query cache so no stale avatar data bleeds in.
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === AVATAR_KEY_PREFIX,
      });
    } catch (error) {
      console.error('[AvatarContext] setCurrentAvatar failed:', error);
      // Only roll back if we're still the active switch — a newer switch may have
      // already moved local state to a different (valid) target.
      if (isStale()) return;
      setSelectedAvatarIdState(prev);
      writeStoredAvatarId(prev);
      toast.error('Could not switch avatar');
    }
  }, [selectedAvatarId, userProfileService, ensureSession, queryClient]);

  // ── Delete-current fallback (design §4.1). ───────────────────────────────
  const clearCurrentAvatar = useCallback(async (fallbackAvatarId: string | null): Promise<void> => {
    if (fallbackAvatarId) {
      await setCurrentAvatar(fallbackAvatarId);
      return;
    }
    // Last avatar deleted: clear local pointer + caches. No RPC nulls the server
    // pointer here — `profiles.current_avatar_id` is ON DELETE SET NULL, so the
    // pointer self-clears WHEN the avatar row is deleted.
    // CONTRACT (P4b delete UX): callers MUST delete the avatar row before (or
    // atomically with) calling clearCurrentAvatar(null). If invoked while the row
    // still exists, the server pointer keeps pointing at it and startup would
    // re-select the "deleted" avatar. P4b's deleteAvatar owns that ordering.
    setSelectedAvatarIdState(null);
    writeStoredAvatarId(null);
    await queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === AVATAR_KEY_PREFIX,
    });
  }, [setCurrentAvatar, queryClient]);

  return (
    <AvatarContext.Provider
      value={{
        selectedAvatarId,
        setCurrentAvatar,
        clearCurrentAvatar,
        currentAvatar,
        avatars,
        isLoadingAvatars,
      }}
    >
      {children}
    </AvatarContext.Provider>
  );
}

/**
 * Hook to access Avatar context
 * Must be used within an AvatarProvider
 */
export function useAvatarContext(): AvatarContextValue {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error('useAvatarContext must be used within an AvatarProvider');
  }
  return context;
}
