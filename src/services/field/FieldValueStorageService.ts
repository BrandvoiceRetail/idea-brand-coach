/**
 * FieldValueStorageService - localStorage persistence for field values and locks
 *
 * Handles all localStorage interactions for the field extraction system:
 * - Load/save field values (keyed by avatar ID)
 * - Load/save field locks (keyed by avatar ID)
 * - Clear field values
 *
 * Extracted from useFieldExtraction hook to separate storage concerns
 * from React state management.
 */

// ============================================================================
// Types (duplicated here to avoid circular import with useFieldExtraction)
// ============================================================================

type FieldSource = 'ai' | 'manual';

interface FieldValue {
  value: string;
  source: FieldSource;
  timestamp: string;
}

type FieldValuesStore = Record<string, FieldValue>;

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = 'v2_field_values_';
const LOCK_STORAGE_PREFIX = 'v2_field_locks_';

// ============================================================================
// Field Value Storage
// ============================================================================

/**
 * Load field values from localStorage for a given avatar.
 * Returns an empty store on any failure.
 */
export function loadFieldValues(avatarId: string): FieldValuesStore {
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

/**
 * Save field values to localStorage for a given avatar.
 */
export function saveFieldValues(avatarId: string, values: FieldValuesStore): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error('[Field Storage] Save failed:', error);
  }
}

/**
 * Clear field values from localStorage for a given avatar.
 */
export function clearFieldValues(avatarId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${avatarId}`);
  } catch (error) {
    console.error('[Field Storage] Clear failed:', error);
  }
}

// ============================================================================
// Field Lock Storage
// ============================================================================

/**
 * Load locked field IDs from localStorage for a given avatar.
 * Returns an empty Set on any failure.
 */
export function loadFieldLocks(avatarId: string): Set<string> {
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

/**
 * Save locked field IDs to localStorage for a given avatar.
 */
export function saveFieldLocks(avatarId: string, locks: Set<string>): void {
  try {
    const key = `${LOCK_STORAGE_PREFIX}${avatarId}`;
    localStorage.setItem(key, JSON.stringify([...locks]));
  } catch (error) {
    console.error('[Field Locks] Save failed:', error);
  }
}
