/**
 * useAvatars Hook
 * React hook for avatar CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { AvatarCreate, AvatarUpdate } from '@/types/avatar';
import { useToast } from '@/hooks/use-toast';

export const useAvatars = () => {
  const { avatarService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query: Get all avatars
  const {
    data: avatars,
    isLoading: isLoadingAvatars,
    error: avatarsError,
  } = useQuery({
    queryKey: ['avatars'],
    queryFn: () => avatarService.getAvatars(),
    retry: 1,
  });

  // Query: Get avatar templates
  const {
    data: templates,
    isLoading: isLoadingTemplates,
    error: templatesError,
  } = useQuery({
    queryKey: ['avatars', 'templates'],
    queryFn: () => avatarService.getAvatarTemplates(),
    retry: 1,
  });

  // Mutation: Create avatar
  const createAvatarMutation = useMutation({
    mutationFn: (data: AvatarCreate) => avatarService.createAvatar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast({
        title: 'Avatar Created',
        description: 'Your avatar has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Creating Avatar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Update avatar
  const updateAvatarMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AvatarUpdate }) =>
      avatarService.updateAvatar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast({
        title: 'Avatar Updated',
        description: 'Your avatar has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Updating Avatar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Delete avatar
  const deleteAvatarMutation = useMutation({
    mutationFn: (id: string) => avatarService.deleteAvatar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast({
        title: 'Avatar Deleted',
        description: 'Your avatar has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Deleting Avatar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Helper: Get single avatar by ID
  const getAvatar = async (id: string) => {
    return avatarService.getAvatar(id);
  };

  return {
    // Data
    avatars,
    templates,

    // Loading states
    isLoadingAvatars,
    isLoadingTemplates,

    // Errors
    avatarsError,
    templatesError,

    // Mutations
    createAvatar: createAvatarMutation.mutate,
    isCreating: createAvatarMutation.isPending,

    updateAvatar: updateAvatarMutation.mutate,
    isUpdating: updateAvatarMutation.isPending,

    deleteAvatar: deleteAvatarMutation.mutate,
    isDeleting: deleteAvatarMutation.isPending,

    // Helpers
    getAvatar,
  };
};
