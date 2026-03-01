/**
 * useFieldHistory Hook
 * Fetches and manages version history for persisted fields
 * Following patterns from usePersistedField.ts
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { KnowledgeRepository } from '@/lib/knowledge-base/knowledge-repository';
import type { KnowledgeEntry } from '@/lib/knowledge-base/interfaces';
import type { FieldHistoryEntry } from '@/types/field-metadata';

/**
 * Configuration for the field history hook
 */
interface UseFieldHistoryConfig {
  fieldIdentifier: string;
  enabled?: boolean; // Whether to automatically fetch history (default: true)
}

/**
 * Return type for the field history hook
 */
interface UseFieldHistoryReturn {
  history: FieldHistoryEntry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Singleton repository instance (shared with usePersistedField)
let repository: KnowledgeRepository | null = null;

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
 * Transform KnowledgeEntry to FieldHistoryEntry
 */
function transformToHistoryEntry(entry: KnowledgeEntry): FieldHistoryEntry {
  return {
    id: entry.id,
    value: entry.content,
    metadata: {
      editSource: entry.metadata?.editSource || 'manual',
      editedAt: entry.updatedAt,
      editedBy: entry.userId,
      validationState: undefined // Validation state not stored in history
    },
    timestamp: entry.updatedAt,
    isCurrentVersion: entry.isCurrentVersion
  };
}

/**
 * Hook for fetching field version history
 * Provides access to all versions of a field with metadata
 */
export function useFieldHistory({
  fieldIdentifier,
  enabled = true
}: UseFieldHistoryConfig): UseFieldHistoryReturn {
  const [history, setHistory] = useState<FieldHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const { user } = useAuth();
  const userId = user?.id || '';

  // Refs for cleanup
  const repositoryRef = useRef<KnowledgeRepository | null>(null);
  const isMountedRef = useRef<boolean>(true);

  /**
   * Fetch field history from repository
   */
  const fetchHistory = useCallback(async () => {
    if (!userId || !enabled) {
      return;
    }

    // Set loading state
    setIsLoading(true);
    setError(null);

    try {
      const repo = await getRepository();
      repositoryRef.current = repo;

      // Get all versions for this field
      const entries = await repo.getFieldHistory(userId, fieldIdentifier);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        // Transform to FieldHistoryEntry format
        const historyEntries = entries.map(transformToHistoryEntry);
        setHistory(historyEntries);
      }
    } catch (err) {
      console.error('Failed to fetch field history:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch history'));
        setHistory([]); // Clear history on error
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [userId, fieldIdentifier, enabled]);

  /**
   * Refresh history manually
   */
  const refresh = useCallback(async () => {
    await fetchHistory();
  }, [fetchHistory]);

  /**
   * Load history on mount and when dependencies change
   */
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    history,
    isLoading,
    error,
    refresh
  };
}
