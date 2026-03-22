/**
 * useFieldExtraction Hook - Unified Version
 *
 * Complete field extraction system with ALL features in one place:
 * - Robust JSON parsing with truncation recovery (via fieldExtractionParser)
 * - Field locking to prevent AI overwrites
 * - Manual field editing with source tracking
 * - Automatic persistence to localStorage
 * - Toast notifications for user feedback
 *
 * No more V1 vs V2 confusion - this is THE field extraction hook!
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { parseFieldExtraction } from '@/utils/fieldExtractionParser';
import { supabase } from '@/integrations/supabase/client';

// Re-export for consumers that import parseFieldExtraction from this module
export { parseFieldExtraction } from '@/utils/fieldExtractionParser';
export type { ExtractFieldsResult } from '@/utils/fieldExtractionParser';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = 'v2_field_values_';
const LOCK_STORAGE_PREFIX = 'v2_field_locks_';

// ============================================================================
// Types
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
  setFieldManual: (fieldId: string, value: string | string[]) => void;
  clearFields: () => void;

  // Field locking (no longer in separate V2!)
  setFieldLock: (fieldId: string, locked: boolean) => void;
  isFieldLocked: (fieldId: string) => boolean;

  // Stats
  extractedCount: number;
}

// ============================================================================
// Storage Functions - Persistence for values and locks
// ============================================================================

function loadFieldValues(avatarId: string): FieldValuesStore {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return {};

    const parsed = JSON.parse(stored);

    if (typeof parsed !== 'object') {
      console.warn('[Field Storage] Invalid stored data, resetting');
      return {};
    }

    return parsed as FieldValuesStore;
  } catch (error) {
    console.error('[Field Storage] Load failed:', error);
    return {};
  }
}

function saveFieldValues(avatarId: string, values: FieldValuesStore): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error('[Field Storage] Save failed:', error);
  }
}

function loadFieldLocks(avatarId: string): Set<string> {
  try {
    const key = `${LOCK_STORAGE_PREFIX}${avatarId}`;
    const stored = localStorage.getItem(key);

    if (!stored) return new Set();

    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error('[Field Locks] Load failed:', error);
    return new Set();
  }
}

function saveFieldLocks(avatarId: string, locks: Set<string>): void {
  try {
    const key = `${LOCK_STORAGE_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify([...locks]));
  } catch (error) {
    console.error('[Field Locks] Save failed:', error);
  }
}

// ============================================================================
// THE ONE HOOK - Complete unified interface
// ============================================================================

/**
 * THE Field Extraction Hook - All features in one place!
 *
 * No more V1 vs V2 confusion. This hook has everything:
 * - Robust extraction with recovery strategies
 * - Field locking to prevent AI overwrites
 * - Manual editing with source tracking
 * - Automatic persistence
 * - Toast notifications
 *
 * @param avatarId - Avatar ID for scoping (null = 'default')
 */
export function useFieldExtraction(avatarId: string | null): UseFieldExtractionReturn {
  const resolvedAvatarId = avatarId || 'default';

  // Field values with source tracking
  const [fieldValues, setFieldValues] = useState<FieldValuesStore>(() => {
    return loadFieldValues(resolvedAvatarId);
  });

  // Locked fields that can't be overwritten by AI
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => {
    return loadFieldLocks(resolvedAvatarId);
  });

  // Count of AI-extracted fields
  const [extractedCount, setExtractedCount] = useState(0);

  // Always-current refs — reading these in callbacks avoids stale closures
  // without adding fieldValues/lockedFields as deps (which would cause cascading re-runs)
  const fieldValuesRef = useRef(fieldValues);
  fieldValuesRef.current = fieldValues;

  const lockedFieldsRef = useRef(lockedFields);
  lockedFieldsRef.current = lockedFields;

  // Dedicated persistence effect — replaces saveFieldValues calls inside callbacks
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

  // Set field value manually — functional setState so no stale closure on fieldValues
  const setFieldManual = useCallback((fieldId: string, value: string | string[]): void => {
    const normalizedValue = Array.isArray(value) ? value.join('\n') : value;
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: {
        value: normalizedValue,
        source: 'manual' as FieldSource,
        timestamp: new Date().toISOString(),
      },
    }));
    // persistence handled by dedicated useEffect
  }, []);

  // Lock or unlock a field — functional setState so no stale closure on lockedFields
  const setFieldLock = useCallback(
    (fieldId: string, locked: boolean): void => {
      setLockedFields(prev => {
        const updated = new Set(prev);
        if (locked) {
          updated.add(fieldId);
          toast.info(`Field locked: AI won't overwrite this value`);
        } else {
          updated.delete(fieldId);
          toast.info(`Field unlocked: AI can update this value`);
        }
        saveFieldLocks(resolvedAvatarId, updated);
        return updated;
      });
    },
    [resolvedAvatarId]
  );

  // Check if field is locked — reads from always-current ref, truly stable
  const isFieldLocked = useCallback((fieldId: string): boolean => {
    return lockedFieldsRef.current.has(fieldId);
  }, []);

  // Clear all fields
  const clearFields = useCallback((): void => {
    setFieldValues({});
    saveFieldValues(resolvedAvatarId, {});
    console.log('[Field Extraction] Cleared all fields');
  }, [resolvedAvatarId]);

  // Sync when avatar changes
  useEffect(() => {
    const values = loadFieldValues(resolvedAvatarId);
    const locks = loadFieldLocks(resolvedAvatarId);
    setFieldValues(values);
    setLockedFields(locks);
  }, [resolvedAvatarId]);

  // Subscribe to realtime updates from avatar_field_values table
  // This enables auto-population when document extraction completes
  useEffect(() => {
    // Skip if no real avatar ID (using 'default')
    if (!avatarId || avatarId === 'default') {
      return;
    }

    // Skip if supabase.channel is not available (e.g., in tests)
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
  }, [avatarId, resolvedAvatarId]);

  return {
    extractFields,
    fieldValues: flatFieldValues,
    fieldSources,
    fieldMetadata,
    setFieldManual,
    clearFields,
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
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${avatarId}`);
  } catch (error) {
    console.error('[Field Storage] Clear failed:', error);
  }
}
