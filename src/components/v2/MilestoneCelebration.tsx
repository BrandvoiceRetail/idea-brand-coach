/**
 * MilestoneCelebration Component
 *
 * Displays celebratory animations when users hit milestones:
 * - 5 fields filled: "Great progress!" message with sparkle animation
 * - Chapter complete: Confetti burst with chapter completion message
 * - All chapters complete: Full celebration with brand summary
 *
 * Uses framer-motion for smooth, delightful animations.
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Trophy, PartyPopper, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Milestone types that trigger celebration
 */
export type MilestoneType =
  | 'fields_milestone'
  | 'chapter_complete'
  | 'all_complete';

/**
 * Milestone event data
 */
export interface MilestoneEvent {
  /** Type of milestone reached */
  type: MilestoneType;

  /** Display title */
  title: string;

  /** Description message */
  message: string;

  /** Number of fields filled (for fields_milestone) */
  fieldCount?: number;

  /** Chapter name (for chapter_complete) */
  chapterName?: string;
}

/**
 * Props for MilestoneCelebration
 */
export interface MilestoneCelebrationProps {
  /** Current milestone event to display (null to hide) */
  milestone: MilestoneEvent | null;

  /** Callback when celebration is dismissed */
  onDismiss: () => void;

  /** Auto-dismiss timeout in ms (0 to disable) */
  autoDismissMs?: number;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Confetti particle for celebration effect
 */
const ConfettiParticle: React.FC<{
  index: number;
  color: string;
}> = ({ index, color }) => {
  const randomX = (Math.random() - 0.5) * 300;
  const randomY = -Math.random() * 200 - 50;
  const randomRotate = Math.random() * 720 - 360;
  const randomDelay = Math.random() * 0.3;
  const size = Math.random() * 6 + 4;

  return (
    <motion.div
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
      animate={{
        x: randomX,
        y: randomY,
        rotate: randomRotate,
        opacity: 0,
        scale: 0.5,
      }}
      transition={{
        duration: 1.5,
        delay: randomDelay,
        ease: 'easeOut',
      }}
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        backgroundColor: color,
        left: '50%',
        bottom: '0',
      }}
    />
  );
};

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96E6A1', '#DDA0DD', '#F0E68C', '#87CEEB',
];

/**
 * MilestoneCelebration Component
 *
 * @example
 * ```tsx
 * <MilestoneCelebration
 *   milestone={{
 *     type: 'chapter_complete',
 *     title: 'Chapter Complete!',
 *     message: 'You finished "Brand Foundation"',
 *     chapterName: 'Brand Foundation',
 *   }}
 *   onDismiss={() => setMilestone(null)}
 * />
 * ```
 */
export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestone,
  onDismiss,
  autoDismissMs = 5000,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (milestone) {
      setIsVisible(true);

      if (autoDismissMs > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }, autoDismissMs);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [milestone, autoDismissMs, onDismiss]);

  const handleDismiss = useCallback((): void => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const getIcon = (): React.ReactNode => {
    if (!milestone) return null;

    switch (milestone.type) {
      case 'fields_milestone':
        return <Sparkles className="h-6 w-6 text-amber-500" />;
      case 'chapter_complete':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'all_complete':
        return <Trophy className="h-6 w-6 text-amber-500" />;
    }
  };

  const getGradient = (): string => {
    if (!milestone) return '';

    switch (milestone.type) {
      case 'fields_milestone':
        return 'from-amber-500/10 via-yellow-500/5 to-transparent';
      case 'chapter_complete':
        return 'from-green-500/10 via-emerald-500/5 to-transparent';
      case 'all_complete':
        return 'from-amber-500/15 via-purple-500/10 to-transparent';
    }
  };

  const showConfetti = milestone?.type === 'chapter_complete' || milestone?.type === 'all_complete';

  return (
    <AnimatePresence>
      {isVisible && milestone && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(
            'relative overflow-hidden rounded-lg border shadow-lg',
            'bg-gradient-to-r',
            getGradient(),
            'bg-card',
            className
          )}
        >
          {/* Confetti effect */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  index={i}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}
            </div>
          )}

          <div className="relative flex items-start gap-3 p-4">
            {/* Icon with pulse animation */}
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 0.6,
                repeat: milestone.type === 'all_complete' ? 2 : 1,
                repeatDelay: 0.3,
              }}
              className="flex-shrink-0 mt-0.5"
            >
              {getIcon()}
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm">{milestone.title}</h4>
                {milestone.type === 'all_complete' && (
                  <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 text-[10px]">
                    <PartyPopper className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {milestone.message}
              </p>
            </div>

            {/* Dismiss button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 flex-shrink-0"
              onClick={handleDismiss}
              aria-label="Dismiss celebration"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook for managing milestone celebrations
 *
 * Tracks field count and chapter completion to trigger celebrations at:
 * - Every 5 fields filled
 * - Each chapter completion
 * - All chapters complete
 *
 * @example
 * ```tsx
 * const { milestone, dismissMilestone, checkFieldMilestone, checkChapterComplete } = useMilestoneCelebration();
 *
 * // After a field is filled:
 * checkFieldMilestone(totalFilledFields);
 *
 * // After a chapter is marked complete:
 * checkChapterComplete('Brand Foundation');
 * ```
 */
export function useMilestoneCelebration(): {
  milestone: MilestoneEvent | null;
  dismissMilestone: () => void;
  checkFieldMilestone: (filledCount: number) => void;
  checkChapterComplete: (chapterName: string, isLastChapter?: boolean) => void;
} {
  const [milestone, setMilestone] = useState<MilestoneEvent | null>(null);
  const [lastCelebratedCount, setLastCelebratedCount] = useState(0);

  const dismissMilestone = useCallback((): void => {
    setMilestone(null);
  }, []);

  const checkFieldMilestone = useCallback((filledCount: number): void => {
    const milestoneThreshold = Math.floor(filledCount / 5) * 5;
    if (milestoneThreshold > 0 && milestoneThreshold > lastCelebratedCount) {
      setLastCelebratedCount(milestoneThreshold);
      setMilestone({
        type: 'fields_milestone',
        title: 'Great Progress!',
        message: `You've filled ${filledCount} fields. Keep going!`,
        fieldCount: filledCount,
      });
    }
  }, [lastCelebratedCount]);

  const checkChapterComplete = useCallback((chapterName: string, isLastChapter = false): void => {
    if (isLastChapter) {
      setMilestone({
        type: 'all_complete',
        title: 'Brand Profile Complete!',
        message: 'All chapters are finished. Your brand strategy is ready for review.',
      });
    } else {
      setMilestone({
        type: 'chapter_complete',
        title: 'Chapter Complete!',
        message: `You finished "${chapterName}". On to the next one!`,
        chapterName,
      });
    }
  }, []);

  return {
    milestone,
    dismissMilestone,
    checkFieldMilestone,
    checkChapterComplete,
  };
}
