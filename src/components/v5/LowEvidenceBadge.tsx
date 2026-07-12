/**
 * LowEvidenceBadge — honest thin-corpus indicator for the /v5 surface.
 * Shows when a build consumed fewer reviews than the confidence threshold.
 * Appears on BuildTheatre, ResultsScreen, and V5BriefScreen to maintain
 * transparency about the provisional nature of thin-corpus reads.
 */
import { AlertCircle } from 'lucide-react';

/** Below this threshold, the read is considered provisional. */
export const LOW_EVIDENCE_THRESHOLD = 15;

export interface LowEvidenceBadgeProps {
  reviewCount: number;
  /** Optional click handler to add more customer voice. */
  onAddVoice?: () => void;
  /** Whether to show full text or compact version. */
  variant?: 'full' | 'compact';
}

export function LowEvidenceBadge({
  reviewCount,
  onAddVoice,
  variant = 'full',
}: LowEvidenceBadgeProps): JSX.Element | null {
  if (reviewCount >= LOW_EVIDENCE_THRESHOLD) return null;

  const fullText = `Built from only ${reviewCount} review${reviewCount === 1 ? '' : 's'}. Treat this read as provisional until more customer voice lands.`;
  const compactText = `Only ${reviewCount} review${reviewCount === 1 ? '' : 's'}. Provisional read.`;

  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="font-medium">
        {variant === 'full' ? fullText : compactText}
      </span>
      {onAddVoice && (
        <>
          <span className="text-amber-600/40 dark:text-amber-400/40">·</span>
          <button
            onClick={onAddVoice}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Add customer voice
          </button>
        </>
      )}
    </div>
  );
}