/**
 * AvatarContext
 *
 * Global context for managing the currently selected avatar.
 * Provides state management for which avatar the user is currently working on.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAvatars } from '@/hooks/useAvatars';
import { Avatar } from '@/types/avatar';

interface AvatarContextValue {
  /** Currently selected avatar ID */
  selectedAvatarId: string | null;
  /** Set the selected avatar by ID */
  setSelectedAvatar: (avatarId: string | null) => void;
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
}

const SELECTED_AVATAR_STORAGE_KEY = 'idea-selected-avatar-id';

export function AvatarProvider({ children }: AvatarProviderProps): JSX.Element {
  // Get avatars from the useAvatars hook
  const { avatars, isLoadingAvatars } = useAvatars();

  // Manage selected avatar ID in state (with localStorage persistence)
  const [selectedAvatarId, setSelectedAvatarIdState] = useState<string | null>(() => {
    // Initialize from localStorage if available
    try {
      const stored = localStorage.getItem(SELECTED_AVATAR_STORAGE_KEY);
      return stored || null;
    } catch {
      return null;
    }
  });

  // Sync selectedAvatarId to localStorage
  useEffect(() => {
    try {
      if (selectedAvatarId) {
        localStorage.setItem(SELECTED_AVATAR_STORAGE_KEY, selectedAvatarId);
      } else {
        localStorage.removeItem(SELECTED_AVATAR_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to persist selected avatar ID:', error);
    }
  }, [selectedAvatarId]);

  // Auto-select first avatar if none selected and avatars are loaded
  useEffect(() => {
    if (!selectedAvatarId && avatars && avatars.length > 0) {
      setSelectedAvatarIdState(avatars[0].id);
    }
  }, [selectedAvatarId, avatars]);

  // Clear selection if selected avatar no longer exists
  useEffect(() => {
    if (selectedAvatarId && avatars) {
      const exists = avatars.some(avatar => avatar.id === selectedAvatarId);
      if (!exists) {
        setSelectedAvatarIdState(null);
      }
    }
  }, [selectedAvatarId, avatars]);

  // Derive current avatar from selected ID
  const currentAvatar = selectedAvatarId && avatars
    ? avatars.find(avatar => avatar.id === selectedAvatarId) || null
    : null;

  // Wrapper to update selected avatar
  const setSelectedAvatar = useCallback((avatarId: string | null) => {
    setSelectedAvatarIdState(avatarId);
  }, []);

  return (
    <AvatarContext.Provider
      value={{
        selectedAvatarId,
        setSelectedAvatar,
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
