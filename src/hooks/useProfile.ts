/**
 * useProfile Hook
 * React hook for user profile operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { UserProfileUpdate } from '@/types/profile';
import { useToast } from '@/hooks/use-toast';

export const useProfile = () => {
  const { userProfileService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query: Get profile
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['profile'],
    queryFn: () => userProfileService.getProfile(),
    retry: 1,
  });

  // Query: Check if user has diagnostic
  const {
    data: hasDiagnostic,
    isLoading: isCheckingDiagnostic,
  } = useQuery({
    queryKey: ['profile', 'has-diagnostic'],
    queryFn: () => userProfileService.hasDiagnostic(),
    retry: 1,
  });

  // Mutation: Update profile
  const updateProfileMutation = useMutation({
    mutationFn: (updates: UserProfileUpdate) => userProfileService.updateProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Updating Profile',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    // Data
    profile,
    hasDiagnostic,
    
    // Loading states
    isLoading,
    isCheckingDiagnostic,
    
    // Error
    error,
    
    // Mutations
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
};
