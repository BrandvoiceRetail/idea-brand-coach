/**
 * useDiagnostic Hook
 * React hook for diagnostic data operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/services/ServiceProvider';
import { DiagnosticCreate } from '@/types/diagnostic';
import { useToast } from '@/hooks/use-toast';

export const useDiagnostic = () => {
  const { diagnosticService } = useServices();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      queryClient.invalidateQueries({ queryKey: ['diagnostic'] });
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

  // Mutation: Sync from localStorage
  const syncFromLocalStorageMutation = useMutation({
    mutationFn: () => diagnosticService.syncFromLocalStorage(),
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['diagnostic'] });
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
