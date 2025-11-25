/**
 * useFeatureFlag Hook
 *
 * Real-time feature flag evaluation with Supabase subscriptions
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
import type { Database } from '@/integrations/supabase/types';

type FeatureFlagRow = Database['public']['Tables']['feature_flags']['Row'];

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
   * Default value if flag doesn't exist or Supabase is unavailable
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
 * Hook to evaluate a feature flag with real-time updates
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

  // Fetch and subscribe to feature flag
  useEffect(() => {
    let mounted = true;

    const fetchFlag = async (): Promise<void> => {
      try {
        // Fetch feature flag
        const { data: flag, error } = await supabase
          .from('feature_flags')
          .select('*')
          .eq('name', flagName)
          .single();

        if (error) {
          // Flag doesn't exist - use default
          if (mounted) setFlagValue(options.defaultValue ?? defaultValue);
          return;
        }

        if (!flag) {
          if (mounted) setFlagValue(options.defaultValue ?? defaultValue);
          return;
        }

        // Evaluate flag based on targeting rules
        const evaluated = evaluateFlag(flag, evaluationContext);
        if (mounted) setFlagValue(evaluated);
      } catch (error) {
        console.error('[useFeatureFlag] Error fetching flag:', error);
        if (mounted) setFlagValue(options.defaultValue ?? defaultValue);
      }
    };

    // Initial fetch
    fetchFlag();

    // Subscribe to real-time changes
    const channel = supabase
      .channel(`feature_flag_${flagName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
          filter: `name=eq.${flagName}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (mounted) setFlagValue(options.defaultValue ?? defaultValue);
          } else {
            const flag = payload.new as FeatureFlagRow;
            const evaluated = evaluateFlag(flag, evaluationContext);
            if (mounted) setFlagValue(evaluated);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [flagName, evaluationContext.userId, evaluationContext.sessionId, defaultValue, options.defaultValue]);

  return flagValue;
}

/**
 * Evaluate a feature flag based on targeting rules
 */
function evaluateFlag(
  flag: FeatureFlagRow,
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

  const rules = flag.targeting_rules as {
    userIds?: string[];
    percentage?: number;
    sessionPercentage?: number;
  };

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
 * @returns Feature flag document or null
 */
export function useFeatureFlagData(flagName: string): FeatureFlagRow | null {
  const [flag, setFlag] = useState<FeatureFlagRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchFlag = async (): Promise<void> => {
      const { data } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('name', flagName)
        .single();

      if (mounted && data) {
        setFlag(data);
      }
    };

    fetchFlag();

    // Subscribe to changes
    const channel = supabase
      .channel(`feature_flag_data_${flagName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
          filter: `name=eq.${flagName}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            if (mounted) setFlag(null);
          } else {
            if (mounted) setFlag(payload.new as FeatureFlagRow);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [flagName]);

  return flag;
}

/**
 * Hook to list all feature flags (for admin UI)
 *
 * @returns Array of all feature flags
 */
export function useAllFeatureFlags(): FeatureFlagRow[] {
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchFlags = async (): Promise<void> => {
      const { data } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name');

      if (mounted && data) {
        setFlags(data);
      }
    };

    fetchFlags();

    // Subscribe to changes
    const channel = supabase
      .channel('all_feature_flags')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
        },
        () => {
          // Refetch all flags on any change
          fetchFlags();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return flags;
}
