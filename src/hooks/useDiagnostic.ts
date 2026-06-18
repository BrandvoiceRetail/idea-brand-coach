/**
 * useDiagnostic Hook
 * React hook for diagnostic data operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { DiagnosticCreate } from '@/types/diagnostic';
import { useToast } from '@/hooks/use-toast';
import { useBrand } from '@/contexts/BrandContext';
import { AVATAR_KEY_PREFIX } from '@/lib/queryKeys';

export const useDiagnostic = () => {
  const { diagnosticService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { updateBrandData } = useBrand();

  // Invalidate BOTH the legacy `['diagnostic']` queries and the avatar-scoped
  // diagnostic compare keys (`['avatar', …, 'diagnostic', …]`) so a fresh write
  // — including a newly-created overlay — is reflected in compare-mode.
  const invalidateDiagnostic = () => {
    queryClient.invalidateQueries({ queryKey: ['diagnostic'] });
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === AVATAR_KEY_PREFIX && q.queryKey[2] === 'diagnostic',
    });
  };

  // Query: Get latest diagnostic
  const {
    data: latestDiagnostic,
    isLoading: isLoadingLatest,
    error: latestError,
  } = useQuery({
    queryKey: ['diagnostic', 'latest'],
    queryFn: () => diagnosticService.getLatestDiagnostic(),
    retry: 1,
  });

  // Query: Get diagnostic history
  const {
    data: diagnosticHistory,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery({
    queryKey: ['diagnostic', 'history'],
    queryFn: () => diagnosticService.getDiagnosticHistory(),
    retry: 1,
  });

  // Mutation: Save diagnostic
  const saveDiagnosticMutation = useMutation({
    mutationFn: (data: DiagnosticCreate) => diagnosticService.saveDiagnostic(data),
    onSuccess: () => {
      invalidateDiagnostic();
      updateBrandData('insight', { completed: true });
      toast({
        title: 'Diagnostic Saved',
        description: 'Your diagnostic results have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error Saving Diagnostic',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Sync from localStorage. Optional avatarId scopes the write to an
  // overlay (locked #5) — passed by the results page when an avatar is current,
  // omitted by the first-signup sync so the brand baseline is established first.
  const syncFromLocalStorageMutation = useMutation({
    mutationFn: (avatarId?: string | null) => diagnosticService.syncFromLocalStorage(avatarId),
    onSuccess: (data) => {
      if (data) {
        invalidateDiagnostic();
        updateBrandData('insight', { completed: true });
        toast({
          title: 'Diagnostic Synced',
          description: 'Your diagnostic results have been synced to your account.',
        });
      }
    },
    onError: (error: Error) => {
      console.error('Error syncing diagnostic:', error);
    },
  });

  // Helper: Calculate scores
  const calculateScores = (answers: Record<string, number>) => {
    return diagnosticService.calculateScores(answers);
  };

  return {
    // Data
    latestDiagnostic,
    diagnosticHistory,
    
    // Loading states
    isLoadingLatest,
    isLoadingHistory,
    
    // Errors
    latestError,
    historyError,
    
    // Mutations
    saveDiagnostic: saveDiagnosticMutation.mutateAsync,
    isSaving: saveDiagnosticMutation.isPending,

    syncFromLocalStorage: syncFromLocalStorageMutation.mutateAsync,
    isSyncing: syncFromLocalStorageMutation.isPending,
    
    // Helpers
    calculateScores,
  };
};
