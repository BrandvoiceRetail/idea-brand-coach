/**
 * usePersistedArrayField Hook
 * Array-specific wrapper around usePersistedField for managing persisted string arrays
 */

import { useCallback, useMemo } from 'react';
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
 * Stores arrays as JSON strings with parsing/serialization
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
  const field = usePersistedField({
    fieldIdentifier,
    category,
    defaultValue: JSON.stringify(defaultValue),
    debounceDelay
  });

  // Parse the stored JSON string to array
  const value: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(field.value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [field.value]);

  const add = useCallback((item: string) => {
    if (item.trim() && !value.includes(item.trim())) {
      field.onChange(JSON.stringify([...value, item.trim()]));
    }
  }, [value, field]);

  const remove = useCallback((index: number) => {
    field.onChange(JSON.stringify(value.filter((_, i) => i !== index)));
  }, [value, field]);

  const set = useCallback((items: string[]) => {
    field.onChange(JSON.stringify(items));
  }, [field]);

  return {
    value,
    add,
    remove,
    set,
    syncStatus: field.syncStatus,
    isLoading: field.isLoading
  };
}
