/**
 * useFieldLocking Hook - Field lock state management
 *
 * Manages the lock/unlock state for fields to prevent AI overwrites.
 * Persists lock state to localStorage via FieldValueStorageService.
 *
 * Extracted from useFieldExtraction to separate locking concerns
 * from field value management and extraction orchestration.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  loadFieldLocks,
  saveFieldLocks,
} from '@/services/field/FieldValueStorageService';

// ============================================================================
// Types
// ============================================================================

export interface UseFieldLockingReturn {
  /** The current set of locked field IDs */
  lockedFields: Set<string>;
  /** Always-current ref to locked fields (avoids stale closures) */
  lockedFieldsRef: React.RefObject<Set<string>>;
  /** Lock or unlock a field, with optional silent mode (no toast) */
  setFieldLock: (fieldId: string, locked: boolean, silent?: boolean) => void;
  /** Check if a specific field is locked (reads from ref, stable identity) */
  isFieldLocked: (fieldId: string) => boolean;
  /** Directly replace locked fields state (used for realtime sync) */
  setLockedFields: React.Dispatch<React.SetStateAction<Set<string>>>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manages field locking state with localStorage persistence.
 *
 * @param avatarId - Resolved avatar ID (never null) for scoping lock storage
 */
export function useFieldLocking(resolvedAvatarId: string): UseFieldLockingReturn {
  const [lockedFields, setLockedFields] = useState<Set<string>>(() => {
    return loadFieldLocks(resolvedAvatarId);
  });

  // Always-current ref for reading in callbacks without stale closures
  const lockedFieldsRef = useRef(lockedFields);
  lockedFieldsRef.current = lockedFields;

  // Reload locks when avatar changes
  useEffect(() => {
    const locks = loadFieldLocks(resolvedAvatarId);
    setLockedFields(locks);
  }, [resolvedAvatarId]);

  // Lock or unlock a field with optional toast notification
  const setFieldLock = useCallback(
    (fieldId: string, locked: boolean, silent = false): void => {
      setLockedFields(prev => {
        const updated = new Set(prev);
        if (locked) {
          updated.add(fieldId);
          if (!silent) toast.info(`Field locked: AI won't overwrite this value`);
        } else {
          updated.delete(fieldId);
          if (!silent) toast.info(`Field unlocked: AI can update this value`);
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

  return {
    lockedFields,
    lockedFieldsRef,
    setFieldLock,
    isFieldLocked,
    setLockedFields,
  };
}
