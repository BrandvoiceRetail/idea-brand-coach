/**
 * useFieldSync Hook
 * Generic hook for field synchronization with local-first architecture
 * Provides type-safe field persistence with background sync to Supabase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getFieldSyncService, DEFAULT_FIELD_SYNC_CONFIG } from '@/lib/sync/FieldSyncService';
import type { KnowledgeCategory, SyncStatus } from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for the field sync hook
 *
 * @template T - Type of the field value (string, array, object, etc.)
 * @property {string} fieldIdentifier - Unique identifier for the field (e.g., 'brand-name')
 * @property {KnowledgeCategory} category - Category for organizing fields (e.g., 'brand-basics')
 * @property {T} defaultValue - Default value when field is not found
 * @property {number} [debounceDelay] - Milliseconds to debounce saves (default: 500)
 * @property {(value: T) => string} [serialize] - Custom serialization function (default: JSON.stringify for objects, passthrough for strings)
 * @property {(value: string) => T} [deserialize] - Custom deserialization function (default: JSON.parse for objects, passthrough for strings)
 */
export interface UseFieldSyncConfig<T> {
  fieldIdentifier: string;
  category: KnowledgeCategory;
  defaultValue: T;
  debounceDelay?: number; // milliseconds
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

/**
 * Return type for the field sync hook
 *
 * @template T - Type of the field value
 * @property {T} value - Current field value
 * @property {(newValue: T) => void} onChange - Function to update field value (debounced)
 * @property {SyncStatus} syncStatus - Current sync status ('synced' | 'syncing' | 'offline' | 'error')
 * @property {boolean} isLoading - True during initial load
 * @property {Error | null} error - Last error that occurred, or null
 * @property {() => Promise<void>} refresh - Manually refresh from remote
 */
export interface UseFieldSyncReturn<T> {
  value: T;
  onChange: (newValue: T) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Default serialization function
 *
 * Converts a value to a string for storage. Strings are passed through,
 * other types are JSON stringified.
 *
 * @template T - Type of the value
 * @param {T} value - Value to serialize
 * @returns {string} Serialized string
 */
const defaultSerialize = <T>(value: T): string => {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
};

/**
 * Create default deserialization function
 *
 * Creates a deserializer based on the default value type. Strings are
 * passed through, other types are JSON parsed with fallback to default.
 *
 * @template T - Type of the value
 * @param {T} defaultValue - Default value to use on parse errors
 * @returns {(value: string) => T} Deserializer function
 */
const createDefaultDeserialize = <T>(defaultValue: T): ((value: string) => T) => {
  return (value: string): T => {
    if (typeof defaultValue === 'string') {
      return value as T;
    }
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[useFieldSync] Deserialization failed:', error);
      return defaultValue;
    }
  };
};

/**
 * Hook for generic field synchronization with local-first architecture
 *
 * Provides instant local updates with background sync to Supabase. Changes
 * are saved locally immediately (<10ms) and synced to remote in the background.
 * Automatically handles online/offline status and retries failed syncs.
 *
 * @template T - Type of the field value (can be string, number, array, object, etc.)
 * @param {UseFieldSyncConfig<T>} config - Configuration object
 * @returns {UseFieldSyncReturn<T>} Field state and controls
 *
 * @example
 * // String field
 * const { value, onChange, syncStatus } = useFieldSync({
 *   fieldIdentifier: 'brand-name',
 *   category: 'brand-basics',
 *   defaultValue: ''
 * });
 * // Use in input: <input value={value} onChange={(e) => onChange(e.target.value)} />
 *
 * @example
 * // Array field with custom serialization
 * const { value, onChange } = useFieldSync<string[]>({
 *   fieldIdentifier: 'target-audiences',
 *   category: 'brand-basics',
 *   defaultValue: [],
 *   debounceDelay: 1000 // Wait 1 second before saving
 * });
 *
 * @example
 * // Object field
 * interface BrandProfile {
 *   name: string;
 *   industry: string;
 * }
 *
 * const { value, onChange, isLoading, error } = useFieldSync<BrandProfile>({
 *   fieldIdentifier: 'brand-profile',
 *   category: 'brand-basics',
 *   defaultValue: { name: '', industry: '' }
 * });
 *
 * @example
 * // Using sync status
 * const { value, onChange, syncStatus, refresh } = useFieldSync({
 *   fieldIdentifier: 'description',
 *   category: 'brand-basics',
 *   defaultValue: ''
 * });
 *
 * // Show sync indicator
 * {syncStatus === 'syncing' && <Spinner />}
 * {syncStatus === 'offline' && <Badge>Offline</Badge>}
 *
 * // Manually refresh from remote
 * <button onClick={refresh}>Refresh</button>
 */
export function useFieldSync<T>({
  fieldIdentifier,
  category,
  defaultValue,
  debounceDelay = 500,
  serialize = defaultSerialize,
  deserialize
}: UseFieldSyncConfig<T>): UseFieldSyncReturn<T> {
  // Create deserialize function with defaultValue bound if not provided
  const deserializeFn = deserialize || createDefaultDeserialize(defaultValue);
  const [value, setValue] = useState<T>(defaultValue);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || '';

  // Refs for cleanup and debouncing
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const syncServiceRef = useRef(getFieldSyncService(DEFAULT_FIELD_SYNC_CONFIG));
  const cleanupSyncRef = useRef<(() => void) | null>(null);
  const cleanupConnectionRef = useRef<(() => void) | null>(null);

  /**
   * Load initial value from IndexedDB
   *
   * Loads from local IndexedDB first for instant UI. If no local value exists,
   * fetches from remote and caches locally.
   */
  const loadInitialValue = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const syncService = syncServiceRef.current;
      await syncService.initialize();

      // Load from local IndexedDB (instant)
      const storedValue = await syncService.loadField(userId, fieldIdentifier);

      if (!isMountedRef.current) return;

      if (storedValue !== null) {
        const deserialized = deserializeFn(storedValue);
        setValue(deserialized);
      } else {
        // No local value, try remote
        setSyncStatus('syncing');
        try {
          const remoteValue = await syncService.fetchFromRemote(userId, fieldIdentifier);

          if (!isMountedRef.current) return;

          if (remoteValue !== null) {
            const deserialized = deserializeFn(remoteValue);
            setValue(deserialized);
            // Save to local cache
            await syncService.saveField(
              userId,
              fieldIdentifier,
              remoteValue,
              category
            );
          } else {
            setValue(defaultValue);
          }
          setSyncStatus('synced');
        } catch (syncError) {
          console.error('[useFieldSync] Initial remote fetch failed:', syncError);
          setSyncStatus('offline');
          setValue(defaultValue);
        }
      }
    } catch (err) {
      console.error('[useFieldSync] Failed to load field:', err);
      setError(err instanceof Error ? err : new Error('Failed to load field'));
      setValue(defaultValue);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        hasLoadedRef.current = true;
      }
    }
  }, [userId, fieldIdentifier, category, defaultValue, deserializeFn]);

  /**
   * Save value locally and queue for sync
   *
   * Saves immediately to IndexedDB and queues background sync to Supabase.
   * Updates sync status via callback. Does not throw on sync errors.
   *
   * @param {T} newValue - New value to save
   */
  const saveValue = useCallback(async (newValue: T) => {
    if (!userId || !hasLoadedRef.current) {
      return;
    }

    try {
      const syncService = syncServiceRef.current;
      const serialized = serialize(newValue);

      // Save locally and queue for sync
      await syncService.saveField(
        userId,
        fieldIdentifier,
        serialized,
        category,
        (status) => {
          if (isMountedRef.current) {
            setSyncStatus(status);
          }
        }
      );
    } catch (err) {
      console.error('[useFieldSync] Failed to save field:', err);
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
   *
   * Updates local state immediately for responsive UI, then debounces
   * the actual save operation to reduce write operations.
   *
   * @param {T} newValue - New value
   */
  const handleChange = useCallback((newValue: T) => {
    // Update local state immediately for responsive UI
    setValue(newValue);

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce the save operation
    saveTimerRef.current = setTimeout(() => {
      saveValue(newValue);
    }, debounceDelay);
  }, [saveValue, debounceDelay]);

  /**
   * Refresh value from remote
   *
   * Fetches latest value from Supabase and updates local cache.
   * Useful for manual refresh or conflict resolution.
   */
  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      setSyncStatus('syncing');
      const syncService = syncServiceRef.current;
      const remoteValue = await syncService.fetchFromRemote(userId, fieldIdentifier);

      if (!isMountedRef.current) return;

      if (remoteValue !== null) {
        const deserialized = deserializeFn(remoteValue);
        setValue(deserialized);
        // Update local cache
        await syncService.saveField(userId, fieldIdentifier, remoteValue, category);
      }

      setSyncStatus('synced');
    } catch (err) {
      console.error('[useFieldSync] Refresh failed:', err);
      setSyncStatus('offline');
      setError(err instanceof Error ? err : new Error('Failed to refresh field'));
    }
  }, [userId, fieldIdentifier, category, deserializeFn]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    isMountedRef.current = true;
    loadInitialValue();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadInitialValue]);

  /**
   * Set up connection state listener
   */
  useEffect(() => {
    if (!userId) return;

    const syncService = syncServiceRef.current;

    // Listen for connection changes
    const unsubscribe = syncService.onConnectionChange((online) => {
      if (!isMountedRef.current) return;

      if (online) {
        // When coming back online, refresh from remote
        refresh();
      } else {
        setSyncStatus('offline');
      }
    });

    cleanupConnectionRef.current = unsubscribe;

    return () => {
      if (cleanupConnectionRef.current) {
        cleanupConnectionRef.current();
        cleanupConnectionRef.current = null;
      }
    };
  }, [userId, refresh]);

  /**
   * Set up periodic sync (optional - could be enabled via config)
   */
  useEffect(() => {
    if (!userId) return;

    const syncService = syncServiceRef.current;

    // Set up periodic sync every 30 seconds
    const cleanup = syncService.setupPeriodicSync(userId, 30000);
    cleanupSyncRef.current = cleanup;

    return () => {
      if (cleanupSyncRef.current) {
        cleanupSyncRef.current();
        cleanupSyncRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Clear any pending save timers
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
