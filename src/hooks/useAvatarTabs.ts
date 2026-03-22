/**
 * useAvatarTabs Hook
 * Manages multi-avatar state with localStorage for metadata and IndexedDB for field data
 *
 * Local-first architecture:
 * - Avatar list stored in localStorage (fast, lightweight)
 * - Avatar field data stored in IndexedDB (larger data, structured queries)
 * - Background sync to Supabase (handled by KnowledgeRepository)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Avatar, AvatarCreate, AvatarUpdate } from '@/types/avatar';
import {
  generateAvatarId,
  getDefaultAvatar,
  validateAvatarName,
  sortAvatarsByDate,
  findAvatarById,
} from '@/lib/avatar-utils';
import {
  LocalStorageAvatarAdapter,
  type IAvatarStorageAdapter,
} from '@/lib/AvatarStorageAdapter';

/**
 * Configuration for the avatar tabs hook
 */
interface UseAvatarTabsConfig {
  /**
   * Auto-create an avatar if none exists
   * @default true
   */
  autoCreate?: boolean;
  /**
   * Default name for auto-created avatar
   * @default "My First Avatar"
   */
  defaultAvatarName?: string;
}

/**
 * Return type for the avatar tabs hook
 */
interface UseAvatarTabsReturn {
  /** List of all avatars (sorted by most recent first) */
  avatars: Avatar[];
  /** ID of currently active avatar */
  activeAvatarId: string | null;
  /** Currently active avatar object */
  activeAvatar: Avatar | null;
  /** Loading state for initial load */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Create a new avatar */
  createAvatar: (data: AvatarCreate) => Promise<Avatar>;
  /** Update an existing avatar */
  updateAvatar: (id: string, update: AvatarUpdate) => Promise<void>;
  /** Delete an avatar */
  deleteAvatar: (id: string) => Promise<void>;
  /** Switch to a different avatar */
  switchAvatar: (id: string) => void;
  /** Refresh avatar list from localStorage */
  refresh: () => void;
}

/**
 * Normalize an unknown error into an Error object with a fallback message.
 */
function toError(err: unknown, fallbackMessage: string): Error {
  return err instanceof Error ? err : new Error(fallbackMessage);
}

/**
 * Hook for managing avatar tabs with local-first architecture
 * Provides avatar CRUD operations and active avatar state
 */
export function useAvatarTabs(config: UseAvatarTabsConfig = {}): UseAvatarTabsReturn {
  const { autoCreate = true, defaultAvatarName = 'My First Avatar' } = config;

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [activeAvatarId, setActiveAvatarIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  const storage: IAvatarStorageAdapter = useMemo(() => new LocalStorageAvatarAdapter(), []);

  // Eagerly-synchronized refs so callbacks always read the latest state,
  // even within the same React batch (before re-render).
  const avatarsRef = useRef<Avatar[]>(avatars);
  const activeAvatarIdRef = useRef(activeAvatarId);

  // Keep refs in sync on every render
  avatarsRef.current = avatars;
  activeAvatarIdRef.current = activeAvatarId;

  /**
   * Update avatars state and eagerly sync the ref so subsequent calls
   * within the same batch see the new value.
   */
  const updateAvatars = useCallback((newAvatars: Avatar[]): void => {
    avatarsRef.current = newAvatars;
    setAvatars(newAvatars);
  }, []);

  /**
   * Set active avatar ID (state + ref + storage)
   */
  const setActiveAvatarId = useCallback(
    (id: string | null): void => {
      activeAvatarIdRef.current = id;
      setActiveAvatarIdState(id);
      storage.saveActiveAvatarId(id);
    },
    [storage],
  );

  /**
   * Load initial avatars from localStorage.
   * Idempotent: re-running simply overwrites state with the same localStorage data.
   */
  useEffect(() => {
    setIsLoading(true);
    try {
      const storedAvatars = storage.loadAvatars();
      const sortedAvatars = sortAvatarsByDate(storedAvatars);

      const storedActiveId = storage.loadActiveAvatarId();

      if (storedActiveId && findAvatarById(sortedAvatars, storedActiveId)) {
        updateAvatars(sortedAvatars);
        setActiveAvatarIdState(storedActiveId);
        activeAvatarIdRef.current = storedActiveId;
      } else if (sortedAvatars.length > 0) {
        updateAvatars(sortedAvatars);
        const firstId = sortedAvatars[0].id;
        setActiveAvatarId(firstId);
      } else if (autoCreate) {
        const newAvatar = getDefaultAvatar(defaultAvatarName);
        const newAvatars = [newAvatar];
        updateAvatars(newAvatars);
        storage.saveAvatars(newAvatars);
        setActiveAvatarId(newAvatar.id);
      } else {
        updateAvatars(sortedAvatars);
      }
    } catch (err) {
      console.error('[useAvatarTabs] Failed to load avatars:', err);
      setError(toError(err, 'Failed to load avatars'));
    } finally {
      setIsLoading(false);
    }
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Get currently active avatar object
   */
  const activeAvatar = activeAvatarId
    ? findAvatarById(avatars, activeAvatarId) || null
    : null;

  /**
   * Create a new avatar
   */
  const createAvatar = useCallback(
    async (data: AvatarCreate): Promise<Avatar> => {
      try {
        const nameError = validateAvatarName(data.name);
        if (nameError) throw new Error(nameError);

        const newAvatar: Avatar = {
          id: generateAvatarId(),
          name: data.name,
          completion_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          metadata: {
            color: '#6366f1',
            icon: '\u{1F464}',
            ...data.metadata,
          },
        };

        // Read from ref (always latest, even within same batch)
        const updatedAvatars = [newAvatar, ...avatarsRef.current];
        updateAvatars(updatedAvatars);
        storage.saveAvatars(updatedAvatars);
        setActiveAvatarId(newAvatar.id);

        toast({
          title: 'Avatar Created',
          description: `"${newAvatar.name}" has been created.`,
        });

        return newAvatar;
      } catch (err) {
        console.error('[useAvatarTabs] Failed to create avatar:', err);
        const errorObj = toError(err, 'Failed to create avatar');
        setError(errorObj);
        toast({
          title: 'Error Creating Avatar',
          description: errorObj.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [updateAvatars, setActiveAvatarId, toast, storage],
  );

  /**
   * Update an existing avatar
   */
  const updateAvatar = useCallback(
    async (id: string, update: AvatarUpdate): Promise<void> => {
      try {
        if (update.name !== undefined) {
          const nameError = validateAvatarName(update.name);
          if (nameError) throw new Error(nameError);
        }

        const currentAvatars = avatarsRef.current;
        const avatarIndex = currentAvatars.findIndex((a) => a.id === id);
        if (avatarIndex === -1) throw new Error('Avatar not found');

        const updatedAvatar: Avatar = {
          ...currentAvatars[avatarIndex],
          ...update,
          updated_at: new Date().toISOString(),
        };

        const updatedAvatars = [...currentAvatars];
        updatedAvatars[avatarIndex] = updatedAvatar;
        const sortedAvatars = sortAvatarsByDate(updatedAvatars);

        updateAvatars(sortedAvatars);
        storage.saveAvatars(sortedAvatars);

        if (update.name) {
          toast({
            title: 'Avatar Updated',
            description: `Renamed to "${update.name}".`,
          });
        }
      } catch (err) {
        console.error('[useAvatarTabs] Failed to update avatar:', err);
        const errorObj = toError(err, 'Failed to update avatar');
        setError(errorObj);
        toast({
          title: 'Error Updating Avatar',
          description: errorObj.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [updateAvatars, toast, storage],
  );

  /**
   * Delete an avatar.
   * All state reads use refs; all side effects happen after state computation.
   */
  const deleteAvatar = useCallback(
    async (id: string): Promise<void> => {
      try {
        const currentAvatars = avatarsRef.current;
        const avatarToDelete = findAvatarById(currentAvatars, id);
        if (!avatarToDelete) throw new Error('Avatar not found');

        const updatedAvatars = currentAvatars.filter((a) => a.id !== id);
        updateAvatars(updatedAvatars);
        storage.saveAvatars(updatedAvatars);

        if (activeAvatarIdRef.current === id) {
          setActiveAvatarId(updatedAvatars[0]?.id ?? null);
        }

        toast({
          title: 'Avatar Deleted',
          description: `"${avatarToDelete.name}" has been deleted.`,
        });
      } catch (err) {
        console.error('[useAvatarTabs] Failed to delete avatar:', err);
        const errorObj = toError(err, 'Failed to delete avatar');
        setError(errorObj);
        toast({
          title: 'Error Deleting Avatar',
          description: errorObj.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [updateAvatars, setActiveAvatarId, toast, storage],
  );

  /**
   * Switch to a different avatar
   */
  const switchAvatar = useCallback(
    (id: string): void => {
      const currentAvatars = avatarsRef.current;
      const avatar = findAvatarById(currentAvatars, id);
      if (!avatar) {
        console.error('[useAvatarTabs] Attempted to switch to non-existent avatar:', id);
        toast({
          title: 'Error',
          description: 'Avatar not found.',
          variant: 'destructive',
        });
        return;
      }

      const now = new Date().toISOString();
      const updatedAvatars = currentAvatars.map((a) =>
        a.id === id ? { ...a, last_accessed_at: now } : a,
      );
      updateAvatars(updatedAvatars);
      storage.saveAvatars(updatedAvatars);
      setActiveAvatarId(id);
    },
    [updateAvatars, setActiveAvatarId, toast, storage],
  );

  /**
   * Refresh avatars from localStorage
   */
  const refresh = useCallback((): void => {
    try {
      const storedAvatars = storage.loadAvatars();
      const sortedAvatars = sortAvatarsByDate(storedAvatars);
      updateAvatars(sortedAvatars);

      if (activeAvatarIdRef.current && !findAvatarById(sortedAvatars, activeAvatarIdRef.current)) {
        setActiveAvatarId(sortedAvatars[0]?.id ?? null);
      }
    } catch (err) {
      console.error('[useAvatarTabs] Failed to refresh avatars:', err);
      setError(toError(err, 'Failed to refresh avatars'));
    }
  }, [updateAvatars, setActiveAvatarId, storage]);

  return {
    avatars,
    activeAvatarId,
    activeAvatar,
    isLoading,
    error,
    createAvatar,
    updateAvatar,
    deleteAvatar,
    switchAvatar,
    refresh,
  };
}
