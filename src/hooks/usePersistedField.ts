/**
 * usePersistedField Hook
 * Local-first field persistence with background sync to Supabase
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { KnowledgeRepository } from '@/lib/knowledge-base/knowledge-repository';
import { SupabaseSyncService } from '@/lib/knowledge-base/supabase-sync-service';
import type { KnowledgeCategory, SyncStatus } from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for the persisted field hook
 */
export interface UsePersistedFieldConfig<T> {
  fieldIdentifier: string;
  category: KnowledgeCategory;
  defaultValue?: T;
  syncInterval?: number; // milliseconds
  debounceDelay?: number; // milliseconds
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

/**
 * Return type for the persisted field hook
 */
export interface UsePersistedFieldReturn<T> {
  value: T;
  onChange: (newValue: T) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Default serialization functions
 */
const defaultSerialize = <T>(value: T): string => {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
};

const createDefaultDeserialize = <T>(defaultValue: T): ((value: string) => T) => {
  return (value: string): T => {
    if (typeof defaultValue === 'string') {
      return value as T;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[usePersistedField] Deserialization failed:', error);
      return defaultValue;
    }
  };
};

// Singleton repository instance
let repository: KnowledgeRepository | null = null;
let syncService: SupabaseSyncService | null = null;

/**
 * Get or create repository instance
 */
async function getRepository(): Promise<KnowledgeRepository> {
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
function getSyncService(repo: KnowledgeRepository): SupabaseSyncService {
  if (!syncService) {
    syncService = new SupabaseSyncService(repo);
  }
  return syncService;
}

/**
 * Hook for persisted fields with local-first architecture
 * Provides instant local updates with background sync to Supabase
 *
 * @example
 * // String field
 * const { value, onChange } = usePersistedField({
 *   fieldIdentifier: 'brand-name',
 *   category: 'brand-basics',
 *   defaultValue: ''
 * });
 *
 * @example
 * // Array field
 * const { value, onChange } = usePersistedField<string[]>({
 *   fieldIdentifier: 'target-audiences',
 *   category: 'brand-basics',
 *   defaultValue: []
 * });
 *
 * @example
 * // Object field
 * const { value, onChange } = usePersistedField<BrandProfile>({
 *   fieldIdentifier: 'brand-profile',
 *   category: 'brand-basics',
 *   defaultValue: { name: '', industry: '' }
 * });
 */
export function usePersistedField<T = string>({
  fieldIdentifier,
  category,
  defaultValue,
  syncInterval = 30000,
  debounceDelay = 500,
  serialize = defaultSerialize,
  deserialize
}: UsePersistedFieldConfig<T>): UsePersistedFieldReturn<T> {
  // Use empty string as default for string types, otherwise use provided default or empty object
  const actualDefaultValue = (defaultValue !== undefined ? defaultValue : '') as T;

  // Create deserialize function with defaultValue bound if not provided
  const deserializeFn = deserialize || createDefaultDeserialize(actualDefaultValue);
  const [value, setValue] = useState<T>(actualDefaultValue);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

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

      // Load from local IndexedDB (instant)
      const storedValue = await repo.getField(userId, fieldIdentifier);

      if (storedValue !== null) {
        const deserialized = deserializeFn(storedValue);
        setValue(deserialized);
      } else {
        // No local value, use default
        setValue(actualDefaultValue);
      }

      // Initialize sync service
      const sync = getSyncService(repo);
      syncServiceRef.current = sync;

      // Check if we need to sync from remote
      const entry = await repo.getFieldEntry(userId, fieldIdentifier);
      if (!entry || !entry.lastSyncedAt) {
        // Try to get from remote on first load
        setSyncStatus('syncing');
        try {
          const remoteValue = await sync.fetchFromSupabase(userId, fieldIdentifier);
          if (remoteValue && remoteValue !== storedValue) {
            const deserialized = deserializeFn(remoteValue);
            setValue(deserialized);
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
      setValue(actualDefaultValue); // Fall back to default on error
    } finally {
      setIsLoading(false);
      hasLoadedRef.current = true;
    }
  }, [userId, fieldIdentifier, category, actualDefaultValue, deserializeFn]);

  /**
   * Save value locally and queue for sync
   */
  const saveValue = useCallback(async (newValue: T) => {
    if (!userId) {
      return;
    }

    try {
      const repo = repositoryRef.current || await getRepository();
      const sync = syncServiceRef.current || getSyncService(repo);

      // Serialize the value for storage
      const serialized = serialize(newValue);

      // Save locally immediately (<10ms)
      await repo.saveField(userId, fieldIdentifier, serialized, category);
      setValue(newValue);

      // Queue for background sync
      setSyncStatus('syncing');
      sync.queueSync(userId, fieldIdentifier, serialized)
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
  }, [userId, fieldIdentifier, category, serialize, toast]);

  /**
   * Handle value change with debouncing
   */
  const handleChange = useCallback((newValue: T) => {
    // Update local state immediately for responsive UI
    setValue(newValue);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new debounced save
    saveTimerRef.current = setTimeout(() => {
      saveValue(newValue);
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
      if (remoteValue !== null) {
        const deserialized = deserializeFn(remoteValue);
        const serializedCurrent = serialize(value);
        if (remoteValue !== serializedCurrent) {
          setValue(deserialized);
          await repositoryRef.current?.saveField(userId, fieldIdentifier, remoteValue, category);
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      setSyncStatus('offline');
      throw err;
    }
  }, [userId, fieldIdentifier, category, value, deserializeFn, serialize]);

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
    refresh
  };
}

/**
 * Hook for persisted array fields
 * Stores arrays with automatic JSON serialization
 */
export function usePersistedArrayField({
  fieldIdentifier,
  category,
  defaultValue = [],
  debounceDelay = 500
}: {
  fieldIdentifier: string;
  category: KnowledgeCategory;
  defaultValue?: string[];
  debounceDelay?: number;
}): {
  value: string[];
  add: (item: string) => void;
  remove: (index: number) => void;
  set: (items: string[]) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
} {
  const field = usePersistedField<string[]>({
    fieldIdentifier,
    category,
    defaultValue,
    debounceDelay
  });

  const add = useCallback((item: string) => {
    if (item.trim() && !field.value.includes(item.trim())) {
      field.onChange([...field.value, item.trim()]);
    }
  }, [field]);

  const remove = useCallback((index: number) => {
    field.onChange(field.value.filter((_, i) => i !== index));
  }, [field]);

  const set = useCallback((items: string[]) => {
    field.onChange(items);
  }, [field]);

  return {
    value: field.value,
    add,
    remove,
    set,
    syncStatus: field.syncStatus,
    isLoading: field.isLoading
  };
}

/**
 * Hook for batch persisted fields
 * Useful for forms with multiple fields
 */
export function usePersistedForm(
  fields: Array<{ identifier: string; category: KnowledgeCategory; defaultValue?: string }>
) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();
  const userId = user?.id || '';

  /**
   * Load all field values
   */
  const loadAllFields = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const repo = await getRepository();
      const loadedValues: Record<string, string> = {};

      for (const field of fields) {
        const value = await repo.getField(userId, field.identifier);
        loadedValues[field.identifier] = value || field.defaultValue || '';
      }

      setValues(loadedValues);
    } catch (err) {
      console.error('Failed to load form fields:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, fields]);

  /**
   * Save all field values
   */
  const saveAllFields = useCallback(async (newValues: Record<string, string>) => {
    if (!userId) return;

    try {
      const repo = await getRepository();
      const sync = getSyncService(repo);

      setSyncStatus('syncing');

      // Save all fields locally
      for (const field of fields) {
        const value = newValues[field.identifier];
        if (value !== undefined) {
          await repo.saveField(userId, field.identifier, value, field.category);
        }
      }

      setValues(newValues);

      // Queue batch sync
      await sync.syncAllFields(userId);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Failed to save form fields:', err);
      setSyncStatus('offline');
    }
  }, [userId, fields]);

  useEffect(() => {
    loadAllFields();
  }, [loadAllFields]);

  return {
    values,
    setValues: saveAllFields,
    syncStatus,
    isLoading
  };
}