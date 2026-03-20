/**
 * useFieldDatabaseSync Hook
 *
 * Synchronizes field values between local state and the database for avatar persistence.
 * Handles loading fields when switching avatars and saving field changes to the database.
 *
 * Features:
 * - Loads fields from database when avatar changes
 * - Auto-saves field changes with debouncing
 * - Migrates localStorage fields to database
 * - Respects field lock status
 */

import { useEffect, useCallback, useRef } from 'react';
import { FieldPersistenceService, FieldUpdate } from '@/services/field/FieldPersistenceService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseFieldDatabaseSyncProps {
  /** Current avatar ID */
  avatarId: string | null;
  /** Current field values */
  fieldValues: Record<string, string | string[]>;
  /** Field sources (ai or manual) */
  fieldSources: Record<string, 'ai' | 'manual'>;
  /** Callback to update field value in parent */
  onFieldLoad?: (fieldId: string, value: string, source: 'ai' | 'manual') => void;
  /** Enable auto-save to database */
  autoSave?: boolean;
  /** Debounce delay for auto-save (ms) */
  saveDebounceMs?: number;
}

interface UseFieldDatabaseSyncReturn {
  /** Manually trigger save to database */
  saveAllFields: () => Promise<void>;
  /** Load fields from database */
  loadFields: () => Promise<void>;
  /** Check if currently saving */
  isSaving: boolean;
  /** Check if currently loading */
  isLoading: boolean;
  /** Last sync timestamp */
  lastSyncTime: Date | null;
}

/**
 * Hook for synchronizing field values with the database
 */
export function useFieldDatabaseSync({
  avatarId,
  fieldValues,
  fieldSources,
  onFieldLoad,
  autoSave = true,
  saveDebounceMs = 1000,
}: UseFieldDatabaseSyncProps): UseFieldDatabaseSyncReturn {
  const fieldService = useRef(new FieldPersistenceService(supabase));
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedValues = useRef<Record<string, string | string[]>>({});
  const hasMigratedRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastSyncTimeRef = useRef<Date | null>(null);

  /**
   * Load fields from database for current avatar
   */
  const loadFields = useCallback(async () => {
    if (!avatarId) return;

    isLoadingRef.current = true;
    console.log(`[FieldSync] Loading fields for avatar: ${avatarId}`);

    try {
      const { data: fields, error } = await fieldService.current.loadFields(avatarId);

      if (error) {
        console.error('[FieldSync] Error loading fields:', error);
        toast.error('Failed to load saved fields');
        return;
      }

      if (fields && fields.length > 0) {
        console.log(`[FieldSync] Loaded ${fields.length} fields from database`);

        // Update parent component with loaded fields
        fields.forEach(field => {
          if (field.field_value && onFieldLoad) {
            onFieldLoad(
              field.field_id,
              field.field_value,
              field.field_source as 'ai' | 'manual'
            );
          }
        });

        // Update last saved values to prevent immediate re-save
        const loadedValues: Record<string, string> = {};
        fields.forEach(field => {
          if (field.field_value) {
            loadedValues[field.field_id] = field.field_value;
          }
        });
        lastSavedValues.current = loadedValues;
      } else {
        console.log('[FieldSync] No existing fields found for avatar');
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [avatarId, onFieldLoad]);

  /**
   * Save all current fields to database
   */
  const saveAllFields = useCallback(async () => {
    if (!avatarId) return;

    isSavingRef.current = true;
    console.log(`[FieldSync] Saving fields for avatar: ${avatarId}`);

    try {
      // Prepare batch update
      const fieldsToSave: FieldUpdate[] = [];

      Object.entries(fieldValues).forEach(([fieldId, value]) => {
        // Convert arrays to string for storage
        const stringValue = Array.isArray(value) ? value.join('\n') : value;

        // Only save if value has changed
        const lastSaved = lastSavedValues.current[fieldId];
        const lastSavedString = Array.isArray(lastSaved) ? lastSaved.join('\n') : lastSaved;

        if (stringValue !== lastSavedString && stringValue.trim() !== '') {
          fieldsToSave.push({
            field_id: fieldId,
            field_value: stringValue,
            field_source: fieldSources[fieldId] || 'manual',
          });
        }
      });

      if (fieldsToSave.length === 0) {
        console.log('[FieldSync] No changes to save');
        return;
      }

      const { data, error } = await fieldService.current.batchSaveFields({
        avatar_id: avatarId,
        fields: fieldsToSave,
      });

      if (error) {
        console.error('[FieldSync] Error saving fields:', error);
        toast.error('Failed to save fields');
        return;
      }

      console.log(`[FieldSync] Successfully saved ${fieldsToSave.length} fields`);

      // Update last saved values
      fieldsToSave.forEach(field => {
        if (field.field_value) {
          lastSavedValues.current[field.field_id] = field.field_value;
        }
      });

      lastSyncTimeRef.current = new Date();

      // Also sync to localStorage for backward compatibility
      fieldService.current.syncWithLocalStorage(avatarId, data || []);
    } finally {
      isSavingRef.current = false;
    }
  }, [avatarId, fieldValues, fieldSources]);

  /**
   * Debounced save function
   */
  const debouncedSave = useCallback(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveAllFields();
    }, saveDebounceMs);
  }, [saveAllFields, saveDebounceMs]);

  /**
   * Migrate fields from localStorage if needed
   */
  const migrateFromLocalStorage = useCallback(async () => {
    if (!avatarId || hasMigratedRef.current.has(avatarId)) return;

    console.log(`[FieldSync] Checking for localStorage migration for avatar: ${avatarId}`);

    try {
      const { migrated, error } = await fieldService.current.migrateFromLocalStorage(avatarId);

      if (error) {
        console.error('[FieldSync] Migration error:', error);
      } else if (migrated > 0) {
        console.log(`[FieldSync] Migrated ${migrated} fields from localStorage`);
        toast.success(`Restored ${migrated} saved fields`);

        // Reload fields after migration
        await loadFields();
      }

      hasMigratedRef.current.add(avatarId);
    } catch (error) {
      console.error('[FieldSync] Migration failed:', error);
    }
  }, [avatarId, loadFields]);

  // Load fields when avatar changes
  useEffect(() => {
    if (!avatarId) return;

    // Load fields from database
    loadFields();

    // Check for localStorage migration
    migrateFromLocalStorage();
  }, [avatarId]); // Intentionally not including loadFields and migrateFromLocalStorage

  // Auto-save fields when they change
  useEffect(() => {
    if (!autoSave || !avatarId) return;

    // Check if any values have actually changed
    const hasChanges = Object.entries(fieldValues).some(([fieldId, value]) => {
      const lastSaved = lastSavedValues.current[fieldId];
      const currentString = Array.isArray(value) ? value.join('\n') : value;
      const lastSavedString = Array.isArray(lastSaved) ? lastSaved.join('\n') : lastSaved;
      return currentString !== lastSavedString;
    });

    if (hasChanges) {
      debouncedSave();
    }
  }, [fieldValues, fieldSources, autoSave, avatarId, debouncedSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Save immediately on unmount if there are pending changes
        saveAllFields();
      }
    };
  }, [saveAllFields]);

  return {
    saveAllFields,
    loadFields,
    isSaving: isSavingRef.current,
    isLoading: isLoadingRef.current,
    lastSyncTime: lastSyncTimeRef.current,
  };
}