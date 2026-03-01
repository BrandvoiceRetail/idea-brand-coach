/**
 * useAvatars Hook
 * React hook for customer avatar operations
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
    data: avatars = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['avatars'],
    queryFn: () => avatarService.getAll(),
    retry: 1,
  });

  // Query: Get avatar templates
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
  } = useQuery({
    queryKey: ['avatars', 'templates'],
    queryFn: () => avatarService.getTemplates(),
    retry: 1,
  });

  // Mutation: Create avatar
  const createAvatarMutation = useMutation({
    mutationFn: (avatar: AvatarCreate) => avatarService.create(avatar),
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
    mutationFn: ({ id, update }: { id: string; update: AvatarUpdate }) =>
      avatarService.update(id, update),
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
    mutationFn: (id: string) => avatarService.delete(id),
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

  // Mutation: Duplicate avatar
  const duplicateAvatarMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName?: string }) =>
      avatarService.duplicate(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
      toast({
        title: 'Avatar Duplicated',
        description: 'Your avatar has been duplicated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Duplicating Avatar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    avatars,
    templates,

    // Loading states
    isLoading,
    isLoadingTemplates,

    // Error
    error,

    // Mutations
    createAvatar: createAvatarMutation.mutate,
    isCreating: createAvatarMutation.isPending,

    updateAvatar: updateAvatarMutation.mutate,
    isUpdating: updateAvatarMutation.isPending,

    deleteAvatar: deleteAvatarMutation.mutate,
    isDeleting: deleteAvatarMutation.isPending,

    duplicateAvatar: duplicateAvatarMutation.mutate,
    isDuplicating: duplicateAvatarMutation.isPending,
  };
};
