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
  onFieldsLoaded?: (fields: Record<string, { value: string; isLocked: boolean }>) => void;
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

  // Track save timeouts per field for cleanup on unmount
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Keep a stable ref to fieldValues for use inside the logging interval
  const fieldValuesRef = useRef(fieldValues);
  fieldValuesRef.current = fieldValues;

  // Reset hasLoadedInitial when avatarId changes so fields reload for the new avatar
  const prevAvatarId = useRef<string | null>(null);
  useEffect(() => {
    if (prevAvatarId.current !== null && prevAvatarId.current !== avatarId) {
      hasLoadedInitial.current = false;
      lastSavedValues.current = {};
    }
    prevAvatarId.current = avatarId;
  }, [avatarId]);

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

          // Convert to object with value + lock state for callback
          const loadedFields: Record<string, { value: string; isLocked: boolean }> = {};
          fields.forEach(field => {
            if (field.field_value) {
              loadedFields[field.field_id] = {
                value: field.field_value,
                isLocked: field.is_locked,
              };
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
              const loadedFields: Record<string, { value: string; isLocked: boolean }> = {};
              migratedFields.forEach(field => {
                if (field.field_value) {
                  loadedFields[field.field_id] = {
                    value: field.field_value,
                    isLocked: field.is_locked,
                  };
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
        // Debounce rapid changes — clear any pending save for this field first
        const existing = saveTimeouts.current.get(fieldId);
        if (existing) clearTimeout(existing);
        const id = setTimeout(() => {
          saveField(fieldId, stringValue, source);
          saveTimeouts.current.delete(fieldId);
        }, 500);
        saveTimeouts.current.set(fieldId, id);
      }
    });

    // Capture the Map reference for cleanup (avoids stale-ref lint warning)
    const timeouts = saveTimeouts.current;
    return () => {
      timeouts.forEach(id => clearTimeout(id));
      timeouts.clear();
    };
  }, [fieldValues, fieldSources, avatarId, saveField]);

  /**
   * Log summary of field sync status (stable interval — no fieldValues dep)
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const savedCount = Object.keys(lastSavedValues.current).length;
      const currentCount = Object.keys(fieldValuesRef.current).length;

      if (savedCount > 0 || currentCount > 0) {
        console.log(`[FieldSync] Status: ${savedCount} fields saved, ${currentCount} fields in UI`);
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(interval);
  }, []); // stable — fieldValues accessed via ref

  return {
    saveField,
    savedFieldCount: Object.keys(lastSavedValues.current).length,
  };
}