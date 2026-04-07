/**
 * useMilestone Hook
 *
 * Tracks field-count milestones at 10, 20, and 35 thresholds.
 * Each milestone fires only once per profile (persisted to localStorage).
 * Respects prefers-reduced-motion by exposing a flag the overlay can use.
 *
 * Milestone tiers:
 * - 10 fields: Subtle pulse on progress bar + toast
 * - 20 fields: Confetti burst + congratulatory toast
 * - 35 fields: Full celebration — confetti + gold progress bar + toast
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Milestone tier thresholds */
export type MilestoneTier = 10 | 20 | 35;

/** Data describing the currently active milestone */
export interface MilestoneData {
  /** Which tier was reached */
  tier: MilestoneTier;

  /** Toast message to display */
  message: string;

  /** Whether confetti should fire (20 and 35) */
  showConfetti: boolean;

  /** Whether the progress bar should pulse (10) */
  showPulse: boolean;

  /** Whether to apply the gold gradient on the progress bar (35) */
  showGold: boolean;
}

export interface UseMilestoneReturn {
  /** Currently active milestone, or null when idle */
  activeMilestone: MilestoneData | null;

  /** Dismiss the current milestone overlay */
  dismissMilestone: () => void;

  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;

  /** Whether the 35-field milestone has been reached (for persistent gold bar) */
  isComplete: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_PREFIX = 'milestone_fired_';

const MILESTONE_CONFIG: Record<MilestoneTier, Omit<MilestoneData, 'tier'>> = {
  10: {
    message: '10 fields captured \u2014 your brand foundation is taking shape!',
    showConfetti: false,
    showPulse: true,
    showGold: false,
  },
  20: {
    message: '20 fields \u2014 over halfway! Your brand strategy is really coming together.',
    showConfetti: true,
    showPulse: false,
    showGold: false,
  },
  35: {
    message: 'All 35 fields captured! Your complete brand strategy is ready to export.',
    showConfetti: true,
    showPulse: false,
    showGold: true,
  },
};

const TIERS: MilestoneTier[] = [10, 20, 35];

// ============================================================================
// Helpers
// ============================================================================

function storageKey(avatarId: string, tier: MilestoneTier): string {
  return `${STORAGE_KEY_PREFIX}${avatarId}_${tier}`;
}

function hasFired(avatarId: string, tier: MilestoneTier): boolean {
  try {
    return localStorage.getItem(storageKey(avatarId, tier)) === 'true';
  } catch {
    return false;
  }
}

function markFired(avatarId: string, tier: MilestoneTier): void {
  try {
    localStorage.setItem(storageKey(avatarId, tier), 'true');
  } catch {
    // localStorage unavailable — milestone just won't persist
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Tracks field-count milestones and fires celebrations at 10, 20, and 35 fields.
 *
 * @param savedFieldCount - The current number of saved fields for the active profile
 * @param avatarId - The active avatar/profile ID for per-profile persistence
 * @returns Milestone state and dismiss handler
 *
 * @example
 * ```tsx
 * const { activeMilestone, dismissMilestone, prefersReducedMotion, isComplete } =
 *   useMilestone(savedFieldCount, currentAvatar?.id ?? null);
 * ```
 */
export function useMilestone(
  savedFieldCount: number,
  avatarId: string | null,
): UseMilestoneReturn {
  const [activeMilestone, setActiveMilestone] = useState<MilestoneData | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Track whether we've already evaluated for this count to prevent
  // re-triggering on re-renders with the same count
  const lastEvaluatedCount = useRef<number>(0);
  const lastAvatarId = useRef<string | null>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent): void => {
      setPrefersReducedMotion(e.matches);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // When avatar changes, reset evaluated state and check if 35 has already fired
  useEffect(() => {
    if (avatarId !== lastAvatarId.current) {
      lastAvatarId.current = avatarId;
      lastEvaluatedCount.current = 0;
      setActiveMilestone(null);

      if (avatarId) {
        setIsComplete(hasFired(avatarId, 35));
      } else {
        setIsComplete(false);
      }
    }
  }, [avatarId]);

  // Evaluate milestones when savedFieldCount changes
  useEffect(() => {
    if (!avatarId) return;
    if (savedFieldCount <= 0) return;
    if (savedFieldCount <= lastEvaluatedCount.current) return;

    lastEvaluatedCount.current = savedFieldCount;

    // Walk tiers from highest to lowest — fire the highest newly-crossed tier
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const tier = TIERS[i];
      if (savedFieldCount >= tier && !hasFired(avatarId, tier)) {
        markFired(avatarId, tier);
        const config = MILESTONE_CONFIG[tier];
        setActiveMilestone({ tier, ...config });

        if (tier === 35) {
          setIsComplete(true);
        }
        break;
      }
    }
  }, [savedFieldCount, avatarId]);

  const dismissMilestone = useCallback((): void => {
    setActiveMilestone(null);
  }, []);

  return {
    activeMilestone,
    dismissMilestone,
    prefersReducedMotion,
    isComplete,
  };
}
