import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseAvatarService } from '../services/SupabaseAvatarService';
import { Database } from '../integrations/supabase/types';
import { toast } from 'sonner';

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
  const [avatarService] = useState(() => new SupabaseAvatarService(supabase));

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

      // If no current avatar is set and we have avatars, select the first one
      if (!currentAvatar && data && data.length > 0) {
        setCurrentAvatar(data[0]);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error loading avatars:', error);
      setError(error);
      toast.error('Failed to load avatars');
    } finally {
      setIsLoading(false);
    }
  }, [avatarService, currentAvatar]);

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
   * Select an avatar by ID
   */
  const selectAvatarById = useCallback((id: string) => {
    const avatar = avatars.find(a => a.id === id);
    if (avatar) {
      setCurrentAvatar(avatar);

      // Store the current avatar ID in localStorage for persistence
      localStorage.setItem('brandCoach_currentAvatarId', id);

      // Trigger a custom event for other components to listen to
      window.dispatchEvent(new CustomEvent('avatarChanged', { detail: { avatar } }));
    }
  }, [avatars]);

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

  // Load avatars on mount
  useEffect(() => {
    loadAvatars();
  }, [loadAvatars]);

  // Restore selected avatar from localStorage on mount
  useEffect(() => {
    const storedAvatarId = localStorage.getItem('brandCoach_currentAvatarId');
    if (storedAvatarId && avatars.length > 0) {
      const avatar = avatars.find(a => a.id === storedAvatarId);
      if (avatar) {
        setCurrentAvatar(avatar);
      }
    }
  }, [avatars]);

  // Listen for avatar changes from other components
  useEffect(() => {
    const handleAvatarChange = (event: CustomEvent<{ avatar: Avatar }>) => {
      setCurrentAvatar(event.detail.avatar);
    };

    window.addEventListener('avatarChanged', handleAvatarChange as EventListener);

    return () => {
      window.removeEventListener('avatarChanged', handleAvatarChange as EventListener);
    };
  }, []);

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