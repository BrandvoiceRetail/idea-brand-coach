/**
 * MilestoneOverlay Component
 *
 * Renders milestone celebrations using canvas-confetti.
 * Respects prefers-reduced-motion: when active, shows toast only (no animation).
 *
 * Milestone tiers:
 * - 10 fields: Triggers pulse CSS class on progress bar + toast
 * - 20 fields: Confetti burst + toast
 * - 35 fields: Full confetti celebration + toast (gold progress handled via CSS class)
 *
 * Uses Heart Red + Gold palette from design tokens (--heart-red, --gold-warm).
 */

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useToast } from '@/hooks/use-toast';
import type { MilestoneData } from '@/hooks/v2/useMilestone';

// ============================================================================
// Types
// ============================================================================

export interface MilestoneOverlayProps {
  /** Currently active milestone (null = hidden) */
  activeMilestone: MilestoneData | null;

  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;

  /** Called when the celebration finishes or the toast appears */
  onComplete: () => void;
}

// ============================================================================
// Confetti palettes using Heart Red + Gold Warm tokens
// ============================================================================

/** HSL(0 84% 50%) -> #E01414 and HSL(43 96% 56%) -> #F5B91E approximately */
const HEART_RED = '#E01414';
const GOLD_WARM = '#F5B91E';

const CONFETTI_COLORS_20 = [HEART_RED, GOLD_WARM, '#FF6B6B', '#FFD700'];
const CONFETTI_COLORS_35 = [HEART_RED, GOLD_WARM, '#FF6B6B', '#FFD700', '#FFA500', '#FF4500'];

// ============================================================================
// Confetti helpers
// ============================================================================

function fireBurst20(): void {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: CONFETTI_COLORS_20,
    disableForReducedMotion: true,
  });
}

function fireCelebration35(): void {
  // First burst
  confetti({
    particleCount: 100,
    spread: 100,
    origin: { y: 0.5 },
    colors: CONFETTI_COLORS_35,
    disableForReducedMotion: true,
  });

  // Delayed second burst from left
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: CONFETTI_COLORS_35,
      disableForReducedMotion: true,
    });
  }, 250);

  // Delayed third burst from right
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: CONFETTI_COLORS_35,
      disableForReducedMotion: true,
    });
  }, 400);
}

// ============================================================================
// Component
// ============================================================================

/**
 * MilestoneOverlay handles visual celebration effects.
 *
 * It is invisible in the DOM (no rendered elements) — it uses canvas-confetti
 * which draws on an auto-created canvas, and toasts via the toast system.
 *
 * @example
 * ```tsx
 * <MilestoneOverlay
 *   activeMilestone={activeMilestone}
 *   prefersReducedMotion={prefersReducedMotion}
 *   onComplete={dismissMilestone}
 * />
 * ```
 */
export function MilestoneOverlay({
  activeMilestone,
  prefersReducedMotion,
  onComplete,
}: MilestoneOverlayProps): null {
  const { toast } = useToast();
  const lastFiredTier = useRef<number | null>(null);

  useEffect(() => {
    if (!activeMilestone) return;
    if (lastFiredTier.current === activeMilestone.tier) return;

    lastFiredTier.current = activeMilestone.tier;

    // Always show the toast (even with reduced motion)
    toast({
      title: getMilestoneTitle(activeMilestone.tier),
      description: activeMilestone.message,
    });

    // Skip animations if the user prefers reduced motion
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    // Fire confetti based on tier
    if (activeMilestone.tier === 20 && activeMilestone.showConfetti) {
      fireBurst20();
    } else if (activeMilestone.tier === 35 && activeMilestone.showConfetti) {
      fireCelebration35();
    }

    // Auto-dismiss after a delay so the pulse / gold has time to show
    const dismissDelay = activeMilestone.tier === 35 ? 4000 : 3000;
    const timer = setTimeout(() => {
      onComplete();
    }, dismissDelay);

    return () => clearTimeout(timer);
  }, [activeMilestone, prefersReducedMotion, onComplete, toast]);

  // Reset lastFiredTier when milestone is cleared so it can fire again for
  // a different avatar
  useEffect(() => {
    if (!activeMilestone) {
      lastFiredTier.current = null;
    }
  }, [activeMilestone]);

  // This component renders nothing — all effects are side-effects
  return null;
}

// ============================================================================
// Helpers
// ============================================================================

function getMilestoneTitle(tier: number): string {
  switch (tier) {
    case 10:
      return 'Milestone Reached!';
    case 20:
      return 'Great Progress!';
    case 35:
      return 'Brand Strategy Complete!';
    default:
      return 'Milestone!';
  }
}
