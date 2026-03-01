/**
 * useAvatarTabs Hook
 * Manages multi-avatar state with localStorage for metadata and IndexedDB for field data
 *
 * Local-first architecture:
 * - Avatar list stored in localStorage (fast, lightweight)
 * - Avatar field data stored in IndexedDB (larger data, structured queries)
 * - Background sync to Supabase (handled by KnowledgeRepository)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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

// LocalStorage key for avatar list
const AVATARS_STORAGE_KEY = 'idea-brand-coach:avatars';
const ACTIVE_AVATAR_STORAGE_KEY = 'idea-brand-coach:activeAvatarId';

/**
 * Load avatars from localStorage
 */
function loadAvatarsFromStorage(): Avatar[] {
  try {
    const stored = localStorage.getItem(AVATARS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[useAvatarTabs] Failed to load avatars from localStorage:', error);
    return [];
  }
}

/**
 * Save avatars to localStorage
 */
function saveAvatarsToStorage(avatars: Avatar[]): void {
  try {
    localStorage.setItem(AVATARS_STORAGE_KEY, JSON.stringify(avatars));
  } catch (error) {
    console.error('[useAvatarTabs] Failed to save avatars to localStorage:', error);
    throw new Error('Failed to save avatar list');
  }
}

/**
 * Load active avatar ID from localStorage
 */
function loadActiveAvatarId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_AVATAR_STORAGE_KEY);
  } catch (error) {
    console.error('[useAvatarTabs] Failed to load active avatar ID:', error);
    return null;
  }
}

/**
 * Save active avatar ID to localStorage
 */
function saveActiveAvatarId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(ACTIVE_AVATAR_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_AVATAR_STORAGE_KEY, id);
    }
  } catch (error) {
    console.error('[useAvatarTabs] Failed to save active avatar ID:', error);
  }
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
  const hasInitializedRef = useRef<boolean>(false);
  const isAutoCreatingRef = useRef<boolean>(false);

  /**
   * Load initial avatars from localStorage
   */
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    setIsLoading(true);
    try {
      // Load avatars from localStorage
      const storedAvatars = loadAvatarsFromStorage();
      const sortedAvatars = sortAvatarsByDate(storedAvatars);
      setAvatars(sortedAvatars);

      // Load active avatar ID
      const storedActiveId = loadActiveAvatarId();

      // If stored active ID exists and is valid, use it
      if (storedActiveId && findAvatarById(sortedAvatars, storedActiveId)) {
        setActiveAvatarIdState(storedActiveId);
      } else if (sortedAvatars.length > 0) {
        // Otherwise, use first avatar
        const firstId = sortedAvatars[0].id;
        setActiveAvatarIdState(firstId);
        saveActiveAvatarId(firstId);
      } else if (autoCreate && !isAutoCreatingRef.current) {
        // No avatars exist and autoCreate is enabled - create one
        isAutoCreatingRef.current = true;
        const newAvatar = getDefaultAvatar(defaultAvatarName);
        const newAvatars = [newAvatar];
        setAvatars(newAvatars);
        setActiveAvatarIdState(newAvatar.id);
        saveAvatarsToStorage(newAvatars);
        saveActiveAvatarId(newAvatar.id);
        isAutoCreatingRef.current = false;
      }
    } catch (err) {
      console.error('[useAvatarTabs] Failed to load avatars:', err);
      setError(err instanceof Error ? err : new Error('Failed to load avatars'));
    } finally {
      setIsLoading(false);
    }
  }, [autoCreate, defaultAvatarName]);

  /**
   * Set active avatar ID (both state and localStorage)
   */
  const setActiveAvatarId = useCallback((id: string | null) => {
    setActiveAvatarIdState(id);
    saveActiveAvatarId(id);
  }, []);

  /**
   * Get currently active avatar object
   */
  const activeAvatar = activeAvatarId ? findAvatarById(avatars, activeAvatarId) || null : null;

  /**
   * Create a new avatar
   */
  const createAvatar = useCallback(
    async (data: AvatarCreate): Promise<Avatar> => {
      try {
        // Validate name
        const nameError = validateAvatarName(data.name);
        if (nameError) {
          throw new Error(nameError);
        }

        // Create new avatar with default values
        const newAvatar: Avatar = {
          id: generateAvatarId(),
          name: data.name,
          completion_percentage: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          metadata: {
            color: '#6366f1', // Default indigo
            icon: '👤',
            ...data.metadata,
          },
        };

        // Add to avatars list using functional update
        setAvatars((currentAvatars) => {
          const updatedAvatars = [newAvatar, ...currentAvatars];
          saveAvatarsToStorage(updatedAvatars);
          return updatedAvatars;
        });

        // Switch to new avatar
        setActiveAvatarId(newAvatar.id);

        toast({
          title: 'Avatar Created',
          description: `"${newAvatar.name}" has been created.`,
        });

        return newAvatar;
      } catch (err) {
        console.error('[useAvatarTabs] Failed to create avatar:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to create avatar';
        setError(err instanceof Error ? err : new Error(errorMessage));
        toast({
          title: 'Error Creating Avatar',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [setActiveAvatarId, toast]
  );

  /**
   * Update an existing avatar
   */
  const updateAvatar = useCallback(
    async (id: string, update: AvatarUpdate): Promise<void> => {
      try {
        // Validate name if provided
        if (update.name !== undefined) {
          const nameError = validateAvatarName(update.name);
          if (nameError) {
            throw new Error(nameError);
          }
        }

        setAvatars((currentAvatars) => {
          // Find avatar to update
          const avatarIndex = currentAvatars.findIndex((a) => a.id === id);
          if (avatarIndex === -1) {
            throw new Error('Avatar not found');
          }

          // Update avatar
          const updatedAvatar: Avatar = {
            ...currentAvatars[avatarIndex],
            ...update,
            updated_at: new Date().toISOString(),
          };

          const updatedAvatars = [...currentAvatars];
          updatedAvatars[avatarIndex] = updatedAvatar;

          // Re-sort after update (in case updated_at changed the order)
          const sortedAvatars = sortAvatarsByDate(updatedAvatars);
          saveAvatarsToStorage(sortedAvatars);

          return sortedAvatars;
        });

        if (update.name) {
          toast({
            title: 'Avatar Updated',
            description: `Renamed to "${update.name}".`,
          });
        }
      } catch (err) {
        console.error('[useAvatarTabs] Failed to update avatar:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to update avatar';
        setError(err instanceof Error ? err : new Error(errorMessage));
        toast({
          title: 'Error Updating Avatar',
          description: errorMessage,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  /**
   * Delete an avatar
   */
  const deleteAvatar = useCallback(
    async (id: string): Promise<void> => {
      setAvatars((currentAvatars) => {
        try {
          const avatarToDelete = findAvatarById(currentAvatars, id);
          if (!avatarToDelete) {
            throw new Error('Avatar not found');
          }

          // Remove from list
          const updatedAvatars = currentAvatars.filter((a) => a.id !== id);
          saveAvatarsToStorage(updatedAvatars);

          // If deleted avatar was active, switch to another
          if (activeAvatarId === id) {
            if (updatedAvatars.length > 0) {
              setActiveAvatarId(updatedAvatars[0].id);
            } else {
              setActiveAvatarId(null);
            }
          }

          toast({
            title: 'Avatar Deleted',
            description: `"${avatarToDelete.name}" has been deleted.`,
          });

          return updatedAvatars;
        } catch (err) {
          console.error('[useAvatarTabs] Failed to delete avatar:', err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to delete avatar';
          setError(err instanceof Error ? err : new Error(errorMessage));
          toast({
            title: 'Error Deleting Avatar',
            description: errorMessage,
            variant: 'destructive',
          });
          throw err;
        }
      });
    },
    [activeAvatarId, setActiveAvatarId, toast]
  );

  /**
   * Switch to a different avatar
   */
  const switchAvatar = useCallback(
    (id: string) => {
      setAvatars((currentAvatars) => {
        const avatar = findAvatarById(currentAvatars, id);
        if (!avatar) {
          console.error('[useAvatarTabs] Attempted to switch to non-existent avatar:', id);
          toast({
            title: 'Error',
            description: 'Avatar not found.',
            variant: 'destructive',
          });
          return currentAvatars;
        }

        // Update last_accessed_at for the avatar
        const now = new Date().toISOString();
        const updatedAvatars = currentAvatars.map((a) =>
          a.id === id ? { ...a, last_accessed_at: now } : a
        );
        saveAvatarsToStorage(updatedAvatars);

        // Switch active avatar
        setActiveAvatarId(id);

        return updatedAvatars;
      });
    },
    [setActiveAvatarId, toast]
  );

  /**
   * Refresh avatars from localStorage
   */
  const refresh = useCallback(() => {
    try {
      const storedAvatars = loadAvatarsFromStorage();
      const sortedAvatars = sortAvatarsByDate(storedAvatars);
      setAvatars(sortedAvatars);

      // Verify active avatar still exists
      if (activeAvatarId && !findAvatarById(sortedAvatars, activeAvatarId)) {
        if (sortedAvatars.length > 0) {
          setActiveAvatarId(sortedAvatars[0].id);
        } else {
          setActiveAvatarId(null);
        }
      }
    } catch (err) {
      console.error('[useAvatarTabs] Failed to refresh avatars:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh avatars'));
    }
  }, [activeAvatarId, setActiveAvatarId]);

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
