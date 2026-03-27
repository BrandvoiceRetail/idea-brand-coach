/**
 * MilestoneOverlay Component
 *
 * Displays celebration effects when field count milestones are reached.
 * - 10 fields: subtle pulse badge + toast
 * - 20 fields: confetti burst + toast
 * - 35 fields: full confetti + prominent toast
 *
 * Respects prefers-reduced-motion by showing toast only.
 * Auto-dismisses after 4 seconds or on click.
 */

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';

interface MilestoneOverlayProps {
  milestone: 10 | 20 | 35 | null;
  onDismiss: () => void;
}

const MESSAGES: Record<10 | 20 | 35, string> = {
  10: '10 fields captured \u2014 your brand foundation is taking shape!',
  20: '20 fields \u2014 over halfway! Your brand strategy is really coming together.',
  35: 'All 35 fields captured! Your complete brand strategy is ready to export.',
};

const AUTO_DISMISS_MS = 4000;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fireConfetti(milestone: 20 | 35): void {
  const colors = ['#E02020', '#E8A817', '#22c55e'];

  if (milestone === 20) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.3 },
      colors,
    });
  } else {
    // 35 fields: longer, more particles
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.3 },
      colors,
      ticks: 300,
    });
    // Second burst for extra celebration
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 120,
        origin: { y: 0.4 },
        colors,
        ticks: 200,
      });
    }, 300);
  }
}

export function MilestoneOverlay({ milestone, onDismiss }: MilestoneOverlayProps): JSX.Element | null {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (milestone === null) return;

    const reduced = prefersReducedMotion();
    const message = MESSAGES[milestone];

    // Always show toast
    if (milestone === 35) {
      toast.success(message, { duration: AUTO_DISMISS_MS });
    } else {
      toast(message, { duration: AUTO_DISMISS_MS });
    }

    // Fire confetti for 20+ milestones (skip if reduced motion)
    if (!reduced && (milestone === 20 || milestone === 35)) {
      fireConfetti(milestone);
    }

    // Auto-dismiss
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return (): void => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [milestone, onDismiss]);

  if (milestone === null) return null;

  // For milestone 10, render a subtle pulse badge overlay (click to dismiss)
  // For 20+, confetti handles the visual; this is just a click target
  if (milestone === 10) {
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-auto"
        onClick={onDismiss}
        role="button"
        tabIndex={0}
        onKeyDown={(e): void => {
          if (e.key === 'Enter' || e.key === ' ') onDismiss();
        }}
        aria-label="Dismiss milestone celebration"
      >
        <div className="absolute top-4 left-1/2 -translate-x-1/2 animate-pulse">
          <div className="rounded-full bg-progress-gradient px-4 py-2 text-white text-sm font-medium shadow-lg">
            10 fields captured!
          </div>
        </div>
      </div>
    );
  }

  // For 20 and 35, just provide a click-to-dismiss overlay (confetti handles visuals)
  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e): void => {
        if (e.key === 'Enter' || e.key === ' ') onDismiss();
      }}
      aria-label="Dismiss milestone celebration"
    />
  );
}
