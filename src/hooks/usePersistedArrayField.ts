/**
 * usePersistedArrayField Hook
 * Array-specific wrapper around usePersistedField for managing persisted string arrays
 */

import { useCallback } from 'react';
import { usePersistedField } from './usePersistedField';
import type { KnowledgeCategory, SyncStatus } from '@/lib/knowledge-base/interfaces';

/**
 * Configuration for the persisted array field hook
 */
export interface UsePersistedArrayFieldConfig {
  fieldIdentifier: string;
  category: KnowledgeCategory;
  defaultValue?: string[];
  debounceDelay?: number;
}

/**
 * Return type for the persisted array field hook
 */
export interface UsePersistedArrayFieldReturn {
  value: string[];
  add: (item: string) => void;
  remove: (index: number) => void;
  set: (items: string[]) => void;
  syncStatus: SyncStatus;
  isLoading: boolean;
}

/**
 * Hook for persisted array fields
 * Stores arrays with automatic JSON serialization
 *
 * @example
 * const { value, add, remove } = usePersistedArrayField({
 *   fieldIdentifier: 'target-audiences',
 *   category: 'brand-basics',
 *   defaultValue: []
 * });
 *
 * // Add an item
 * add('Small business owners');
 *
 * // Remove an item by index
 * remove(0);
 *
 * // Set entire array
 * set(['Audience 1', 'Audience 2']);
 */
export function usePersistedArrayField({
  fieldIdentifier,
  category,
  defaultValue = [],
  debounceDelay = 500
}: UsePersistedArrayFieldConfig): UsePersistedArrayFieldReturn {
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
