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
      console.error('[useFieldSync] Deserialization failed:', error);
      return defaultValue;
    }
  };
};

/**
 * Hook for generic field synchronization with local-first architecture
 * Provides instant local updates with background sync to Supabase
 *
 * @example
 * // String field
 * const { value, onChange } = useFieldSync({
 *   fieldIdentifier: 'brand-name',
 *   category: 'brand-basics',
 *   defaultValue: ''
 * });
 *
 * @example
 * // Array field
 * const { value, onChange } = useFieldSync<string[]>({
 *   fieldIdentifier: 'target-audiences',
 *   category: 'brand-basics',
 *   defaultValue: []
 * });
 *
 * @example
 * // Object field
 * const { value, onChange } = useFieldSync<BrandProfile>({
 *   fieldIdentifier: 'brand-profile',
 *   category: 'brand-basics',
 *   defaultValue: { name: '', industry: '' }
 * });
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
