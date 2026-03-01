/**
 * useFeatureFlag Hook
 *
 * Simple feature flag evaluation using local configuration.
 * Since feature_flags table doesn't exist in the database,
 * this provides a local-only implementation for now.
 *
 * @example
 * ```tsx
 * const isAnalyticsEnabled = useFeatureFlag('brand_analytics', false);
 *
 * return isAnalyticsEnabled ? <Analytics /> : null;
 * ```
 */
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Feature flag configuration (local-only for now)
 *
 * TARGETING RULES EXPLAINED (for v2-multi-avatar rollout):
 * - userIds: Array of specific user IDs to enable (useful for beta testers)
 * - percentage: User-based rollout (0-100), for authenticated users
 * - sessionPercentage: Session-based rollout (0-100), for anonymous users
 *
 * For v2-multi-avatar, we use sessionPercentage because:
 * - Avatar builder is accessed by anonymous users (before signup)
 * - No user ID available, so we use browser session ID instead
 * - Allows gradual rollout: 0% → 10% → 50% → 100%
 */
interface FeatureFlag {
  name: string;
  enabled: boolean; // Master on/off switch
  targeting_rules?: {
    userIds?: string[]; // Explicit user IDs to enable (overrides percentage)
    percentage?: number; // User-based rollout percentage (0-100)
    sessionPercentage?: number; // Session-based rollout percentage (0-100) - used for v2-multi-avatar
  };
}

// Local feature flags configuration
/**
 * TESTING PERCENTAGE ROLLOUT:
 *
 * To test the v2-multi-avatar flag at different rollout percentages:
 *
 * 1. Set enabled: true and sessionPercentage to desired percentage (10, 50, or 100)
 * 2. Open browser and navigate to http://localhost:5173/avatar
 * 3. Clear sessionStorage: sessionStorage.clear() in browser console
 * 4. Reload page multiple times - each reload creates a new session ID
 * 5. Observe that approximately X% of sessions see V2 interface (multi-avatar)
 * 6. The rest see V1 interface (single avatar builder)
 *
 * Example configurations:
 * - 10% rollout:  enabled: true, sessionPercentage: 10
 * - 50% rollout:  enabled: true, sessionPercentage: 50
 * - 100% rollout: enabled: true, sessionPercentage: 100
 * - Disabled:     enabled: false (or sessionPercentage: 0)
 */
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  /**
   * V2 Multi-Avatar Flag Configuration
   *
   * Controls rollout of the new multi-avatar builder interface.
   *
   * ROLLOUT STRATEGY:
   * - Session-based percentage rollout (not user-based)
   * - Why session-based? Avatar builder is used by anonymous users pre-signup
   * - Each browser session gets a deterministic flag evaluation based on session ID
   * - Same session always sees same version (V1 or V2) for consistency
   * - Different sessions may see different versions based on percentage setting
   *
   * ROLLOUT PHASES:
   * 1. Internal testing: sessionPercentage: 0 (disabled, all see V1)
   * 2. Alpha: sessionPercentage: 10 (10% of sessions see V2)
   * 3. Beta: sessionPercentage: 50 (50% of sessions see V2)
   * 4. Full rollout: sessionPercentage: 100 (all sessions see V2)
   *
   * CURRENT STATUS: Internal testing (0% - all users see V1 single avatar builder)
   */
  'v2-multi-avatar': {
    name: 'v2-multi-avatar',
    enabled: true, // Master switch - must be true for rollout to work
    targeting_rules: {
      // Session-based percentage rollout (for anonymous users)
      // Change this value to test different rollout percentages: 10, 50, 100
      // Set to 0 to disable rollout (all users see V1)
      sessionPercentage: 0, // Current: 0% rollout (internal testing phase)
    },
  },
};

/**
 * Subscribers for flag updates (for reactive UI)
 */
type FlagSubscriber = () => void;
const flagSubscribers = new Set<FlagSubscriber>();

/**
 * Subscribe to flag updates
 */
function subscribeFlagUpdates(callback: FlagSubscriber): () => void {
  flagSubscribers.add(callback);
  return () => flagSubscribers.delete(callback);
}

/**
 * Notify all subscribers of flag updates
 */
function notifyFlagUpdates(): void {
  flagSubscribers.forEach(callback => callback());
}

/**
 * Get or create a session ID for anonymous users
 * Persists in sessionStorage for the duration of the browser session
 *
 * FOR V2-MULTI-AVATAR ROLLOUT:
 * - Creates unique session ID for each browser session (tab/window)
 * - ID persists across page reloads within same session
 * - Used to deterministically evaluate session-based percentage rollout
 * - Same session ID = same flag evaluation = consistent user experience
 * - Clearing sessionStorage creates new ID = potentially different flag evaluation
 *
 * Format: 'anon_<timestamp>_<random>' ensures uniqueness and debuggability
 */
function getOrCreateSessionId(): string {
  const SESSION_KEY = 'ff_session_id';

  // Check for existing session ID
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    // Create new session ID: timestamp ensures uniqueness, random adds entropy
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export interface UseFeatureFlagOptions {
  /**
   * Default value if flag doesn't exist
   */
  defaultValue?: boolean;

  /**
   * Optional user ID override (for admin testing)
   */
  userId?: string;

  /**
   * Optional session ID override (for testing)
   */
  sessionId?: string;
}

/**
 * Hook to evaluate a feature flag
 *
 * @param flagName - Unique feature flag name
 * @param defaultValue - Fallback value if flag doesn't exist (default: false)
 * @param options - Additional options
 * @returns boolean - Current flag evaluation result
 */
export function useFeatureFlag(
  flagName: string,
  defaultValue = false,
  options: UseFeatureFlagOptions = {}
): boolean {
  const [flagValue, setFlagValue] = useState<boolean>(options.defaultValue ?? defaultValue);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Get current user ID from Supabase auth
  useEffect(() => {
    const getUser = async (): Promise<void> => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Determine user/session ID for evaluation
  // FOR V2-MULTI-AVATAR ROLLOUT:
  // - If user is authenticated (has userId), use user-based evaluation
  // - If user is anonymous (no userId), use session-based evaluation
  // - This allows v2-multi-avatar to roll out to anonymous users via sessionPercentage
  // - Authenticated users could be targeted via percentage or userIds if needed
  const evaluationContext = useMemo(() => {
    return {
      userId: options.userId || userId, // User ID if authenticated
      sessionId: options.sessionId || (!userId ? getOrCreateSessionId() : undefined), // Session ID only for anonymous users
    };
  }, [userId, options.userId, options.sessionId]);

  // Evaluate flag from local configuration
  useEffect(() => {
    const flag = LOCAL_FEATURE_FLAGS[flagName];
    
    if (!flag) {
      setFlagValue(options.defaultValue ?? defaultValue);
      return;
    }

    const evaluated = evaluateFlag(flag, evaluationContext);
    setFlagValue(evaluated);
  }, [flagName, evaluationContext, defaultValue, options.defaultValue]);

  return flagValue;
}

/**
 * Evaluate a feature flag based on targeting rules
 *
 * FOR V2-MULTI-AVATAR ROLLOUT:
 * 1. Check if flag is globally enabled (master switch)
 * 2. If no targeting rules, return global enabled state (100% rollout)
 * 3. Apply targeting rules in order: userIds → percentage → sessionPercentage
 * 4. For v2-multi-avatar, sessionPercentage is used since users are anonymous
 * 5. Hash-based distribution ensures consistent evaluation per session
 */
function evaluateFlag(
  flag: FeatureFlag,
  context: { userId?: string; sessionId?: string }
): boolean {
  // Step 1: Check master switch - if disabled globally, flag is off for everyone
  if (!flag.enabled) {
    return false;
  }

  // Step 2: No targeting rules means 100% rollout to everyone
  if (!flag.targeting_rules || Object.keys(flag.targeting_rules).length === 0) {
    return flag.enabled;
  }

  const rules = flag.targeting_rules;

  // Step 3a: User ID targeting (explicit list of user IDs to enable)
  // Not used for v2-multi-avatar, but available for targeting specific test users
  if (rules.userIds && rules.userIds.length > 0 && context.userId) {
    if (rules.userIds.includes(context.userId)) {
      return true;
    }
  }

  // Step 3b: Percentage rollout (user-based)
  // Not used for v2-multi-avatar since users are anonymous
  // Could be used later if we want to roll out to authenticated users
  if (rules.percentage !== undefined && context.userId) {
    const hash = simpleHash(context.userId);
    const userPercentage = (hash % 100) + 1; // 1-100 range
    if (userPercentage <= rules.percentage) {
      return true;
    }
  }

  // Step 3c: Session-based percentage rollout
  // PRIMARY MECHANISM FOR V2-MULTI-AVATAR ROLLOUT
  // - Used because avatar builder users are anonymous (pre-signup)
  // - Hash ensures same session ID always gets same result (deterministic)
  // - sessionPercentage controls what % of sessions see the new feature
  // Example: sessionPercentage: 50 means ~50% of unique sessions see V2
  if (rules.sessionPercentage !== undefined && context.sessionId) {
    const hash = simpleHash(context.sessionId); // Deterministic hash
    const sessionPercentage = (hash % 100) + 1; // Maps hash to 1-100 range
    if (sessionPercentage <= rules.sessionPercentage) {
      return true; // This session is in the rollout percentage
    }
  }

  // Step 4: Default to disabled if no rules matched
  return false;
}

/**
 * Simple hash function for consistent percentage rollouts
 *
 * CRITICAL FOR V2-MULTI-AVATAR ROLLOUT:
 * - Converts session ID (or user ID) to deterministic number
 * - Same input ALWAYS produces same hash = consistent flag evaluation
 * - Hash % 100 maps to 1-100 range for percentage comparison
 * - Ensures users don't flip-flop between V1 and V2 on each page load
 *
 * Example:
 * - sessionId: "anon_123_abc" → hash: 42 → percentage bucket: 42
 * - If sessionPercentage: 50, this session sees V2 (42 <= 50)
 * - If sessionPercentage: 30, this session sees V1 (42 > 30)
 * - Same sessionId will ALWAYS map to bucket 42 (deterministic)
 *
 * Algorithm: Simple DJB2-style hash (fast, good distribution for strings)
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char; // hash * 31 + char (DJB2 variant)
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash); // Return positive number
}

/**
 * Hook to get raw feature flag data (for admin UI)
 *
 * @param flagName - Unique feature flag name
 * @returns Feature flag or null
 */
export function useFeatureFlagData(flagName: string): FeatureFlag | null {
  const flag = LOCAL_FEATURE_FLAGS[flagName];
  return flag || null;
}

/**
 * Hook to list all feature flags (for admin UI)
 * Re-renders when flags are updated
 *
 * @returns Array of all feature flags
 */
export function useAllFeatureFlags(): FeatureFlag[] {
  const [, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeFlagUpdates(() => {
      setUpdateTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  return Object.values(LOCAL_FEATURE_FLAGS);
}

/**
 * Update a feature flag's enabled state
 *
 * @param flagName - Feature flag name
 * @param enabled - New enabled state
 */
export function updateFeatureFlagEnabled(flagName: string, enabled: boolean): void {
  const flag = LOCAL_FEATURE_FLAGS[flagName];
  if (!flag) {
    throw new Error(`Feature flag "${flagName}" not found`);
  }

  flag.enabled = enabled;
  notifyFlagUpdates();
}

/**
 * Update a feature flag's percentage rollout
 *
 * @param flagName - Feature flag name
 * @param percentageType - Type of percentage ('percentage' for user-based, 'sessionPercentage' for session-based)
 * @param value - Percentage value (0-100)
 */
export function updateFeatureFlagPercentage(
  flagName: string,
  percentageType: 'percentage' | 'sessionPercentage',
  value: number
): void {
  const flag = LOCAL_FEATURE_FLAGS[flagName];
  if (!flag) {
    throw new Error(`Feature flag "${flagName}" not found`);
  }

  // Ensure targeting_rules exists
  if (!flag.targeting_rules) {
    flag.targeting_rules = {};
  }

  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value));
  flag.targeting_rules[percentageType] = clampedValue;

  notifyFlagUpdates();
}

/**
 * TESTING UTILITY: Simulate percentage rollout distribution
 *
 * This function helps verify that the hash-based percentage rollout
 * produces the expected distribution across many sessions.
 *
 * Usage in browser console:
 * ```javascript
 * import { testPercentageDistribution } from '@/hooks/useFeatureFlag';
 * testPercentageDistribution(50, 1000); // Test 50% rollout with 1000 sessions
 * ```
 *
 * @param targetPercentage - Target rollout percentage (0-100)
 * @param sampleSize - Number of sessions to simulate (default: 1000)
 * @returns Distribution statistics
 */
export function testPercentageDistribution(
  targetPercentage: number,
  sampleSize: number = 1000
): {
  targetPercentage: number;
  sampleSize: number;
  enabledCount: number;
  actualPercentage: number;
  deviation: number;
} {
  let enabledCount = 0;

  // Simulate many different session IDs
  for (let i = 0; i < sampleSize; i++) {
    const sessionId = `test_session_${i}_${Math.random().toString(36).substring(2)}`;
    const hash = simpleHash(sessionId);
    const sessionPercentage = (hash % 100) + 1;

    if (sessionPercentage <= targetPercentage) {
      enabledCount++;
    }
  }

  const actualPercentage = (enabledCount / sampleSize) * 100;
  const deviation = Math.abs(actualPercentage - targetPercentage);

  return {
    targetPercentage,
    sampleSize,
    enabledCount,
    actualPercentage: parseFloat(actualPercentage.toFixed(2)),
    deviation: parseFloat(deviation.toFixed(2)),
  };
}
