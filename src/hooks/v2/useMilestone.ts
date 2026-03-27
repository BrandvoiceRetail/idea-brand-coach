/**
 * useMilestone Hook
 *
 * Tracks field count milestones (10, 20, 35) and fires each once per profile.
 * Uses localStorage to persist which milestones have already been shown.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'milestones-fired';
const MILESTONES = [10, 20, 35] as const;

type MilestoneValue = (typeof MILESTONES)[number];

interface UseMilestoneResult {
  activeMilestone: MilestoneValue | null;
  dismissMilestone: () => void;
}

function loadFiredMilestones(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFiredMilestones(milestones: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
  } catch {
    // localStorage may be full or disabled — silently ignore
  }
}

/**
 * Detects when fieldCount crosses milestone thresholds (10, 20, 35).
 * Each milestone fires once per profile (persisted in localStorage).
 */
export function useMilestone(fieldCount: number): UseMilestoneResult {
  const [activeMilestone, setActiveMilestone] = useState<MilestoneValue | null>(null);
  const firedRef = useRef<number[]>(loadFiredMilestones());

  useEffect(() => {
    const fired = firedRef.current;

    for (const threshold of MILESTONES) {
      if (fieldCount >= threshold && !fired.includes(threshold)) {
        fired.push(threshold);
        firedRef.current = fired;
        saveFiredMilestones(fired);
        setActiveMilestone(threshold);
        return;
      }
    }
  }, [fieldCount]);

  const dismissMilestone = useCallback((): void => {
    setActiveMilestone(null);
  }, []);

  return { activeMilestone, dismissMilestone };
}
