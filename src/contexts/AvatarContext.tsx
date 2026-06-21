/**
 * AvatarContext — THE single canonical avatar store + switch path.
 *
 * Multi-Avatar design §2.2 / §4.1 (set model). This context is the ONE place the
 * active context avatar SET lives and the ONE code path every caller (V2
 * dropdown, V1 tabs, agent set_context_avatars, onboarding, delete-fallback)
 * funnels through. The active set is `contextAvatarIds`; the FOCUS avatar
 * (`selectedAvatarId` / `currentAvatar` = `contextAvatarIds[0]`) is kept for
 * single-target ops + back-compat. The legacy `useAvatarService` event store
 * (its localStorage key + window event) is collapsed into this.
 *
 * setContextAvatars contract (the bleed firewall in motion):
 *   1. idempotent — no-op when the sorted set is unchanged
 *   2. optimistic local set + localStorage mirror (instant UI)
 *   3. set_context_avatars RPC (ownership-checked profile-default set)
 *   4. ensureSessionForContext (thread anchor — the retrieval source of truth)
 *   5. invalidate every ['avatar', …] react-query cache (design §2.2)
 *   6. rollback local + localStorage + toast on RPC failure
 *
 * `setCurrentAvatar(id)` is a thin single-id shim = `setContextAvatars([id])`.
 *
 * Startup priority (design §4.1, set model): profile-default set
 * (`profiles.context_avatar_ids`) → stored localStorage array →
 * `[current_avatar_id]` seed / auto-select first NON-TEMPLATE avatar.
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
 * Session-follows-context contract (design §4.1, set model). The chat service
 * stamps `chat_sessions.context_avatar_ids` and exposes a thread-ensure; the
 * switch path defaults to anchoring on the FOCUS avatar (`ids[0]`) via
 * `chatService.ensureSessionForAvatar` (resolved from `useServices`). Accepted
 * as an injectable prop so tests can stub it (and provide a fully set-aware
 * ensure) and the context never hard-couples to the chat service construction.
 */
export type EnsureSessionForContext = (avatarIds: string[]) => Promise<void>;

interface AvatarContextValue {
  /** The active context avatar SET (the retrieval anchor; ids[0] is the focus). */
  contextAvatarIds: string[];
  /** The FOCUS avatar id (= contextAvatarIds[0]) — single-target ops + back-compat. */
  selectedAvatarId: string | null;
  /**
   * THE single switch path (set model). Re-scopes the whole app to `avatarIds`:
   * idempotent → optimistic local → RPC → session ensure → invalidate →
   * rollback on failure.
   */
  setContextAvatars: (avatarIds: string[]) => Promise<void>;
  /**
   * Add/remove a single avatar from the active set (multi-select toggle). Adding
   * appends; removing drops it. Removing the last member falls back to keeping
   * that member (the set never empties via toggle). Routes through
   * {@link setContextAvatars}.
   */
  toggleAvatarInContext: (avatarId: string) => Promise<void>;
  /**
   * Single-target switch shim = `setContextAvatars([avatarId])`. Kept for
   * back-compat with every single-avatar caller (V2 dropdown, agent, onboarding).
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

  // ── Canonical avatar CRUD (P4b §4.5). This context is the ONE store, so CRUD
  // funnels through here too — each op writes via the avatar service, refreshes
  // the brand-level avatar list, and (for delete-current) honors the
  // delete-row-then-clearCurrentAvatar contract so the server pointer can't
  // strand on a deleted row.
  /** Rename an avatar (display name only). */
  renameAvatar: (id: string, name: string) => Promise<void>;
  /** Duplicate an avatar (copies all persona data under a new unique name). */
  duplicateAvatar: (id: string) => Promise<Avatar | null>;
  /**
   * Delete an avatar. When deleting the CURRENT avatar, repoints to a fallback
   * (the brand's primary if present, else the first remaining non-template) AFTER
   * the row is deleted — the AvatarContext delete contract.
   */
  deleteAvatar: (id: string) => Promise<void>;
  /** Mark an avatar as the brand's primary (the star) via set_primary_avatar RPC. */
  setPrimaryAvatar: (id: string) => Promise<void>;
}

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

interface AvatarProviderProps {
  children: ReactNode;
  /**
   * Session-follows-context hook (design §4.1, set model). Defaults to the chat
   * service's `ensureSessionForAvatar` anchored on the focus avatar (`ids[0]`)
   * resolved from `useServices`. Override to stub it in tests (or to inject a
   * fully set-aware ensure).
   */
  ensureSessionForContext?: EnsureSessionForContext;
}

const CONTEXT_AVATAR_IDS_STORAGE_KEY = 'idea-context-avatar-ids';

/** Read the persisted context set (JSON array). Empty on any parse failure. */
function readStoredContextAvatarIds(): string[] {
  try {
    const raw = localStorage.getItem(CONTEXT_AVATAR_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function writeStoredContextAvatarIds(ids: string[]): void {
  try {
    if (ids.length > 0) {
      localStorage.setItem(CONTEXT_AVATAR_IDS_STORAGE_KEY, JSON.stringify(ids));
    } else {
      localStorage.removeItem(CONTEXT_AVATAR_IDS_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to persist context avatar IDs:', error);
  }
}

/** Order-insensitive equality for two avatar sets (dedupe → sort → compare). */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

export function AvatarProvider({ children, ensureSessionForContext }: AvatarProviderProps): JSX.Element {
  const { avatars, isLoading: isLoadingAvatars } = useAvatars();
  const { user } = useAuth();
  const { userProfileService, chatService, avatarService } = useServices();
  const queryClient = useQueryClient();

  // Refresh the brand-level avatar list (intentionally OUTSIDE the avatar-scoped
  // namespace — see queryKeys.ts). CRUD ops below call this after a write.
  const refreshAvatarList = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['avatars'] }),
    [queryClient],
  );

  // Session-follows-context (design §4.1, set model): anchor the thread on the
  // FULL set via the chat orchestrator's set-aware ensure, so switching to {A,B}
  // lands on the {A,B} conversation (the thread records `context_avatar_ids`),
  // not a focus-only thread. An explicit prop (tests) overrides the ensure.
  const ensureSession = useCallback<EnsureSessionForContext>(
    async (avatarIds: string[]) => {
      if (avatarIds.length === 0) return;
      if (ensureSessionForContext) {
        await ensureSessionForContext(avatarIds);
        return;
      }
      await chatService.ensureSessionForContext(avatarIds);
    },
    [ensureSessionForContext, chatService],
  );

  // Canonical active-set state, seeded from localStorage for instant paint.
  const [contextAvatarIds, setContextAvatarIdsState] = useState<string[]>(readStoredContextAvatarIds);
  // The FOCUS avatar (single-target ops + back-compat) = first set member.
  const selectedAvatarId = contextAvatarIds[0] ?? null;

  // Startup resolution is STATE (not a ref) so flipping it re-runs the
  // auto-select effect — a ref flip schedules no render, which could strand the
  // app with no avatar selected if the avatars list arrived before the profile
  // default resolved (correctness review). `startupResolvedRef` mirrors it for
  // the once-only guard inside the async startup effect.
  const [startupResolved, setStartupResolved] = useState(false);
  const startupResolvedRef = useRef(false);

  // Monotonic switch token: each setContextAvatars call captures the latest
  // requested target so interleaved rapid switches (A→B→C) can bail if they are
  // no longer the in-flight target, and rollback only reverts the active switch.
  const switchTokenRef = useRef(0);

  // Keep localStorage mirror in sync with canonical state.
  useEffect(() => {
    writeStoredContextAvatarIds(contextAvatarIds);
  }, [contextAvatarIds]);

  // ── Startup priority (set model): profile-default set → stored localStorage
  // → [current_avatar_id] seed → first non-template (auto-select effect below).
  // Runs once we have a user (the profile default is the authoritative source).
  useEffect(() => {
    if (startupResolvedRef.current || !user) return;
    let cancelled = false;

    const markResolved = (): void => {
      startupResolvedRef.current = true;
      setStartupResolved(true);
    };

    (async () => {
      // Read the profile-default SET through the service layer (mirrors the
      // write path setContextAvatarsRPC) rather than a raw PostgREST query.
      const profileSet = await userProfileService.getContextAvatarIds();
      if (cancelled) return;

      if (profileSet.length > 0) {
        markResolved();
        setContextAvatarIdsState(profileSet);
        return;
      }

      // No profile-default set: honor a stored localStorage set if one survived
      // a prior session (the optimistic mirror).
      const stored = readStoredContextAvatarIds();
      if (stored.length > 0) {
        markResolved();
        setContextAvatarIdsState(stored);
        return;
      }

      // Seed from the single-target current-avatar pointer when present
      // (single-active never shipped, so this is the legacy seed). Else fall
      // through to the avatars-loaded auto-select effect.
      const seed = await userProfileService.getCurrentAvatarId();
      if (cancelled) return;
      markResolved();
      if (seed) {
        setContextAvatarIdsState([seed]);
      }
    })().catch((error) => {
      // Non-fatal — fall back to stored/auto-select. Don't block the UI.
      console.warn('[AvatarContext] Failed to resolve startup avatar set:', error);
      if (!cancelled) markResolved();
    });

    return () => {
      cancelled = true;
    };
  }, [user, userProfileService]);

  // Auto-select first NON-TEMPLATE avatar only when nothing else resolved
  // (design §4.1 auto-select gate). Depends on `startupResolved` STATE so
  // flipping resolution re-runs this effect even when the avatars list was
  // already loaded and stable.
  useEffect(() => {
    if (!startupResolved) return;
    if (contextAvatarIds.length > 0 || !avatars || avatars.length === 0) return;
    const firstReal = avatars.find((a) => !a.is_template) ?? avatars[0];
    if (firstReal) setContextAvatarIdsState([firstReal.id]);
  }, [startupResolved, contextAvatarIds, avatars]);

  // Drop any set members that no longer exist in the avatars list (delete-member
  // reconciliation). If the set empties, fall back to the brand primary, else the
  // first remaining non-template, else clear.
  useEffect(() => {
    if (!avatars || contextAvatarIds.length === 0) return;
    const live = new Set(avatars.map((a) => a.id));
    const kept = contextAvatarIds.filter((id) => live.has(id));
    if (kept.length === contextAvatarIds.length) return; // nothing removed

    if (kept.length > 0) {
      setContextAvatarIdsState(kept);
      return;
    }
    const fallback = avatars.find((a) => a.is_primary) ?? avatars.find((a) => !a.is_template) ?? avatars[0] ?? null;
    setContextAvatarIdsState(fallback ? [fallback.id] : []);
  }, [contextAvatarIds, avatars]);

  const currentAvatar = selectedAvatarId && avatars
    ? avatars.find((a) => a.id === selectedAvatarId) || null
    : null;

  // ── THE single switch path (design §2.2, set model). ────────────────────
  const setContextAvatars = useCallback(async (avatarIds: string[]): Promise<void> => {
    const next = [...new Set(avatarIds)]; // dedupe; preserve caller order (focus = [0])
    if (next.length === 0) return; // never switch to an empty set
    if (sameSet(next, contextAvatarIds)) return; // idempotent

    const prev = contextAvatarIds;
    // Claim this switch as the latest in-flight target. Rapid A→B→C switches each
    // bump the token; a slower call that resolves out of order checks this before
    // committing/rolling back so it cannot clobber a newer target's state.
    const token = ++switchTokenRef.current;
    const isStale = (): boolean => switchTokenRef.current !== token;

    // Optimistic local set + cache mirror for instant UI.
    setContextAvatarIdsState(next);
    writeStoredContextAvatarIds(next);

    try {
      // Ownership-checked profile-default set (the retrieval anchor).
      await userProfileService.setContextAvatarsRPC(next);
      // Thread anchor — retrieval scopes on the conversation's set (design §2.1).
      await ensureSession(next);
      // A newer switch superseded us mid-flight — let it own the final state.
      if (isStale()) return;
      // Nuke every per-avatar react-query cache so no stale avatar data bleeds in.
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === AVATAR_KEY_PREFIX,
      });
    } catch (error) {
      console.error('[AvatarContext] setContextAvatars failed:', error);
      // Only roll back if we're still the active switch — a newer switch may have
      // already moved local state to a different (valid) target.
      if (isStale()) return;
      setContextAvatarIdsState(prev);
      writeStoredContextAvatarIds(prev);
      toast.error('Could not switch avatar');
    }
  }, [contextAvatarIds, userProfileService, ensureSession, queryClient]);

  // Single-target shim (back-compat): one avatar = the one-member set.
  const setCurrentAvatar = useCallback(
    (avatarId: string): Promise<void> => setContextAvatars([avatarId]),
    [setContextAvatars],
  );

  // Add/remove a single avatar from the active set (multi-select toggle).
  const toggleAvatarInContext = useCallback(async (avatarId: string): Promise<void> => {
    const isIn = contextAvatarIds.includes(avatarId);
    const next = isIn
      ? contextAvatarIds.filter((id) => id !== avatarId)
      : [...contextAvatarIds, avatarId];
    if (next.length === 0) return; // never empty the set via toggle
    await setContextAvatars(next);
  }, [contextAvatarIds, setContextAvatars]);

  // ── Delete-current fallback (design §4.1). ───────────────────────────────
  const clearCurrentAvatar = useCallback(async (fallbackAvatarId: string | null): Promise<void> => {
    if (fallbackAvatarId) {
      await setContextAvatars([fallbackAvatarId]);
      return;
    }
    // Last avatar deleted: clear local set + caches. No RPC nulls the server
    // pointer here — `profiles.current_avatar_id` is ON DELETE SET NULL and
    // `context_avatar_ids` members likewise self-clear WHEN the avatar row is
    // deleted.
    // CONTRACT (P4b delete UX): callers MUST delete the avatar row before (or
    // atomically with) calling clearCurrentAvatar(null). If invoked while the row
    // still exists, the server set keeps pointing at it and startup would
    // re-select the "deleted" avatar. P4b's deleteAvatar owns that ordering.
    setContextAvatarIdsState([]);
    writeStoredContextAvatarIds([]);
    await queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === AVATAR_KEY_PREFIX,
    });
  }, [setContextAvatars, queryClient]);

  // ── Canonical CRUD (P4b §4.5). ───────────────────────────────────────────
  const renameAvatar = useCallback(async (id: string, name: string): Promise<void> => {
    try {
      await avatarService.update(id, { name });
      await refreshAvatarList();
    } catch (error) {
      console.error('[AvatarContext] renameAvatar failed:', error);
      toast.error('Could not rename avatar');
      throw error;
    }
  }, [avatarService, refreshAvatarList]);

  const duplicateAvatar = useCallback(async (id: string): Promise<Avatar | null> => {
    try {
      const copy = await avatarService.duplicate(id);
      await refreshAvatarList();
      return copy;
    } catch (error) {
      console.error('[AvatarContext] duplicateAvatar failed:', error);
      toast.error('Could not duplicate avatar');
      throw error;
    }
  }, [avatarService, refreshAvatarList]);

  const deleteAvatar = useCallback(async (id: string): Promise<void> => {
    // Resolve the delete-current fallback BEFORE the row is gone: prefer the
    // brand's primary, else the first remaining non-template, else null.
    const isCurrent = id === selectedAvatarId;
    const remaining = (avatars ?? []).filter((a) => a.id !== id);
    const fallback = isCurrent
      ? (remaining.find((a) => a.is_primary) ?? remaining.find((a) => !a.is_template) ?? remaining[0] ?? null)
      : null;

    try {
      // Delete the row FIRST so `profiles.current_avatar_id` (ON DELETE SET NULL)
      // self-clears, then repoint via the canonical switch path (the contract).
      await avatarService.delete(id);
      await refreshAvatarList();
      if (isCurrent) {
        await clearCurrentAvatar(fallback ? fallback.id : null);
      }
      toast.success('Avatar deleted');
    } catch (error) {
      console.error('[AvatarContext] deleteAvatar failed:', error);
      toast.error('Could not delete avatar');
      throw error;
    }
  }, [avatarService, refreshAvatarList, clearCurrentAvatar, selectedAvatarId, avatars]);

  const setPrimaryAvatar = useCallback(async (id: string): Promise<void> => {
    try {
      await userProfileService.setPrimaryAvatarRPC(id);
      await refreshAvatarList();
      toast.success('Primary avatar updated');
    } catch (error) {
      console.error('[AvatarContext] setPrimaryAvatar failed:', error);
      toast.error('Could not set primary avatar');
      throw error;
    }
  }, [userProfileService, refreshAvatarList]);

  return (
    <AvatarContext.Provider
      value={{
        contextAvatarIds,
        selectedAvatarId,
        setContextAvatars,
        toggleAvatarInContext,
        setCurrentAvatar,
        clearCurrentAvatar,
        currentAvatar,
        avatars,
        isLoadingAvatars,
        renameAvatar,
        duplicateAvatar,
        deleteAvatar,
        setPrimaryAvatar,
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
