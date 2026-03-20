/**
 * useVersionPreference Hook
 *
 * Manages version preference (v1/v2) with localStorage for fast local access
 * and database sync for cross-device persistence.
 *
 * @example
 * ```tsx
 * const { currentVersion, setVersion, hasSeenIntroduction } = useVersionPreference();
 * ```
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type {
  AppVersion,
  VersionPreference,
  VersionSwitchEvent,
} from '@/types/version';

const STORAGE_KEY = 'idea_version_preference';
const OLD_STORAGE_KEY = 'versionPreference'; // Legacy key to migrate from
const DEFAULT_VERSION: AppVersion = 'v2';
const MAX_SWITCH_HISTORY = 50;

function createDefaultPreference(): VersionPreference {
  return {
    version: DEFAULT_VERSION,
    hasSeenIntroduction: false,
    switchHistory: [],
    lastUpdated: new Date().toISOString(),
  };
}

function isValidAppVersion(value: unknown): value is AppVersion {
  return value === 'v1' || value === 'v2';
}

function isValidPreference(data: unknown): data is VersionPreference {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  return (
    isValidAppVersion(obj.version) &&
    typeof obj.hasSeenIntroduction === 'boolean' &&
    Array.isArray(obj.switchHistory) &&
    typeof obj.lastUpdated === 'string'
  );
}

/**
 * Migrate from old localStorage key if it exists
 */
function migrateOldPreference(): AppVersion | null {
  try {
    const oldValue = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldValue && isValidAppVersion(oldValue)) {
      // Remove old key after reading
      localStorage.removeItem(OLD_STORAGE_KEY);
      return oldValue;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function loadPreference(): VersionPreference {
  try {
    // First, check for old key migration
    const migratedVersion = migrateOldPreference();

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // No existing preference - use migrated version if available
      const defaultPref = createDefaultPreference();
      if (migratedVersion) {
        defaultPref.version = migratedVersion;
        defaultPref.hasSeenIntroduction = true; // They had a preference, so not new
        savePreference(defaultPref);
      }
      return defaultPref;
    }

    const parsed: unknown = JSON.parse(raw);
    if (isValidPreference(parsed)) {
      // If migrated version differs, prefer it (more recent user action)
      if (migratedVersion && parsed.version !== migratedVersion) {
        parsed.version = migratedVersion;
        savePreference(parsed);
      }
      return parsed;
    }

    // Corrupted data — reset to defaults but preserve version if valid
    const obj = parsed as Record<string, unknown>;
    const version = isValidAppVersion(obj.version) ? obj.version : (migratedVersion || DEFAULT_VERSION);
    return { ...createDefaultPreference(), version };
  } catch {
    return createDefaultPreference();
  }
}

function savePreference(pref: VersionPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

export interface UseVersionPreferenceResult {
  currentVersion: AppVersion;
  hasSeenIntroduction: boolean;
  switchHistory: VersionSwitchEvent[];
  isNewUser: boolean;
  setVersion: (version: AppVersion) => void;
  markIntroductionSeen: () => void;
}

export function useVersionPreference(): UseVersionPreferenceResult {
  const { user } = useAuth();
  const [preference, setPreference] = useState<VersionPreference>(loadPreference);
  const isNewUserRef = useRef<boolean>(
    localStorage.getItem(STORAGE_KEY) === null && localStorage.getItem(OLD_STORAGE_KEY) === null
  );
  const hasSyncedFromDb = useRef<boolean>(false);

  // Sync from database on mount (after localStorage for fast initial render)
  useEffect(() => {
    if (!user || hasSyncedFromDb.current) return;

    const syncFromDb = async (): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('version_preference')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('Failed to fetch version preference from DB:', error.message);
          return;
        }

        // If DB has a preference and it differs from local, update local
        if (data?.version_preference && isValidAppVersion(data.version_preference)) {
          setPreference((prev) => {
            if (prev.version === data.version_preference) return prev;

            const updated: VersionPreference = {
              ...prev,
              version: data.version_preference as AppVersion,
              hasSeenIntroduction: true, // DB preference means they've chosen before
              lastUpdated: new Date().toISOString(),
            };
            savePreference(updated);
            isNewUserRef.current = false;
            return updated;
          });
        }

        hasSyncedFromDb.current = true;
      } catch (err) {
        console.warn('Error syncing version preference from DB:', err);
      }
    };

    syncFromDb();
  }, [user]);

  /**
   * Push version preference to database (async, non-blocking)
   */
  const pushToDb = useCallback(async (version: AppVersion): Promise<void> => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ version_preference: version })
        .eq('id', user.id);

      if (error) {
        console.warn('Failed to save version preference to DB:', error.message);
      }
    } catch (err) {
      console.warn('Error pushing version preference to DB:', err);
    }
  }, [user]);

  const setVersion = useCallback((newVersion: AppVersion): void => {
    setPreference((prev) => {
      if (prev.version === newVersion) return prev;

      const switchEvent: VersionSwitchEvent = {
        from: prev.version,
        to: newVersion,
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [
        ...prev.switchHistory,
        switchEvent,
      ].slice(-MAX_SWITCH_HISTORY);

      const updated: VersionPreference = {
        ...prev,
        version: newVersion,
        switchHistory: updatedHistory,
        lastUpdated: new Date().toISOString(),
      };

      // Save to localStorage immediately for fast access
      savePreference(updated);

      return updated;
    });

    // Push to DB async (non-blocking)
    pushToDb(newVersion);
  }, [pushToDb]);

  const markIntroductionSeen = useCallback((): void => {
    setPreference((prev) => {
      if (prev.hasSeenIntroduction) return prev;

      const updated: VersionPreference = {
        ...prev,
        hasSeenIntroduction: true,
        lastUpdated: new Date().toISOString(),
      };

      savePreference(updated);
      isNewUserRef.current = false;
      return updated;
    });
  }, []);

  return {
    currentVersion: preference.version,
    hasSeenIntroduction: preference.hasSeenIntroduction,
    switchHistory: preference.switchHistory,
    isNewUser: isNewUserRef.current,
    setVersion,
    markIntroductionSeen,
  };
}
