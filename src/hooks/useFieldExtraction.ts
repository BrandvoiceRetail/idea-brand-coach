/**
 * useFieldExtraction Hook - Unified Orchestrator
 *
 * Composes extracted concerns into the complete field extraction system:
 * - FieldValueStorageService: localStorage persistence for values and locks
 * - useFieldLocking: Lock/unlock state management
 * - parseFieldExtraction: Robust JSON parsing with truncation recovery
 *
 * This hook is the public API — same parameters and return type as before.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { parseFieldExtraction } from '@/utils/fieldExtractionParser';
import { supabase } from '@/integrations/supabase/client';
import {
  loadFieldValues,
  saveFieldValues,
  clearFieldValues as clearStoredFieldValuesInternal,
} from '@/services/field/FieldValueStorageService';
import {
  saveFieldLocks,
} from '@/services/field/FieldValueStorageService';
import { useFieldLocking } from '@/hooks/useFieldLocking';
import { FieldPersistenceService, FieldUpdate } from '@/services/field/FieldPersistenceService';

// Re-export for consumers that import parseFieldExtraction from this module
export { parseFieldExtraction } from '@/utils/fieldExtractionParser';
export type { ExtractFieldsResult } from '@/utils/fieldExtractionParser';

// ============================================================================
// Types (unchanged public API)
// ============================================================================

export type FieldSource = 'ai' | 'manual';

export interface FieldValue {
  value: string;
  source: FieldSource;
  timestamp: string;
}

export type FieldValuesStore = Record<string, FieldValue>;

/**
 * Complete field metadata including lock state
 */
export interface FieldMetadata {
  value: string | string[];
  source: FieldSource;
  isLocked: boolean;
  timestamp?: string;
}

/**
 * Options for DB persistence when saving a field
 */
export interface SaveFieldDbOptions {
  confidence_score?: number;
  chapter_id?: string;
}

/**
 * Complete unified hook return type with ALL features
 */
export interface UseFieldExtractionReturn {
  // Core extraction
  extractFields: (rawResponse: string) => string;

  // Field values and metadata
  fieldValues: Record<string, string | string[]>;
  fieldSources: Record<string, FieldSource>;
  fieldMetadata: Record<string, FieldMetadata>;

  // Field manipulation
  setFieldManual: (fieldId: string, value: string | string[], dbOptions?: SaveFieldDbOptions) => void;
  clearFields: () => void;

  // Batch DB persistence (for Accept All operations)
  batchSaveFieldsToDb: (fields: Array<FieldUpdate & { fieldId?: string }>) => Promise<void>;

  // Field locking
  setFieldLock: (fieldId: string, locked: boolean, silent?: boolean) => void;
  isFieldLocked: (fieldId: string) => boolean;

  // Stats
  extractedCount: number;
}

// ============================================================================
// THE ONE HOOK - Orchestrator composing extracted concerns
// ============================================================================

/**
 * THE Field Extraction Hook - All features in one place!
 *
 * Composes:
 * - FieldValueStorageService for localStorage persistence
 * - useFieldLocking for lock state management
 * - parseFieldExtraction for robust AI response parsing
 *
 * @param avatarId - Avatar ID for scoping (null = 'default')
 */
export function useFieldExtraction(avatarId: string | null): UseFieldExtractionReturn {
  const resolvedAvatarId = avatarId || 'default';
  const hasRealAvatar = !!avatarId && avatarId !== 'default';

  // --- FieldPersistenceService for DB writes ---
  const fieldServiceRef = useRef(new FieldPersistenceService(supabase));

  // --- Field locking (delegated to extracted hook) ---
  const {
    lockedFields,
    lockedFieldsRef,
    setFieldLock,
    isFieldLocked,
    setLockedFields,
  } = useFieldLocking(resolvedAvatarId);

  // --- Field values with source tracking ---
  const [fieldValues, setFieldValues] = useState<FieldValuesStore>(() => {
    return loadFieldValues(resolvedAvatarId);
  });

  // Count of AI-extracted fields
  const [extractedCount, setExtractedCount] = useState(0);

  // Always-current ref for fieldValues — avoids stale closures in callbacks
  const fieldValuesRef = useRef(fieldValues);
  fieldValuesRef.current = fieldValues;

  // Track whether DB load has been attempted for this avatar to avoid re-fetching
  const dbLoadedForAvatarRef = useRef<string | null>(null);

  // Dedicated persistence effect — saves fieldValues to localStorage on change
  useEffect(() => {
    saveFieldValues(resolvedAvatarId, fieldValues);
  }, [fieldValues, resolvedAvatarId]);

  // Transform to flat values for components
  const flatFieldValues = useMemo(() => {
    const values: Record<string, string | string[]> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      values[key] = field.value;
    });
    return values;
  }, [fieldValues]);

  // Extract sources for display
  const fieldSources = useMemo(() => {
    const sources: Record<string, FieldSource> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      sources[key] = field.source;
    });
    return sources;
  }, [fieldValues]);

  // Build complete metadata
  const fieldMetadata = useMemo(() => {
    const metadata: Record<string, FieldMetadata> = {};
    Object.entries(fieldValues).forEach(([key, field]) => {
      metadata[key] = {
        value: field.value,
        source: field.source,
        isLocked: lockedFields.has(key),
        timestamp: field.timestamp,
      };
    });
    return metadata;
  }, [fieldValues, lockedFields]);

  // Update extracted count when sources change
  useEffect(() => {
    const aiFieldCount = Object.values(fieldSources).filter(s => s === 'ai').length;
    setExtractedCount(aiFieldCount);
  }, [fieldSources]);

  // Extract and process fields from AI response
  const extractFields = useCallback((rawResponse: string): string => {
    const result = parseFieldExtraction(rawResponse);

    if (result.success && result.extractedFields) {
      const currentValues = fieldValuesRef.current;
      const currentLocked = lockedFieldsRef.current;
      const updates: FieldValuesStore = { ...currentValues };
      const skippedFields: string[] = [];
      const appliedFields: string[] = [];

      // Process each extracted field
      for (const [fieldId, value] of Object.entries(result.extractedFields)) {
        // Skip if field is locked
        if (currentLocked.has(fieldId)) {
          skippedFields.push(fieldId);
          console.log(`[Field Extraction] Skipped locked field: ${fieldId}`);
        } else if (!updates[fieldId] || updates[fieldId].value !== value) {
          // Update if new or different
          updates[fieldId] = {
            value,
            source: 'ai',
            timestamp: new Date().toISOString(),
          };
          appliedFields.push(fieldId);
        }
      }

      // Apply updates if any — persistence handled by dedicated useEffect
      if (appliedFields.length > 0) {
        setFieldValues(updates);

        // Persist AI-extracted fields to DB
        if (hasRealAvatar && appliedFields.length > 0) {
          const dbFields: FieldUpdate[] = appliedFields.map(fieldId => ({
            field_id: fieldId,
            field_value: updates[fieldId].value,
            field_source: 'ai' as const,
          }));
          fieldServiceRef.current.batchSaveFields({
            avatar_id: avatarId!,
            fields: dbFields,
          }).then(({ error }) => {
            if (error) {
              console.error('[Field Extraction] DB batch save for AI fields failed:', error.message);
            } else {
              console.log(`[Field Extraction] DB batch saved ${appliedFields.length} AI fields`);
            }
          });
        }
      }

      // Show user feedback via toasts
      if (appliedFields.length > 0 && skippedFields.length > 0) {
        toast.success(
          `Updated ${appliedFields.length} field${appliedFields.length !== 1 ? 's' : ''}. ` +
            `${skippedFields.length} locked field${skippedFields.length !== 1 ? 's' : ''} protected.`
        );
      } else if (appliedFields.length > 0) {
        toast.success(
          `Extracted ${appliedFields.length} field${appliedFields.length !== 1 ? 's' : ''} from response.`
        );
      } else if (skippedFields.length > 0) {
        toast.info(
          `All ${skippedFields.length} extracted field${skippedFields.length !== 1 ? 's were' : ' was'} locked. No updates made.`
        );
      }
    }

    return result.displayText;
  }, []);

  /**
   * Persist a single field to the DB (fire-and-forget).
   * Only attempts write when a real avatar ID is available.
   */
  const saveFieldToDb = useCallback((
    fieldId: string,
    value: string,
    source: FieldSource,
    options?: SaveFieldDbOptions,
  ): void => {
    if (!hasRealAvatar) return;

    fieldServiceRef.current.saveField(avatarId!, {
      field_id: fieldId,
      field_value: value,
      field_source: source,
      confidence_score: options?.confidence_score,
      chapter_id: options?.chapter_id,
    }).then(({ error }) => {
      if (error) {
        console.error(`[Field Extraction] DB save failed for ${fieldId}:`, error.message);
      } else {
        console.log(`[Field Extraction] DB saved field: ${fieldId} (source: ${source})`);
      }
    });
  }, [avatarId, hasRealAvatar]);

  /**
   * Batch save multiple fields to DB (for Accept All operations).
   * Only attempts write when a real avatar ID is available.
   */
  const batchSaveFieldsToDb = useCallback(async (
    fields: Array<FieldUpdate & { fieldId?: string }>,
  ): Promise<void> => {
    if (!hasRealAvatar || fields.length === 0) return;

    const { error } = await fieldServiceRef.current.batchSaveFields({
      avatar_id: avatarId!,
      fields,
    });

    if (error) {
      console.error('[Field Extraction] Batch DB save failed:', error.message);
    } else {
      console.log(`[Field Extraction] Batch DB saved ${fields.length} fields`);
    }
  }, [avatarId, hasRealAvatar]);

  // Set field value manually — functional setState so no stale closure on fieldValues
  const setFieldManual = useCallback((fieldId: string, value: string | string[], dbOptions?: SaveFieldDbOptions): void => {
    const normalizedValue = Array.isArray(value) ? value.join('\n') : value;
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: {
        value: normalizedValue,
        source: 'manual' as FieldSource,
        timestamp: new Date().toISOString(),
      },
    }));

    // Also persist to DB
    saveFieldToDb(fieldId, normalizedValue, 'manual', dbOptions);
  }, [saveFieldToDb]);

  // Clear all fields
  const clearFields = useCallback((): void => {
    setFieldValues({});
    saveFieldValues(resolvedAvatarId, {});
    console.log('[Field Extraction] Cleared all fields');
  }, [resolvedAvatarId]);

  // Sync when avatar changes — prefer DB data when avatar is available
  useEffect(() => {
    // Always load localStorage as immediate fallback
    const localValues = loadFieldValues(resolvedAvatarId);
    setFieldValues(localValues);

    // If real avatar, load from DB and merge (DB wins)
    if (hasRealAvatar && dbLoadedForAvatarRef.current !== avatarId) {
      dbLoadedForAvatarRef.current = avatarId;
      fieldServiceRef.current.loadFields(avatarId!).then(({ data: dbFields, error }) => {
        if (error || !dbFields || dbFields.length === 0) {
          if (error) console.error('[Field Extraction] DB load failed:', error.message);
          return;
        }

        console.log(`[Field Extraction] Loaded ${dbFields.length} fields from DB for avatar: ${avatarId}`);

        setFieldValues(prev => {
          const merged = { ...prev };
          for (const field of dbFields) {
            if (field.field_value !== null) {
              merged[field.field_id] = {
                value: field.field_value,
                source: (field.field_source as FieldSource) || 'ai',
                timestamp: field.updated_at || new Date().toISOString(),
              };
            }
          }
          return merged;
        });

        // Also update lock state from DB
        const dbLockedFields = dbFields.filter(f => f.is_locked).map(f => f.field_id);
        if (dbLockedFields.length > 0) {
          setLockedFields(prev => {
            const updated = new Set(prev);
            dbLockedFields.forEach(id => updated.add(id));
            saveFieldLocks(resolvedAvatarId, updated);
            return updated;
          });
        }
      });
    }
  }, [resolvedAvatarId, avatarId, hasRealAvatar, setLockedFields]);

  // Subscribe to realtime updates from avatar_field_values table
  useEffect(() => {
    if (!avatarId || avatarId === 'default') {
      return;
    }

    if (typeof supabase.channel !== 'function') {
      console.log('[Field Extraction] Realtime not available, skipping subscription');
      return;
    }

    console.log(`[Field Extraction] Subscribing to realtime updates for avatar: ${avatarId}`);

    const channel = supabase
      .channel(`avatar_fields_${avatarId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avatar_field_values',
          filter: `avatar_id=eq.${avatarId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const record = payload.new as {
              field_id: string;
              field_value: string;
              field_source: FieldSource;
              is_locked: boolean;
            };

            // Skip if field is locked locally
            if (lockedFieldsRef.current.has(record.field_id)) {
              console.log(`[Field Extraction] Realtime: Skipped locked field ${record.field_id}`);
              return;
            }

            // Update local state with the new value
            setFieldValues(prev => ({
              ...prev,
              [record.field_id]: {
                value: record.field_value,
                source: record.field_source || 'ai',
                timestamp: new Date().toISOString(),
              },
            }));

            // Update lock state if locked in database
            if (record.is_locked) {
              setLockedFields(prev => {
                const updated = new Set(prev);
                updated.add(record.field_id);
                saveFieldLocks(resolvedAvatarId, updated);
                return updated;
              });
            }

            console.log(`[Field Extraction] Realtime: Updated field ${record.field_id}`);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Field Extraction] Realtime subscription status: ${status}`);
      });

    return () => {
      console.log(`[Field Extraction] Unsubscribing from realtime updates for avatar: ${avatarId}`);
      supabase.removeChannel(channel);
    };
  }, [avatarId, resolvedAvatarId, lockedFieldsRef, setLockedFields]);

  return {
    extractFields,
    fieldValues: flatFieldValues,
    fieldSources,
    fieldMetadata,
    setFieldManual,
    clearFields,
    batchSaveFieldsToDb,
    setFieldLock,
    isFieldLocked,
    extractedCount,
  };
}

// ============================================================================
// Backward Compatibility - Can be removed after migration
// ============================================================================

/**
 * @deprecated Use useFieldExtraction instead - V2 is now unified into main hook
 */
export const useFieldExtractionV2 = useFieldExtraction;

/**
 * Exported storage helpers (test-facing aliases)
 */
export function getStoredFieldValues(avatarId: string): FieldValuesStore {
  return loadFieldValues(avatarId);
}

export function saveStoredFieldValues(avatarId: string, values: FieldValuesStore): void {
  saveFieldValues(avatarId, values);
}

export function clearStoredFieldValues(avatarId: string): void {
  clearStoredFieldValuesInternal(avatarId);
}
