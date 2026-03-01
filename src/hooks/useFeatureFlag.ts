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
 */
interface FeatureFlag {
  name: string;
  enabled: boolean;
  targeting_rules?: {
    userIds?: string[];
    percentage?: number;
    sessionPercentage?: number;
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
  'v2-multi-avatar': {
    name: 'v2-multi-avatar',
    enabled: true,
    targeting_rules: {
      // Session-based percentage rollout (for anonymous users)
      // Change this value to test different rollout percentages: 10, 50, 100
      // Set to 0 to disable rollout (all users see V1)
      sessionPercentage: 0,
    },
  },
};

/**
 * Get or create a session ID for anonymous users
 * Persists in sessionStorage for the duration of the browser session
 */
function getOrCreateSessionId(): string {
  const SESSION_KEY = 'ff_session_id';

  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
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
  const evaluationContext = useMemo(() => {
    return {
      userId: options.userId || userId,
      sessionId: options.sessionId || (!userId ? getOrCreateSessionId() : undefined),
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
 */
function evaluateFlag(
  flag: FeatureFlag,
  context: { userId?: string; sessionId?: string }
): boolean {
  // If flag is disabled globally, return false
  if (!flag.enabled) {
    return false;
  }

  // If no targeting rules, return global enabled state
  if (!flag.targeting_rules || Object.keys(flag.targeting_rules).length === 0) {
    return flag.enabled;
  }

  const rules = flag.targeting_rules;

  // User ID targeting
  if (rules.userIds && rules.userIds.length > 0 && context.userId) {
    if (rules.userIds.includes(context.userId)) {
      return true;
    }
  }

  // Percentage rollout (user-based)
  if (rules.percentage !== undefined && context.userId) {
    const hash = simpleHash(context.userId);
    const userPercentage = (hash % 100) + 1;
    if (userPercentage <= rules.percentage) {
      return true;
    }
  }

  // Session-based percentage rollout
  if (rules.sessionPercentage !== undefined && context.sessionId) {
    const hash = simpleHash(context.sessionId);
    const sessionPercentage = (hash % 100) + 1;
    if (sessionPercentage <= rules.sessionPercentage) {
      return true;
    }
  }

  // Default to disabled if no rules matched
  return false;
}

/**
 * Simple hash function for consistent percentage rollouts
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
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
 *
 * @returns Array of all feature flags
 */
export function useAllFeatureFlags(): FeatureFlag[] {
  return Object.values(LOCAL_FEATURE_FLAGS);
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
