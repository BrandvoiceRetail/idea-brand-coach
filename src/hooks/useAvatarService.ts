import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseAvatarService } from '../services/SupabaseAvatarService';
import { Database } from '../integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useAvatarContext } from '@/contexts/AvatarContext';

/**
 * One-time migration: seed the canonical AvatarContext localStorage key from
 * the legacy current-avatar key, then delete the legacy key so the bleed
 * firewall's static guard stays green (design §4.1). Runs once per module load.
 */
const LEGACY_CURRENT_AVATAR_KEY = 'brandCoach_currentAvatarId'; // LEGACY-AVATAR-SHIM
const CANONICAL_AVATAR_KEY = 'idea-selected-avatar-id';
function seedCanonicalFromLegacyKeyOnce(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_CURRENT_AVATAR_KEY); // LEGACY-AVATAR-SHIM
    if (legacy) {
      if (!localStorage.getItem(CANONICAL_AVATAR_KEY)) {
        localStorage.setItem(CANONICAL_AVATAR_KEY, legacy);
      }
      localStorage.removeItem(LEGACY_CURRENT_AVATAR_KEY); // LEGACY-AVATAR-SHIM
    }
  } catch {
    // localStorage unavailable — nothing to migrate.
  }
}

export type Avatar = Database['public']['Tables']['avatars']['Row'];
export type AvatarInsert = Database['public']['Tables']['avatars']['Insert'];
export type AvatarUpdate = Database['public']['Tables']['avatars']['Update'];

interface UseAvatarServiceResult {
  avatars: Avatar[];
  currentAvatar: Avatar | null;
  isLoading: boolean;
  error: Error | null;

  // Avatar CRUD operations
  loadAvatars: () => Promise<void>;
  createAvatar: (avatar: AvatarInsert) => Promise<Avatar | null>;
  updateAvatar: (id: string, updates: AvatarUpdate) => Promise<Avatar | null>;
  deleteAvatar: (id: string) => Promise<boolean>;

  // Avatar selection
  setCurrentAvatar: (avatar: Avatar | null) => void;
  selectAvatarById: (id: string) => void;

  // Avatar management
  getAvatarsByBrand: (brandId: string) => Promise<Avatar[]>;
  refreshAvatars: () => Promise<void>;
}

export function useAvatarService(): UseAvatarServiceResult {
  const { user } = useAuth();
  const userId = user?.id;
  const [avatarService] = useState(() => new SupabaseAvatarService(supabase));

  // Canonical store (design §4.1): AvatarContext owns the current-avatar pointer
  // and the single switch path. This hook delegates selection to it.
  const { selectedAvatarId, setCurrentAvatar: setCurrentAvatarCanonical } = useAvatarContext();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatar, setCurrentAvatar] = useState<Avatar | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load all avatars for the current user
   */
  const loadAvatars = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await avatarService.getAll();

      setAvatars(data || []);
      // Selection (incl. auto-select) is owned by AvatarContext (design §4.1).
    } catch (err) {
      const error = err as Error;
      console.error('Error loading avatars:', error);
      setError(error);
      toast.error('Failed to load avatars');
    } finally {
      setIsLoading(false);
    }
  }, [avatarService]);

  /**
   * Create a new avatar
   */
  const createAvatar = useCallback(async (avatar: AvatarInsert): Promise<Avatar | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await avatarService.create(avatar);

      if (data) {
        setAvatars(prev => [...prev, data]);
        toast.success('Avatar created successfully');

        // If this is the first avatar, select it
        if (avatars.length === 0) {
          setCurrentAvatar(data);
        }

        return data;
      }

      return null;
    } catch (err) {
      const error = err as Error;
      console.error('Error creating avatar:', error);
      setError(error);
      toast.error('Failed to create avatar');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [avatarService, avatars.length]);

  /**
   * Update an existing avatar
   */
  const updateAvatar = useCallback(async (id: string, updates: AvatarUpdate): Promise<Avatar | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await avatarService.update(id, updates);

      if (data) {
        setAvatars(prev => prev.map(a => a.id === id ? data : a));

        // Update current avatar if it's the one being updated
        if (currentAvatar?.id === id) {
          setCurrentAvatar(data);
        }

        toast.success('Avatar updated successfully');
        return data;
      }

      return null;
    } catch (err) {
      const error = err as Error;
      console.error('Error updating avatar:', error);
      setError(error);
      toast.error('Failed to update avatar');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [avatarService, currentAvatar]);

  /**
   * Delete an avatar
   */
  const deleteAvatar = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      await avatarService.delete(id);

      setAvatars(prev => prev.filter(a => a.id !== id));

      // If we deleted the current avatar, select another one
      if (currentAvatar?.id === id) {
        const remainingAvatars = avatars.filter(a => a.id !== id);
        setCurrentAvatar(remainingAvatars.length > 0 ? remainingAvatars[0] : null);
      }

      toast.success('Avatar deleted successfully');
      return true;
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting avatar:', error);
      setError(error);
      toast.error('Failed to delete avatar');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [avatarService, currentAvatar, avatars]);

  /**
   * Select an avatar by ID — thin delegator to the canonical switch path
   * (design §4.1). The legacy localStorage write + window event are gone;
   * AvatarContext.setCurrentAvatar owns the RPC + session ensure + cache
   * invalidation. Local `currentAvatar` mirrors `selectedAvatarId` via the
   * sync effect below.
   */
  const selectAvatarById = useCallback((id: string) => {
    void setCurrentAvatarCanonical(id);
  }, [setCurrentAvatarCanonical]);

  /**
   * Get avatars by brand ID
   * Note: Currently returns all avatars for the user, filtering by brand would need to be implemented
   */
  const getAvatarsByBrand = useCallback(async (brandId: string): Promise<Avatar[]> => {
    try {
      setIsLoading(true);
      setError(null);

      // For now, get all avatars and filter by brand_id
      const data = await avatarService.getAll();
      const filteredData = data.filter(avatar => avatar.brand_id === brandId);

      return filteredData || [];
    } catch (err) {
      const error = err as Error;
      console.error('Error loading avatars by brand:', error);
      setError(error);
      toast.error('Failed to load avatars');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [avatarService]);

  /**
   * Refresh avatars from the database
   */
  const refreshAvatars = useCallback(async () => {
    await loadAvatars();
  }, [loadAvatars]);

  // One-time migration of the legacy localStorage key into the canonical key.
  useEffect(() => {
    seedCanonicalFromLegacyKeyOnce();
  }, []);

  // Load avatars on mount (guarded behind auth)
  useEffect(() => {
    if (!userId) return;
    loadAvatars();
  }, [userId, loadAvatars]);

  // Mirror the canonical selection (AvatarContext) into this hook's local
  // `currentAvatar` so existing consumers keep working during the collapse.
  useEffect(() => {
    setCurrentAvatar(selectedAvatarId ? avatars.find(a => a.id === selectedAvatarId) ?? null : null);
  }, [selectedAvatarId, avatars]);

  return {
    avatars,
    currentAvatar,
    isLoading,
    error,
    loadAvatars,
    createAvatar,
    updateAvatar,
    deleteAvatar,
    setCurrentAvatar,
    selectAvatarById,
    getAvatarsByBrand,
    refreshAvatars,
  };
}