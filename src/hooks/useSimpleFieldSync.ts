/**
 * useSimpleFieldSync - Simplified field database sync for single avatar
 *
 * Automatically saves field changes to database as they occur during chat.
 * Designed for single avatar per account workflow.
 */

import { useEffect, useCallback, useRef } from 'react';
import { FieldPersistenceService } from '@/services/field/FieldPersistenceService';
import { supabase } from '@/integrations/supabase/client';

interface UseSimpleFieldSyncProps {
  /** The single avatar ID for this user */
  avatarId: string | null;
  /** Current field values from the UI */
  fieldValues: Record<string, string | string[]>;
  /** Source of each field (ai or manual) */
  fieldSources: Record<string, 'ai' | 'manual'>;
  /** Optional callback when fields are loaded from DB */
  onFieldsLoaded?: (fields: Record<string, string>) => void;
}

export function useSimpleFieldSync({
  avatarId,
  fieldValues,
  fieldSources,
  onFieldsLoaded,
}: UseSimpleFieldSyncProps) {
  const fieldService = useRef(new FieldPersistenceService(supabase));
  const lastSavedValues = useRef<Record<string, string>>({});
  const hasLoadedInitial = useRef(false);
  // Store callback in ref to avoid re-running effects when it changes
  const onFieldsLoadedRef = useRef(onFieldsLoaded);
  onFieldsLoadedRef.current = onFieldsLoaded;

  /**
   * Save a single field to database
   */
  const saveField = useCallback(async (fieldId: string, value: string, source: 'ai' | 'manual') => {
    if (!avatarId || !value || !value.trim()) return;

    // Skip if value hasn't changed
    if (lastSavedValues.current[fieldId] === value) {
      return;
    }

    try {
      const { error } = await fieldService.current.saveField(avatarId, {
        field_id: fieldId,
        field_value: value,
        field_source: source,
        is_locked: source === 'manual', // Lock manual edits by default
      });

      if (!error) {
        lastSavedValues.current[fieldId] = value;
        console.log(`[FieldSync] ✓ Saved ${fieldId} (${source})`);
      } else {
        console.error(`[FieldSync] ✗ Failed to save ${fieldId}:`, error);
      }
    } catch (error) {
      console.error(`[FieldSync] ✗ Error saving ${fieldId}:`, error);
    }
  }, [avatarId]);

  /**
   * Load existing fields from database on mount
   */
  useEffect(() => {
    if (!avatarId || hasLoadedInitial.current) return;

    const loadFields = async () => {
      console.log('[FieldSync] Loading existing fields from database...');

      try {
        const { data: fields, error } = await fieldService.current.loadFields(avatarId);

        if (error) {
          console.error('[FieldSync] Error loading fields:', error);
          return;
        }

        if (fields && fields.length > 0) {
          console.log(`[FieldSync] Loaded ${fields.length} fields from database`);

          // Convert to simple object for callback
          const loadedFields: Record<string, string> = {};
          fields.forEach(field => {
            if (field.field_value) {
              loadedFields[field.field_id] = field.field_value;
              lastSavedValues.current[field.field_id] = field.field_value;
            }
          });

          // Notify parent component if callback provided
          if (onFieldsLoadedRef.current) {
            onFieldsLoadedRef.current(loadedFields);
          }

          // Also sync to localStorage for backward compatibility
          fieldService.current.syncWithLocalStorage(avatarId, fields);
        } else {
          console.log('[FieldSync] No existing fields found');

          // Try to migrate from localStorage if this is first load
          const { migrated } = await fieldService.current.migrateFromLocalStorage(avatarId);
          if (migrated > 0) {
            console.log(`[FieldSync] Migrated ${migrated} fields from localStorage`);
            // Reload after migration
            const { data: migratedFields } = await fieldService.current.loadFields(avatarId);
            if (migratedFields && onFieldsLoadedRef.current) {
              const loadedFields: Record<string, string> = {};
              migratedFields.forEach(field => {
                if (field.field_value) {
                  loadedFields[field.field_id] = field.field_value;
                }
              });
              onFieldsLoadedRef.current(loadedFields);
            }
          }
        }

        hasLoadedInitial.current = true;
      } catch (error) {
        console.error('[FieldSync] Failed to load fields:', error);
      }
    };

    loadFields();
  }, [avatarId]); // onFieldsLoaded accessed via ref to prevent infinite loops

  /**
   * Watch for field value changes and save them
   */
  useEffect(() => {
    if (!avatarId || !hasLoadedInitial.current) return;

    // Process each field
    Object.entries(fieldValues).forEach(([fieldId, value]) => {
      // Convert arrays to strings for storage
      const stringValue = Array.isArray(value) ? value.join('\n') : value;
      const source = fieldSources[fieldId] || 'manual';

      // Save if value exists and has changed
      if (stringValue && stringValue.trim() && lastSavedValues.current[fieldId] !== stringValue) {
        // Use setTimeout to debounce rapid changes
        setTimeout(() => {
          saveField(fieldId, stringValue, source);
        }, 500);
      }
    });
  }, [fieldValues, fieldSources, avatarId, saveField]);

  /**
   * Log summary of field sync status
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const savedCount = Object.keys(lastSavedValues.current).length;
      const currentCount = Object.keys(fieldValues).length;

      if (savedCount > 0 || currentCount > 0) {
        console.log(`[FieldSync] Status: ${savedCount} fields saved, ${currentCount} fields in UI`);
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(interval);
  }, [fieldValues]);

  return {
    saveField,
    savedFieldCount: Object.keys(lastSavedValues.current).length,
  };
}