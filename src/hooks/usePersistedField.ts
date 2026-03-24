/**
 * usePersistedField Hook
 * Local-first field persistence with background sync to Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { KnowledgeRepository } from '@/lib/knowledge-base/knowledge-repository';
import { SupabaseSyncService } from '@/lib/knowledge-base/supabase-sync-service';
import type { KnowledgeCategory, SyncStatus } from '@/lib/knowledge-base/interfaces';
import type { EditSource } from '@/types/field-metadata';

/**
 * Configuration for the persisted field hook
 */
interface UsePersistedFieldConfig {
  fieldIdentifier: string;
  category: KnowledgeCategory;
  defaultValue?: string;
  syncInterval?: number; // milliseconds
  debounceDelay?: number; // milliseconds
  editSource?: EditSource; // Source of field edits (manual or AI)
}

/**
 * Return type for the persisted field hook
 */
interface UsePersistedFieldReturn {
  value: string;
  onChange: (newValue: string, editSource?: EditSource) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  editSource?: EditSource; // Current edit source for this field
}

// Singleton repository instance
let repository: KnowledgeRepository | null = null;
let syncService: SupabaseSyncService | null = null;

/**
 * Get or create repository instance
 */
export async function getRepository(): Promise<KnowledgeRepository> {
  if (!repository) {
    repository = new KnowledgeRepository({
      dbName: 'idea-brand-coach',
      dbVersion: 1,
      syncInterval: 30000, // 30 seconds
      conflictResolution: 'local-first'
    });
    await repository.initialize();
  }
  return repository;
}

/**
 * Get or create sync service instance
 */
export function getSyncService(repo: KnowledgeRepository): SupabaseSyncService {
  if (!syncService) {
    syncService = new SupabaseSyncService(repo);
  }
  return syncService;
}

/**
 * Hook for persisted fields with local-first architecture
 * Provides instant local updates with background sync to Supabase
 */
export function usePersistedField({
  fieldIdentifier,
  category,
  defaultValue = '',
  syncInterval = 30000,
  debounceDelay = 500,
  editSource: defaultEditSource
}: UsePersistedFieldConfig): UsePersistedFieldReturn {
  const [value, setValue] = useState<string>(defaultValue);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [editSource, setEditSource] = useState<EditSource | undefined>(defaultEditSource);

  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || '';

  // Refs for cleanup
  const repositoryRef = useRef<KnowledgeRepository | null>(null);
  const syncServiceRef = useRef<SupabaseSyncService | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef<boolean>(false);

  /**
   * Load initial value from IndexedDB
   */
  const loadInitialValue = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Set loading state
    setIsLoading(true);

    try {
      const repo = await getRepository();
      repositoryRef.current = repo;

      // Clear current value first to ensure we load fresh data
      setValue('');

      // Load from local IndexedDB (instant)
      const entry = await repo.getFieldEntry(userId, fieldIdentifier);

      if (entry) {
        setValue(entry.content);
        // Load editSource from metadata if available
        if (entry.metadata?.editSource) {
          setEditSource(entry.metadata.editSource);
        }
      } else {
        // No local value, use default
        setValue(defaultValue);
      }

      // Initialize sync service
      const sync = getSyncService(repo);
      syncServiceRef.current = sync;

      // Check if we need to sync from remote
      if (!entry || !entry.lastSyncedAt) {
        // Try to get from remote on first load
        setSyncStatus('syncing');
        try {
          const remoteValue = await sync.fetchFromSupabase(userId, fieldIdentifier);
          if (remoteValue && remoteValue !== entry?.content) {
            setValue(remoteValue);
            await repo.saveField(userId, fieldIdentifier, remoteValue, category);
          }
          setSyncStatus('synced');
        } catch (syncError) {
          // Silently fall back to local value
          setSyncStatus('offline');
        }
      } else {
        setSyncStatus('synced');
      }
    } catch (err) {
      console.error('Failed to load persisted field:', err);
      setError(err instanceof Error ? err : new Error('Failed to load field'));
      setValue(defaultValue); // Fall back to default on error
    } finally {
      setIsLoading(false);
      hasLoadedRef.current = true;
    }
  }, [userId, fieldIdentifier, category, defaultValue]);

  /**
   * Save value locally and queue for sync
   */
  const saveValue = useCallback(async (newValue: string, source?: EditSource) => {
    if (!userId) {
      return;
    }

    try {
      const repo = repositoryRef.current || await getRepository();
      const sync = syncServiceRef.current || getSyncService(repo);

      // Determine the effective edit source
      const effectiveEditSource = source || editSource;

      // Save locally immediately (<10ms)
      if (effectiveEditSource) {
        // Save with metadata when editSource is provided
        await repo.saveFieldWithMetadata({
          userId,
          fieldIdentifier,
          category,
          content: newValue,
          metadata: {
            editSource: effectiveEditSource
          },
          version: 1, // Repository will handle versioning
          isCurrentVersion: true,
          localChanges: true
        });
        setEditSource(effectiveEditSource);
      } else {
        // Save without metadata
        await repo.saveField(userId, fieldIdentifier, newValue, category);
      }
      setValue(newValue);

      // Queue for background sync
      setSyncStatus('syncing');
      sync.queueSync(userId, fieldIdentifier, newValue)
        .then(() => {
          setSyncStatus('synced');
        })
        .catch((error) => {
          console.error('[usePersistedField] Sync error:', error);
          setSyncStatus('offline');
        });
    } catch (err) {
      console.error('Failed to save field:', err);
      setError(err instanceof Error ? err : new Error('Failed to save field'));
      toast({
        title: 'Save Failed',
        description: 'Your changes are saved locally but couldn\'t sync.',
        variant: 'destructive'
      });
    }
  }, [userId, fieldIdentifier, category, editSource, toast]);

  /**
   * Handle value change with debouncing
   */
  const handleChange = useCallback((newValue: string, source?: EditSource) => {
    // Update local state immediately for responsive UI
    setValue(newValue);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new debounced save
    saveTimerRef.current = setTimeout(() => {
      saveValue(newValue, source);
    }, debounceDelay);
  }, [saveValue, debounceDelay]);

  /**
   * Refresh from remote
   */
  const refresh = useCallback(async () => {
    if (!userId || !syncServiceRef.current) return;

    try {
      setSyncStatus('syncing');
      const remoteValue = await syncServiceRef.current.fetchFromSupabase(userId, fieldIdentifier);
      if (remoteValue !== null && remoteValue !== value) {
        setValue(remoteValue);
        await repositoryRef.current?.saveField(userId, fieldIdentifier, remoteValue, category);
      }
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('offline');
      throw err;
    }
  }, [userId, fieldIdentifier, category, value]);

  /**
   * Set up periodic sync
   */
  useEffect(() => {
    if (!userId || !syncInterval) return;

    const setupPeriodicSync = async () => {
      const repo = await getRepository();
      const sync = getSyncService(repo);

      syncIntervalRef.current = setInterval(async () => {
        try {
          await sync.syncAllFields(userId);
        } catch (err) {
          console.error('Periodic sync failed:', err);
        }
      }, syncInterval);
    };

    setupPeriodicSync();

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [userId, syncInterval]);

  /**
   * Handle online/offline status
   */
  useEffect(() => {
    const handleOnline = () => {
      if (syncStatus === 'offline') {
        setSyncStatus('syncing');
        // Attempt to sync when coming back online
        syncServiceRef.current?.syncAllFields(userId)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('offline'));
      }
    };

    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, syncStatus]);

  /**
   * Load initial value on mount and when fieldIdentifier changes
   * This ensures we load the correct value when switching between sessions
   */
  useEffect(() => {
    if (userId && fieldIdentifier) {
      // Reset the loaded flag to allow reloading for new field
      hasLoadedRef.current = false;
      loadInitialValue();
    }
  }, [userId, fieldIdentifier]); // Re-run when fieldIdentifier changes

  // Note: loadInitialValue is intentionally omitted from deps to prevent infinite loops

  /**
   * Cleanup timers on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    value,
    onChange: handleChange,
    syncStatus,
    isLoading,
    error,
    refresh,
    editSource
  };
}

// Re-exports for backward compatibility
export { usePersistedArrayField } from './usePersistedArrayField';
export { usePersistedForm } from './usePersistedForm';