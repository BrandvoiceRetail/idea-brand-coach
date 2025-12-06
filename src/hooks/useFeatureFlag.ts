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
const LOCAL_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // Add feature flags here as needed
  // 'brand_analytics': { name: 'brand_analytics', enabled: false },
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
