/**
 * DirectEditNudge Component
 *
 * Subtle, dismissible banner encouraging users to chat with TrevBot
 * for faster field extraction. Shows once per session using sessionStorage.
 */

import * as React from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for DirectEditNudge
 */
export interface DirectEditNudgeProps {
  /** Callback when the nudge is dismissed */
  onDismiss: () => void;
  /** Additional CSS classes */
  className?: string;
}

const STORAGE_KEY = 'direct-edit-nudge-dismissed';

/**
 * Returns whether the nudge has been dismissed this session.
 */
function isNudgeDismissed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the nudge dismissal to sessionStorage.
 */
function persistDismissal(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // sessionStorage unavailable — silent fail
  }
}

/**
 * Hook to manage nudge dismissed state for the current session.
 */
export function useDirectEditNudge(): {
  nudgeDismissed: boolean;
  dismissNudge: () => void;
} {
  const [nudgeDismissed, setNudgeDismissed] = useState<boolean>(isNudgeDismissed);

  const dismissNudge = (): void => {
    persistDismissal();
    setNudgeDismissed(true);
  };

  return { nudgeDismissed, dismissNudge };
}

/**
 * DirectEditNudge Component
 *
 * A small info banner that encourages users to use the chat for field extraction.
 * Dismissible via X button or "Got it" link. Only shows once per session.
 *
 * @example
 * ```tsx
 * const { nudgeDismissed, dismissNudge } = useDirectEditNudge();
 * {!nudgeDismissed && <DirectEditNudge onDismiss={dismissNudge} />}
 * ```
 */
export const DirectEditNudge: React.FC<DirectEditNudgeProps> = ({
  onDismiss,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs',
        'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20',
        className
      )}
    >
      <p className="flex-1">
        Chat with TrevBot to fill fields faster &mdash; he can extract multiple
        fields from a single message.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 hover:bg-blue-500/20 transition-colors"
        aria-label="Dismiss hint"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
