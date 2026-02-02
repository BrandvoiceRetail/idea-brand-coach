/**
 * useSyncBrandContext Hook
 * Synchronizes BrandContext with database state on mount
 * Loads real completion status from Supabase and updates context
 */

import { useEffect, useState } from 'react';
import { useBrand } from '@/contexts/BrandContext';
import { useDiagnostic } from './useDiagnostic';
import { useModuleCompletionStatus } from './useModuleCompletionStatus';
import { useAuth } from './useAuth';

export interface SyncStatus {
  isInitializing: boolean;
  isSynced: boolean;
  error: Error | null;
}

/**
 * Hook to synchronize BrandContext with database state
 * Loads diagnostic and avatar completion status and updates context on mount
 */
export function useSyncBrandContext(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isInitializing: true,
    isSynced: false,
    error: null,
  });

  const { user } = useAuth();
  const { updateBrandData, syncWithDatabase } = useBrand();
  const { latestDiagnostic, isLoadingLatest } = useDiagnostic();
  const { avatarStatus, insightsStatus } = useModuleCompletionStatus();

  useEffect(() => {
    // Only sync if we have a user and data has loaded
    if (!user || isLoadingLatest) {
      return;
    }

    const syncData = async () => {
      try {
        setStatus({
          isInitializing: true,
          isSynced: false,
          error: null,
        });

        // Prepare sync data based on actual database state
        const syncPayload = {
          diagnosticCompleted: !!latestDiagnostic,
          avatarCompleted: avatarStatus === 'completed',
          insightsCompleted: insightsStatus === 'completed',
        };

        // If syncWithDatabase method exists, use it (backward compatible)
        if (typeof syncWithDatabase === 'function') {
          await syncWithDatabase(syncPayload);
        } else {
          // Fallback to individual updates for backward compatibility

          // Update diagnostic/insight status
          if (latestDiagnostic) {
            updateBrandData('insight', { completed: true });
          }

          // Update avatar status based on field completion
          if (avatarStatus === 'completed') {
            updateBrandData('avatar', { completed: true });
          }

          // Update other IDEA modules based on insights status
          if (insightsStatus === 'completed') {
            // These would need more detailed field mapping,
            // but for now we can at least mark insight as complete
            updateBrandData('insight', { completed: true });
          }
        }

        setStatus({
          isInitializing: false,
          isSynced: true,
          error: null,
        });
      } catch (error) {
        console.error('Error syncing brand context:', error);
        setStatus({
          isInitializing: false,
          isSynced: false,
          error: error as Error,
        });
      }
    };

    syncData();
  }, [user, latestDiagnostic, avatarStatus, insightsStatus, isLoadingLatest]);

  return status;
}