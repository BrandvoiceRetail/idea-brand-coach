/**
 * usePersistedForm Hook
 * Batch field persistence for forms with multiple fields
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getRepository, getSyncService } from './usePersistedField';
import type { KnowledgeCategory, SyncStatus } from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for a single form field
 */
interface PersistedFormFieldConfig {
  identifier: string;
  category: KnowledgeCategory;
  defaultValue?: string;
}

/**
 * Return type for the persisted form hook
 */
interface UsePersistedFormReturn {
  values: Record<string, string>;
  setValues: (newValues: Record<string, string>) => Promise<void>;
  syncStatus: SyncStatus;
  isLoading: boolean;
}

/**
 * Hook for batch persisted fields
 * Useful for forms with multiple fields
 *
 * @example
 * const { values, setValues, syncStatus, isLoading } = usePersistedForm([
 *   { identifier: 'brand-name', category: 'brand-basics', defaultValue: '' },
 *   { identifier: 'brand-tagline', category: 'brand-basics', defaultValue: '' },
 * ]);
 *
 * // Read a value
 * console.log(values['brand-name']);
 *
 * // Save all values
 * await setValues({ 'brand-name': 'Acme', 'brand-tagline': 'We do it all' });
 */
export function usePersistedForm(
  fields: Array<PersistedFormFieldConfig>
): UsePersistedFormReturn {
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
